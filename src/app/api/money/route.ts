import { NextRequest, NextResponse } from 'next/server';
import { buildMonthlyMoneyReport } from '@/lib/incentives';
import { standardizePhoneField } from '@/lib/phone';
import { getSupabaseAdmin, requireAuthenticatedMember } from '@/lib/supabase/server';
import type { Lead, MerchantOrder } from '@/lib/types';

function currentDhakaMonth(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
  });
  return fmt.format(now).slice(0, 7); // YYYY-MM
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userClient, member } = auth;
  const { searchParams } = new URL(req.url);
  const rawMonth = (searchParams.get('month') || '').trim();
  const selectedMonth = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : currentDhakaMonth();

  const [onboardedRes, ordersRes] = await Promise.all([
    userClient
      .from('leads')
      .select('*')
      .eq('owner_id', member.id)
      .eq('stage', 'onboarded')
      .order('onboarded_at', { ascending: false }),
    userClient
      .from('merchant_orders')
      .select('*')
      .eq('owner_id', member.id)
      .order('order_date', { ascending: false }),
  ]);

  const onboardedLeads = (onboardedRes.data || []) as Lead[];
  const myOrders = (ordersRes.data || []) as MerchantOrder[];
  const report = buildMonthlyMoneyReport(myOrders, selectedMonth);

  // For Super Admin & Team Leader, also compute aggregate per-member COD & 2% incentive rollup
  let teamMoneyRollup: Array<{
    member_id: string;
    full_name: string;
    role: string;
    monthOrders: number;
    monthEligibleCod: number;
    incentive2Pct: number;
  }> = [];

  if (member.role === 'super_admin' || member.role === 'team_leader') {
    const admin = getSupabaseAdmin();
    const [{ data: allMembers }, { data: allOrders }] = await Promise.all([
      admin
        .from('team_members')
        .select('id, full_name, role')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      admin.from('merchant_orders').select('*'),
    ]);

    const ordersByOwner = new Map<string, MerchantOrder[]>();
    for (const o of (allOrders || []) as MerchantOrder[]) {
      const list = ordersByOwner.get(o.owner_id) || [];
      list.push(o);
      ordersByOwner.set(o.owner_id, list);
    }

    teamMoneyRollup = (allMembers || []).map((m) => {
      const rep = buildMonthlyMoneyReport(ordersByOwner.get(m.id) || [], selectedMonth);
      return {
        member_id: m.id,
        full_name: m.full_name,
        role: m.role,
        monthOrders: rep.totalMonthOrders,
        monthEligibleCod: rep.totalMonthEligibleCod,
        incentive2Pct: rep.totalIncentive2Pct,
      };
    });
  }

  return NextResponse.json({
    ...report,
    onboardedLeads,
    recentOrders: myOrders.slice(0, 50),
    extensionToken: member.extension_token,
    canViewTeamMoney: member.role === 'super_admin' || member.role === 'team_leader',
    teamMoneyRollup,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userClient, member } = auth;
  const body = await req.json().catch(() => ({}));

  const externalOrderId = String(body.external_order_id || '').trim();
  const merchantName = String(body.merchant_name || '').trim();
  const orderDate = String(body.order_date || '').trim();
  const codAmount = Number(body.cod_amount);

  if (!externalOrderId || !merchantName || !/^\d{4}-\d{2}-\d{2}$/.test(orderDate) || isNaN(codAmount)) {
    return NextResponse.json(
      { error: 'Order ID, Merchant Name, valid Date (YYYY-MM-DD), and COD Amount are required.' },
      { status: 400 }
    );
  }

  const { standardized } = standardizePhoneField(String(body.merchant_phone || ''));
  const leadId = body.lead_id ? String(body.lead_id) : null;

  const { data, error } = await userClient
    .from('merchant_orders')
    .upsert(
      {
        owner_id: member.id,
        lead_id: leadId,
        merchant_name: merchantName,
        merchant_phone: standardized,
        carrybee_merchant_id: String(body.carrybee_merchant_id || '').trim(),
        external_order_id: externalOrderId,
        order_date: orderDate,
        cod_amount: Math.max(0, codAmount),
        order_status: String(body.order_status || 'confirmed').trim(),
        source: 'manual',
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,external_order_id' }
    )
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ order: data });
}
