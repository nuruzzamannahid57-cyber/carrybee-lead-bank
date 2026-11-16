import { NextRequest, NextResponse } from 'next/server';
import { buildMonthlyMoneyReport } from '@/lib/incentives';
import { resolveExtensionMember } from '@/lib/supabase/server';
import type { MerchantOrder } from '@/lib/types';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const resolved = await resolveExtensionMember(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status, headers: corsHeaders }
    );
  }

  const { admin, member } = resolved;

  const { data: merchants } = await admin
    .from('leads')
    .select(
      'id, business_name, contact_number, normalized_phone, carrybee_merchant_name, carrybee_merchant_id, onboarded_at'
    )
    .eq('owner_id', member.id)
    .eq('stage', 'onboarded');

  const onboardedList = merchants || [];
  const onboardedIds = onboardedList.map((m) => m.id);

  const currentMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);

  let eligibleOrders: MerchantOrder[] = [];
  if (onboardedIds.length > 0) {
    const { data: ordersData } = await admin
      .from('merchant_orders')
      .select('*')
      .eq('owner_id', member.id)
      .in('lead_id', onboardedIds);
    eligibleOrders = (ordersData || []) as MerchantOrder[];
  }

  const summary = buildMonthlyMoneyReport(eligibleOrders, currentMonth);

  return NextResponse.json(
    {
      ok: true,
      extensionToken: member.extension_token,
      member: {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
        role: member.role,
      },
      onboardedMerchants: onboardedList,
      onboardedMerchantsCount: onboardedList.length,
      month: currentMonth,
      totalMonthOrders: summary.totalMonthOrders,
      totalMonthEligibleCod: summary.totalMonthEligibleCod,
      totalIncentive2Pct: summary.totalIncentive2Pct,
    },
    { headers: corsHeaders }
  );
}
