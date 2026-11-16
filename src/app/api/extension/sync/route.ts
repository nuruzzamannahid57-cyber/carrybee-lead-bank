import { NextRequest, NextResponse } from 'next/server';
import { buildMonthlyMoneyReport } from '@/lib/incentives';
import { standardizePhoneField } from '@/lib/phone';
import { resolveExtensionMember } from '@/lib/supabase/server';
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
    .replace(/m\.\s*order\s*id.*$/i, '')
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, '')
    .trim();
}

function extractNameVariants(raw: string): string[] {
  const cleaned = (raw || '')
    .replace(/m\.\s*order\s*id.*$/i, '')
    .trim();
  if (!cleaned) return [];

  const variants = new Set<string>();
  const full = normalizeName(cleaned);
  if (full.length >= 3) variants.add(full);

  // If Hive displays "Business Name (Store Alias)", index both parts cleanly
  const parenMatch = cleaned.match(/^(.+?)\((.+?)\)/);
  if (parenMatch) {
    const outer = normalizeName(parenMatch[1]);
    const inner = normalizeName(parenMatch[2]);
    if (outer.length >= 3) variants.add(outer);
    if (inner.length >= 3) variants.add(inner);
  }

  return Array.from(variants);
}

export async function POST(req: NextRequest) {
  const resolved = await resolveExtensionMember(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status, headers: corsHeaders }
    );
  }

  const { admin, member } = resolved;

  const body = await req.json().catch(() => ({}));
  const rawOrders = Array.isArray(body.orders) ? body.orders : [];

  // STRICT RULE: Only merchants marked 'onboarded' in this member's Lead Bank Dashboard are eligible for COD tracking
  const { data: onboarded } = await admin
    .from('leads')
    .select(
      'id, business_name, contact_number, normalized_phone, carrybee_merchant_name, carrybee_merchant_id, onboarded_at'
    )
    .eq('owner_id', member.id)
    .eq('stage', 'onboarded');

  const onboardedList = onboarded || [];
  const onboardedIds = onboardedList.map((l) => l.id);

  const currentMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);

  // Fast-path: If 0 merchants are marked Onboarded in the Dashboard, 0 COD is ever synced or shown
  if (onboardedList.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        extensionToken: member.extension_token,
        member: {
          full_name: member.full_name,
          role: member.role,
        },
        onboardedMerchantsCount: 0,
        syncedOrders: 0,
        matchedCount: 0,
        skippedUnmatched: rawOrders.length,
        month: currentMonth,
        totalMonthOrders: 0,
        totalMonthEligibleCod: 0,
        totalIncentive2Pct: 0,
      },
      { headers: corsHeaders }
    );
  }

  // Precompute normalized phones and name variants for every onboarded merchant
  const indexedLeads = onboardedList.map((l) => {
    const phones = new Set<string>(standardizePhoneField(l.contact_number || '').allNormalized);
    if (l.normalized_phone) {
      for (const p of standardizePhoneField(l.normalized_phone).allNormalized) {
        phones.add(p);
      }
    }
    const names = new Set<string>([
      ...extractNameVariants(l.business_name || ''),
      ...extractNameVariants(l.carrybee_merchant_name || ''),
    ]);
    return {
      lead: l,
      cbId: (l.carrybee_merchant_id || '').trim().toLowerCase(),
      phones,
      names,
    };
  });

  const dedupedUpsertMap = new Map<string, Record<string, unknown>>();
  let matchedCount = 0;
  let skippedUnmatched = 0;

  for (const item of rawOrders) {
    const extId = String(item.external_order_id || item.order_id || '').trim();
    const mName = String(item.merchant_name || item.store_name || '').trim();
    const rawDate = String(item.order_date || '').slice(0, 10);
    const cod = Number(String(item.cod_amount ?? 0).replace(/[^0-9.-]/g, '')) || 0;
    const incomingPhones = standardizePhoneField(String(item.merchant_phone || '')).allNormalized;
    const mCbId = String(item.carrybee_merchant_id || '')
      .trim()
      .toLowerCase();
    const statusClean = String(item.order_status || 'confirmed').trim();
    const statusLower = statusClean.toLowerCase();

    if (!extId || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) continue;
    if (
      statusLower.includes('cancel') ||
      statusLower.includes('return') ||
      statusLower.includes('reverse')
    ) {
      continue;
    }

    const incomingNames = extractNameVariants(mName);
    if (item.merchant_store_alias) {
      for (const v of extractNameVariants(String(item.merchant_store_alias))) {
        if (!incomingNames.includes(v)) incomingNames.push(v);
      }
    }

    const matchedEntry = indexedLeads.find((entry) => {
      if (mCbId && entry.cbId && entry.cbId === mCbId) return true;
      for (const ph of incomingPhones) {
        if (ph && entry.phones.has(ph)) return true;
      }
      for (const nm of incomingNames) {
        if (nm && entry.names.has(nm)) return true;
      }
      return false;
    });

    // STRICT ONBOARDED-ONLY ENFORCEMENT: Never store or count orders for non-onboarded merchants
    if (!matchedEntry) {
      skippedUnmatched += 1;
      continue;
    }

    const matchedLead = matchedEntry.lead;
    matchedCount += 1;
    dedupedUpsertMap.set(extId, {
      owner_id: member.id,
      lead_id: matchedLead.id,
      merchant_name: matchedLead.business_name,
      merchant_phone: matchedLead.contact_number || incomingPhones[0] || '',
      carrybee_merchant_id: mCbId || matchedLead.carrybee_merchant_id || '',
      external_order_id: extId,
      order_date: rawDate,
      cod_amount: Math.max(0, Math.round(cod * 100) / 100),
      order_status: statusClean,
      source: 'carrybee_extension',
      synced_at: new Date().toISOString(),
    });
  }

  const toUpsert = Array.from(dedupedUpsertMap.values());

  if (toUpsert.length > 0) {
    const { error: upErr } = await admin
      .from('merchant_orders')
      .upsert(toUpsert, { onConflict: 'owner_id,external_order_id' });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500, headers: corsHeaders });
    }
  }

  const { data: allMyOnboardedOrders } = await admin
    .from('merchant_orders')
    .select('*')
    .eq('owner_id', member.id)
    .in('lead_id', onboardedIds);

  const summary = buildMonthlyMoneyReport(
    (allMyOnboardedOrders || []) as MerchantOrder[],
    currentMonth
  );

  return NextResponse.json(
    {
      ok: true,
      extensionToken: member.extension_token,
      member: {
        full_name: member.full_name,
        role: member.role,
      },
      onboardedMerchantsCount: onboardedList.length,
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
