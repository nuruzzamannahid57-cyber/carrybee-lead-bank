import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAuthenticatedMember } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userClient, member } = auth;
  const nowIso = new Date().toISOString();
  const twoDaysAgoIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, newRes, connRes, onbRes, dueRes] = await Promise.all([
    userClient.from('leads').select('id', { count: 'exact', head: true }).eq('owner_id', member.id),
    userClient
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', member.id)
      .eq('stage', 'new'),
    userClient
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', member.id)
      .in('stage', ['connected', 'followup']),
    userClient
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', member.id)
      .eq('stage', 'onboarded'),
    userClient
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', member.id)
      .neq('stage', 'onboarded')
      .or(
        `and(needs_followup.eq.true,followup_due_at.lte.${nowIso}),and(stage.eq.connected,last_contacted_at.lte.${twoDaysAgoIso})`
      ),
  ]);

  return NextResponse.json({
    member,
    counts: {
      total: totalRes.count || 0,
      new: newRes.count || 0,
      connected: connRes.count || 0,
      onboarded: onbRes.count || 0,
      followupDue: dueRes.count || 0,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const admin = getSupabaseAdmin();

  if (body.action === 'rotate_extension_token') {
    const newToken = crypto.randomBytes(24).toString('hex');
    const { error } = await admin
      .from('team_members')
      .update({ extension_token: newToken })
      .eq('id', auth.member.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ extension_token: newToken });
  }

  if (body.action === 'change_password') {
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }
    const { error: updErr } = await admin.auth.admin.updateUserById(auth.member.id, {
      password: newPassword,
    });
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    // Sync encrypted bcrypt hash from auth.users via RPC/admin query if needed; store irreversible salted digest marker
    const salt = crypto.randomBytes(12).toString('hex');
    const digest = crypto.scryptSync(newPassword, salt, 32).toString('hex');
    await admin
      .from('team_members')
      .update({ password_hash: `scrypt$${salt}$${digest}` })
      .eq('id', auth.member.id);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
