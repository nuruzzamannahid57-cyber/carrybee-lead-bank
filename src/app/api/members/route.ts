import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { provisionSheetTabAndSendConfidentialEmail } from '@/lib/google-bridge';
import { getSupabaseAdmin, requireAuthenticatedMember } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types';

function generateConfidentialPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%';
  const all = upper + lower + digits + symbols;
  const pick = (pool: string) => pool[crypto.randomInt(0, pool.length)];

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = 0; i < 10; i++) {
    chars.push(pick(all));
  }
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (auth.member.role !== 'super_admin' && auth.member.role !== 'team_leader') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('team_members')
    .select('id, full_name, email, role, sheet_tab_name, is_active, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ members: data || [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (auth.member.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Only Super Admin can provision new team members.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const fullName = String(body.full_name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const validRoles: UserRole[] = ['team_member', 'team_leader', 'super_admin'];
  const role: UserRole = validRoles.includes(body.role) ? body.role : 'team_member';
  const sheetTabName = String(body.sheet_tab_name || fullName).trim();

  if (!fullName || !email.includes('@') || !sheetTabName) {
    return NextResponse.json(
      { error: 'Full Name and valid Email are required.' },
      { status: 400 }
    );
  }

  // Generate confidential password strictly in server memory — NEVER logged or returned in JSON!
  const generatedPassword = generateConfidentialPassword();
  const admin = getSupabaseAdmin();

  const { data: createdAuth, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      sheet_tab_name: sheetTabName,
    },
  });

  if (createErr || !createdAuth?.user) {
    return NextResponse.json(
      { error: createErr?.message || 'Failed to create Supabase Auth user' },
      { status: 400 }
    );
  }

  // Store only irreversible salted scrypt password hash in public.team_members
  const salt = crypto.randomBytes(12).toString('hex');
  const digest = crypto.scryptSync(generatedPassword, salt, 32).toString('hex');

  const { data: newMember, error: insErr } = await admin
    .from('team_members')
    .insert({
      id: createdAuth.user.id,
      full_name: fullName,
      email,
      role,
      sheet_tab_name: sheetTabName,
      password_hash: `scrypt$${salt}$${digest}`,
    })
    .select('id, full_name, email, role, sheet_tab_name, is_active, created_at')
    .single();

  if (insErr) {
    await admin.auth.admin.deleteUser(createdAuth.user.id);
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  const origin =
    req.headers.get('origin') ||
    `https://${req.headers.get('host') || 'carrybee-lead-bank-gamma.vercel.app'}`;

  const roleLabels: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    team_leader: 'Team Leader',
    team_member: 'Team Member',
  };

  const bridgeDelivery = await provisionSheetTabAndSendConfidentialEmail({
    fullName,
    email,
    roleLabel: roleLabels[role],
    sheetTabName,
    plainPassword: generatedPassword,
    dashboardUrl: origin,
  });

  return NextResponse.json({
    member: newMember,
    provisioning: bridgeDelivery,
  });
}
