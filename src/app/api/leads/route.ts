import { NextRequest, NextResponse } from 'next/server';
import { syncLeadAppendToSheet } from '@/lib/google-bridge';
import { standardizePhoneField } from '@/lib/phone';
import { requireAuthenticatedMember } from '@/lib/supabase/server';
import type { Lead, LeadStage } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userClient, member } = auth;
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();
  const stage = (searchParams.get('stage') || 'all').trim();
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 50)));

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Strict privacy: userClient has RLS (auth.uid() = owner_id) AND explicit owner_id filter
  let query = userClient
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('owner_id', member.id);

  const nowIso = new Date().toISOString();
  const twoDaysAgoIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  if (stage === 'followup_due') {
    query = query
      .neq('stage', 'onboarded')
      .or(
        `and(needs_followup.eq.true,followup_due_at.lte.${nowIso}),and(stage.eq.connected,last_contacted_at.lte.${twoDaysAgoIso})`
      );
  } else if (stage === 'connected') {
    query = query.in('stage', ['connected', 'followup']);
  } else if (stage !== 'all') {
    query = query.eq('stage', stage);
  }

  if (search) {
    const safe = search.replace(/[%_,]/g, ' ').trim();
    const digitsOnly = standardizePhoneField(safe).primaryNormalized;
    if (digitsOnly && digitsOnly.length >= 4) {
      query = query.or(
        `business_name.ilike.%${safe}%,contact_number.ilike.%${digitsOnly}%,contact_person.ilike.%${safe}%,product_category.ilike.%${safe}%,pickup_area.ilike.%${safe}%`
      );
    } else {
      query = query.or(
        `business_name.ilike.%${safe}%,contact_number.ilike.%${safe}%,contact_person.ilike.%${safe}%,product_category.ilike.%${safe}%,pickup_area.ilike.%${safe}%`
      );
    }
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('sheet_row_number', { ascending: true, nullsFirst: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    leads: (data || []) as Lead[],
    total: count || 0,
    page,
    pageSize,
    sheetTabName: member.sheet_tab_name,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userClient, member } = auth;
  const body = await req.json().catch(() => ({}));

  const businessName = String(body.business_name || '').trim();
  if (!businessName) {
    return NextResponse.json({ error: 'Business Name is required.' }, { status: 400 });
  }

  const fbLink = String(body.fb_link || '').trim();
  const contactPerson = String(body.contact_person || '').trim();
  const rawPhone = String(body.contact_number || '').trim();
  const productCategory = String(body.product_category || '').trim();
  const pickupArea = String(body.pickup_area || '').trim();
  const notes = String(body.notes || '').trim();
  const carrybeeMerchantName = String(body.carrybee_merchant_name || '').trim();
  const carrybeeMerchantId = String(body.carrybee_merchant_id || '').trim();

  const validStages: LeadStage[] = ['new', 'connected', 'followup', 'onboarded'];
  const stage: LeadStage = validStages.includes(body.stage) ? body.stage : 'new';
  if (stage === 'connected' || stage === 'followup') {
    return NextResponse.json(
      { error: 'Upload a screenshot or call recording before creating a lead in this stage.' },
      { status: 400 }
    );
  }
  const scheduleFollowup = Boolean(body.needs_followup);

  const { standardized, primaryNormalized } = standardizePhoneField(rawPhone);

  // Prevent duplicate phone number inside user's Lead Bank
  if (primaryNormalized) {
    const { data: existing } = await userClient
      .from('leads')
      .select('id, business_name, contact_number')
      .eq('owner_id', member.id)
      .eq('normalized_phone', primaryNormalized)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          error: `Duplicate phone number (${standardized}) already exists in your Lead Bank under "${existing[0].business_name}".`,
        },
        { status: 409 }
      );
    }
  }

  const now = new Date();
  const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const insertPayload = {
    owner_id: member.id,
    business_name: businessName,
    fb_link: fbLink,
    contact_person: contactPerson,
    contact_number: standardized,
    normalized_phone: primaryNormalized,
    product_category: productCategory,
    pickup_area: pickupArea,
    stage,
    needs_followup: stage === 'onboarded' ? false : scheduleFollowup,
    last_contacted_at: null,
    followup_due_at:
      stage === 'onboarded'
        ? null
        : body.followup_due_at
          ? new Date(body.followup_due_at).toISOString()
          : scheduleFollowup
            ? twoDaysLater.toISOString()
            : null,
    onboarded_at: stage === 'onboarded' ? now.toISOString() : null,
    carrybee_merchant_name: carrybeeMerchantName,
    carrybee_merchant_id: carrybeeMerchantId,
    notes,
  };

  const { data: inserted, error } = await userClient
    .from('leads')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message || 'Failed to save lead' }, { status: 500 });
  }

  // Dual-write to the user's own tab in Google Sheets
  const sheetSync = await syncLeadAppendToSheet(member.sheet_tab_name, inserted as Lead);

  return NextResponse.json({
    lead: inserted as Lead,
    sheetSync,
  });
}
