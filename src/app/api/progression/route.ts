import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedMember } from '@/lib/supabase/server';
import type { Lead, TeamProgressionRow } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userClient, member } = auth;
  const nowIso = new Date().toISOString();
  const twoDaysAgoIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Aggregate progression counts via SECURITY DEFINER RPC:
  //    - Super Admin & Team Leader receive everyone's aggregate counts ONLY (zero private lead rows)
  //    - Team Member receives only their own row
  const { data: teamRows, error: rpcErr } = await userClient.rpc('get_team_progression');
  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  // 2. Caller's own 2-day follow-up reminder queue (due now + upcoming scheduled)
  const [dueRes, upcomingRes] = await Promise.all([
    userClient
      .from('leads')
      .select('*')
      .eq('owner_id', member.id)
      .neq('stage', 'onboarded')
      .or(
        `and(needs_followup.eq.true,followup_due_at.lte.${nowIso}),and(stage.eq.connected,last_contacted_at.lte.${twoDaysAgoIso})`
      )
      .order('followup_due_at', { ascending: true, nullsFirst: false })
      .limit(50),
    userClient
      .from('leads')
      .select('*')
      .eq('owner_id', member.id)
      .neq('stage', 'onboarded')
      .eq('needs_followup', true)
      .gt('followup_due_at', nowIso)
      .order('followup_due_at', { ascending: true })
      .limit(25),
  ]);

  const normalizedTeam: TeamProgressionRow[] = (teamRows || []).map((r: Record<string, unknown>) => ({
    member_id: String(r.member_id),
    full_name: String(r.full_name),
    email: String(r.email),
    role: r.role as TeamProgressionRow['role'],
    sheet_tab_name: String(r.sheet_tab_name),
    total_leads: Number(r.total_leads || 0),
    new_leads: Number(r.new_leads || 0),
    connected_leads: Number(r.connected_leads || 0),
    followup_due_leads: Number(r.followup_due_leads || 0),
    onboarded_leads: Number(r.onboarded_leads || 0),
    added_today: Number(r.added_today || 0),
    added_this_month: Number(r.added_this_month || 0),
  }));

  const myRow =
    normalizedTeam.find((r) => r.member_id === member.id) || {
      member_id: member.id,
      full_name: member.full_name,
      email: member.email,
      role: member.role,
      sheet_tab_name: member.sheet_tab_name,
      total_leads: 0,
      new_leads: 0,
      connected_leads: 0,
      followup_due_leads: 0,
      onboarded_leads: 0,
      added_today: 0,
      added_this_month: 0,
    };

  return NextResponse.json({
    myProgression: myRow,
    canViewTeamOverview: member.role === 'super_admin' || member.role === 'team_leader',
    teamProgression: normalizedTeam,
    dueFollowups: (dueRes.data || []) as Lead[],
    upcomingFollowups: (upcomingRes.data || []) as Lead[],
  });
}
