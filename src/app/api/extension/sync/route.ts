import { NextRequest, NextResponse } from 'next/server';
import { buildMonthlyMoneyReport } from '@/lib/incentives';
import { standardizePhoneField } from '@/lib/phone';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import type { MerchantOrder } from '@/lib/types';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function normalizeName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, '')
    .trim();
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const extToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!extToken) {
    return NextResponse.json(
      { error: 'Missing Extension Sync Token' },
      { status: 401, headers: corsHeaders }
    );
  }

  const admin = getSupabaseAdmin();
  const { data: member } = await admin
    .from('team_members')
    .select('id, full_name, role')
    .eq('extension_token', extToken)
    .eq('is_active', true)
    .single();

  if (!member) {
    return NextResponse.json(
      { error: 'Invalid Extension Sync Token' },
      { status: 401, headers: corsHeaders }
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawOrders = Array.isArray(body.orders) ? body.orders : [];
  const syncOnlyOnboarded = body.matchOnlyOnboarded !== false;

  const { data: onboarded } = await admin
    .from('leads')
    .select(
      'id, business_name, contact_number, normalized_phone, carrybee_merchant_name, carrybee_merchant_id'
    )
    .eq('owner_id', member.id)
    .eq('stage', 'onboarded');

  const onboardedList = onboarded || [];

  const toUpsert: Array<Record<string, unknown>> = [];
  let matchedCount = 0;
  let skippedUnmatched = 0;

  for (const item of rawOrders) {
    const extId = String(item.external_order_id || item.order_id || '').trim();
    const mName = String(item.merchant_name || item.store_name || '').trim();
    const rawDate = String(item.order_date || '').slice(0, 10);
    const cod = Number(String(item.cod_amount ?? 0).replace(/[^0-9.-]/g, '')) || 0;
    const mPhoneStd = standardizePhoneField(String(item.merchant_phone || '')).primaryNormalized;
    const mCbId = String(item.carrybee_merchant_id || '').trim();

    if (!extId || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) continue;

    // Match against user's onboarded merchants by Carrybee ID, normalized phone, or business/store name
    const normIncomingName = normalizeName(mName);
    const matchedLead = onboardedList.find((l) => {
      if (mCbId && l.carrybee_merchant_id && l.carrybee_merchant_id.trim() === mCbId) return true;
      if (mPhoneStd && l.normalized_phone && l.normalized_phone === mPhoneStd) return true;
      if (normIncomingName && normIncomingName.length >= 3) {
        const bNorm = normalizeName(l.business_name);
        const cbNorm = normalizeName(l.carrybee_merchant_name);
        if (bNorm === normIncomingName || (cbNorm && cbNorm === normIncomingName)) return true;
      }
      return false;
    });

    if (!matchedLead && syncOnlyOnboarded && onboardedList.length > 0) {
      skippedUnmatched += 1;
      continue;
    }

    matchedCount += 1;
    toUpsert.push({
      owner_id: member.id,
      lead_id: matchedLead ? matchedLead.id : null,
      merchant_name: matchedLead ? matchedLead.business_name : mName || 'Carrybee Merchant',
      merchant_phone: matchedLead ? matchedLead.contact_number : mPhoneStd,
      carrybee_merchant_id: mCbId || (matchedLead ? matchedLead.carrybee_merchant_id : ''),
      external_order_id: extId,
      order_date: rawDate,
      cod_amount: Math.max(0, cod),
      order_status: String(item.order_status || 'confirmed').trim(),
      source: 'carrybee_extension',
      synced_at: new Date().toISOString(),
    });
  }

  if (toUpsert.length > 0) {
    const { error: upErr } = await admin
      .from('merchant_orders')
      .upsert(toUpsert, { onConflict: 'owner_id,external_order_id' });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500, headers: corsHeaders });
    }
  }

  const currentMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);

  const { data: allMyOrders } = await admin
    .from('merchant_orders')
    .select('*')
    .eq('owner_id', member.id);

  const summary = buildMonthlyMoneyReport((allMyOrders || []) as MerchantOrder[], currentMonth);

  return NextResponse.json(
    {
      ok: true,
      syncedOrders: toUpsert.length,
      matchedCount,
      skippedUnmatched,
      month: currentMonth,
      totalMonthOrders: summary.totalMonthOrders,
      totalMonthEligibleCod: summary.totalMonthEligibleCod,
      totalIncentive2Pct: summary.totalIncentive2Pct,
    },
    { headers: corsHeaders }
  );
}
