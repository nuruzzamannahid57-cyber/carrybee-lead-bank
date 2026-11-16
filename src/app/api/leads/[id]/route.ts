import { NextRequest, NextResponse } from 'next/server';
import { syncLeadDeleteFromSheet, syncLeadUpdateInSheet } from '@/lib/google-bridge';
import { standardizePhoneField } from '@/lib/phone';
import { requireAuthenticatedMember } from '@/lib/supabase/server';
import type { Lead, LeadStage } from '@/lib/types';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const { userClient, member } = auth;
  const body = await req.json().catch(() => ({}));

  const { data: current, error: fetchErr } = await userClient
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('owner_id', member.id)
    .single();

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Lead not found in your private list.' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.business_name === 'string' && body.business_name.trim()) {
    updates.business_name = body.business_name.trim();
  }
  if (typeof body.fb_link === 'string') updates.fb_link = body.fb_link.trim();
  if (typeof body.contact_person === 'string') updates.contact_person = body.contact_person.trim();
  if (typeof body.product_category === 'string') {
    updates.product_category = body.product_category.trim();
  }
  if (typeof body.pickup_area === 'string') updates.pickup_area = body.pickup_area.trim();
  if (typeof body.notes === 'string') updates.notes = body.notes.trim();
  if (typeof body.carrybee_merchant_name === 'string') {
    updates.carrybee_merchant_name = body.carrybee_merchant_name.trim();
  }
  if (typeof body.carrybee_merchant_id === 'string') {
    updates.carrybee_merchant_id = body.carrybee_merchant_id.trim();
  }

  if (typeof body.contact_number === 'string') {
    const { standardized, primaryNormalized } = standardizePhoneField(body.contact_number);
    updates.contact_number = standardized;
    updates.normalized_phone = primaryNormalized;
  }

  const now = new Date();
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

  if (typeof body.stage === 'string') {
    const stage = body.stage as LeadStage;
    updates.stage = stage;

    if (stage === 'connected') {
      updates.last_contacted_at = now.toISOString();
      // Automatically schedule a 2-day follow-up reminder unless turned off
      if (body.needs_followup !== false) {
        updates.needs_followup = true;
        updates.followup_due_at = body.followup_due_at
          ? new Date(body.followup_due_at).toISOString()
          : inTwoDays;
      }
    } else if (stage === 'followup') {
      updates.last_contacted_at = now.toISOString();
      updates.needs_followup = true;
      updates.followup_due_at = body.followup_due_at
        ? new Date(body.followup_due_at).toISOString()
        : inTwoDays;
    } else if (stage === 'onboarded') {
      updates.onboarded_at = current.onboarded_at || now.toISOString();
      updates.needs_followup = false;
      updates.followup_due_at = null;
    } else if (stage === 'new') {
      updates.needs_followup = false;
      updates.followup_due_at = null;
    }
  }

  // Quick follow-up reminder actions ("snooze_2_days" / "dismiss_followup")
  if (body.followupAction === 'snooze_2_days') {
    updates.last_contacted_at = now.toISOString();
    updates.needs_followup = true;
    updates.followup_due_at = inTwoDays;
  } else if (body.followupAction === 'dismiss_followup') {
    updates.needs_followup = false;
    updates.followup_due_at = null;
    if (current.stage === 'connected') {
      updates.last_contacted_at = now.toISOString();
    }
  }

  const { data: updated, error: updErr } = await userClient
    .from('leads')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', member.id)
    .select('*')
    .single();

  if (updErr || !updated) {
    return NextResponse.json({ error: updErr?.message || 'Update failed' }, { status: 500 });
  }

  const sheetSync = await syncLeadUpdateInSheet(member.sheet_tab_name, updated as Lead);

  return NextResponse.json({ lead: updated as Lead, sheetSync });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const { userClient, member } = auth;

  const { data: target, error: findErr } = await userClient
    .from('leads')
    .select('id, business_name, contact_number, sheet_row_number')
    .eq('id', id)
    .eq('owner_id', member.id)
    .single();

  if (findErr || !target) {
    return NextResponse.json({ error: 'Lead not found in your private list.' }, { status: 404 });
  }

  const { error: delErr } = await userClient
    .from('leads')
    .delete()
    .eq('id', id)
    .eq('owner_id', member.id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const sheetSync = await syncLeadDeleteFromSheet(member.sheet_tab_name, target);

  return NextResponse.json({ ok: true, sheetSync });
}
