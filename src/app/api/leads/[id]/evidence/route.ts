import { NextRequest, NextResponse } from 'next/server';
import { syncLeadUpdateInSheet } from '@/lib/google-bridge';
import { getSupabaseAdmin, requireAuthenticatedMember } from '@/lib/supabase/server';
import type { Lead } from '@/lib/types';

const BUCKET = 'lead-evidence';
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg',
]);

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const { data: lead, error: leadErr } = await auth.userClient
    .from('leads').select('id').eq('id', id).eq('owner_id', auth.member.id).maybeSingle();
  if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found in your private list.' }, { status: 404 });

  const { data: rows, error } = await auth.userClient
    .from('lead_stage_evidence')
    .select('id,stage,file_path,original_name,mime_type,original_size_bytes,stored_size_bytes,created_at')
    .eq('lead_id', id)
    .eq('owner_id', auth.member.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load lead evidence.' }, { status: 500 });

  const admin = getSupabaseAdmin();
  const evidence = await Promise.all((rows || []).map(async (row) => {
    const storedExtension = row.file_path.split('.').pop() || 'bin';
    const downloadName = `${row.original_name.replace(/\.[^.]+$/, '') || 'evidence'}.${storedExtension}`;
    const { data: signed, error: signErr } = await admin.storage.from(BUCKET).createSignedUrl(row.file_path, 120, { download: downloadName });
    return signErr || !signed ? null : { ...row, download_url: signed.signedUrl };
  }));
  return NextResponse.json({ evidence: evidence.filter(Boolean) });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const stage = body.stage;
  const attachOnly = body.attach_only === true;
  const filePath = String(body.file_path || '');
  const originalName = String(body.original_name || '').trim();
  const mimeType = String(body.mime_type || '').toLowerCase();
  const originalSize = Number(body.original_size_bytes);
  const storedSize = Number(body.stored_size_bytes);

  if (attachOnly ? stage !== 'onboarded' : stage !== 'connected' && stage !== 'followup') {
    return NextResponse.json({ error: 'Evidence can be attached to an onboarded lead or submitted while moving to Connected or Follow-Up.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(mimeType) || !Number.isFinite(originalSize) || originalSize <= 0 || originalSize > MAX_BYTES || !Number.isFinite(storedSize) || storedSize <= 0 || storedSize > MAX_BYTES) {
    return NextResponse.json({ error: 'Unsupported evidence file or size. Files must be compressed and no larger than 20 MB.' }, { status: 400 });
  }
  if (!originalName || originalName.length > 255 || /[\r\n]/.test(originalName)) {
    return NextResponse.json({ error: 'Invalid original filename.' }, { status: 400 });
  }
  const pathParts = filePath.split('/');
  const [ownerFolder, leadFolder, storedName] = pathParts;
  if (pathParts.length !== 3 || ownerFolder !== auth.member.id || leadFolder !== id || !/^[a-f0-9-]{36}\.(webp|jpg|mp3|m4a|ogg|webm)$/.test(storedName || '')) {
    return NextResponse.json({ error: 'Invalid private evidence path.' }, { status: 400 });
  }

  const { data: lead, error: leadErr } = await auth.userClient
    .from('leads').select('*').eq('id', id).eq('owner_id', auth.member.id).maybeSingle();
  if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found in your private list.' }, { status: 404 });
  if (attachOnly && lead.stage !== 'onboarded') {
    return NextResponse.json({ error: 'Standalone evidence can only be added to an onboarded lead.' }, { status: 409 });
  }

  const admin = getSupabaseAdmin();
  const folder = `${auth.member.id}/${id}`;
  const { data: objects, error: objectErr } = await admin.storage.from(BUCKET).list(folder, { limit: 100, search: storedName });
  const storedObject = (objects || []).find((object) => object.name === storedName);
  if (objectErr || !storedObject) return NextResponse.json({ error: 'Uploaded evidence file was not found in private storage.' }, { status: 400 });
  const actualStoredSize = Number(storedObject.metadata?.size || 0);
  if (actualStoredSize !== storedSize || actualStoredSize > MAX_BYTES) {
    await admin.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json({ error: 'Evidence size verification failed. Please upload again.' }, { status: 400 });
  }

  if (attachOnly) {
    const { data: evidence, error: evidenceErr } = await auth.userClient
      .from('lead_stage_evidence')
      .insert({
        lead_id: id,
        owner_id: auth.member.id,
        stage: 'onboarded',
        file_path: filePath,
        original_name: originalName,
        mime_type: mimeType,
        original_size_bytes: originalSize,
        stored_size_bytes: storedSize,
      })
      .select('id,stage,original_name,mime_type,original_size_bytes,stored_size_bytes,created_at')
      .single();
    if (evidenceErr || !evidence) {
      await admin.storage.from(BUCKET).remove([filePath]);
      return NextResponse.json({ error: evidenceErr?.message || 'Could not save evidence metadata.' }, { status: 500 });
    }
    return NextResponse.json({ lead: lead as Lead, evidence });
  }

  const now = new Date();
  const dueAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: evidence, error: evidenceErr } = await auth.userClient
    .from('lead_stage_evidence')
    .insert({
      lead_id: id,
      owner_id: auth.member.id,
      stage,
      file_path: filePath,
      original_name: originalName,
      mime_type: mimeType,
      original_size_bytes: originalSize,
      stored_size_bytes: storedSize,
    })
    .select('id,stage,original_name,mime_type,original_size_bytes,stored_size_bytes,created_at')
    .single();
  if (evidenceErr || !evidence) {
    await admin.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json({ error: evidenceErr?.message || 'Could not save evidence metadata.' }, { status: 500 });
  }

  const { data: updated, error: updateErr } = await auth.userClient
    .from('leads')
    .update({
      stage,
      last_contacted_at: now.toISOString(),
      needs_followup: true,
      followup_due_at: dueAt,
      updated_at: now.toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', auth.member.id)
    .select('*')
    .single();
  if (updateErr || !updated) {
    await auth.userClient.from('lead_stage_evidence').delete().eq('id', evidence.id).eq('owner_id', auth.member.id);
    await admin.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json({ error: updateErr?.message || 'Could not update lead stage.' }, { status: 500 });
  }

  const sheetSync = await syncLeadUpdateInSheet(auth.member.sheet_tab_name, updated as Lead);
  return NextResponse.json({ lead: updated as Lead, evidence, sheetSync });
}
