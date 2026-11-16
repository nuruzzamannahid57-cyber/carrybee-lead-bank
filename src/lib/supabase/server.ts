import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { TeamMemberProfile } from '../types';

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseWithUserJwt(accessToken: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAuthenticatedMember(req: NextRequest): Promise<
  | { ok: true; accessToken: string; userClient: SupabaseClient; member: TeamMemberProfile }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return { ok: false, status: 401, error: 'Authentication token required. Please sign in.' };
  }

  const userClient = getSupabaseWithUserJwt(token);
  const { data: userRes, error: authErr } = await userClient.auth.getUser(token);
  if (authErr || !userRes?.user) {
    return { ok: false, status: 401, error: 'Invalid or expired session. Please sign in again.' };
  }

  const admin = getSupabaseAdmin();
  const { data: member, error: memberErr } = await admin
    .from('team_members')
    .select('id, full_name, email, role, sheet_tab_name, extension_token, is_active, created_at')
    .eq('id', userRes.user.id)
    .single();

  if (memberErr || !member || !member.is_active) {
    return {
      ok: false,
      status: 403,
      error: 'Your account is not registered in the Carrybee Lead Bank directory.',
    };
  }

  return {
    ok: true,
    accessToken: token,
    userClient,
    member: member as TeamMemberProfile,
  };
}
