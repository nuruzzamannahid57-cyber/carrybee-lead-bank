'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  PhoneCall,
  CheckCircle2,
  BellRing,
  Clock,
  Lock,
  RefreshCw,
  ArrowUpRight,
} from 'lucide-react';
import type { Lead, TeamMemberProfile, TeamProgressionRow } from '@/lib/types';

interface ProgressionTabProps {
  accessToken: string;
  member: TeamMemberProfile;
  onCountsChanged: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  team_leader: 'Team Leader',
  team_member: 'Team Member',
};

export default function ProgressionTab({
  accessToken,
  member,
  onCountsChanged,
}: ProgressionTabProps) {
  const [loading, setLoading] = useState(true);
  const [myRow, setMyRow] = useState<TeamProgressionRow | null>(null);
  const [canViewTeam, setCanViewTeam] = useState(false);
  const [teamRows, setTeamRows] = useState<TeamProgressionRow[]>([]);
  const [dueFollowups, setDueFollowups] = useState<Lead[]>([]);
  const [upcomingFollowups, setUpcomingFollowups] = useState<Lead[]>([]);

  const loadProgression = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/progression', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMyRow(data.myProgression);
        setCanViewTeam(Boolean(data.canViewTeamOverview));
        setTeamRows(data.teamProgression || []);
        setDueFollowups(data.dueFollowups || []);
        setUpcomingFollowups(data.upcomingFollowups || []);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadProgression();
  }, [loadProgression]);

  async function handleFollowupAction(
    leadId: string,
    action: 'snooze_2_days' | 'dismiss_followup' | 'onboard'
  ) {
    const payload =
      action === 'onboard'
        ? { stage: 'onboarded' }
        : { followupAction: action };
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      loadProgression();
      onCountsChanged();
    }
  }

  const totalLeads = myRow?.total_leads || 0;
  const newCount = myRow?.new_leads || 0;
  const connectedCount = myRow?.connected_leads || 0;
  const onboardedCount = myRow?.onboarded_leads || 0;
  const followupDueCount = myRow?.followup_due_leads || 0;
  const conversionPct = totalLeads > 0 ? ((onboardedCount / totalLeads) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Personal Progression Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#0F172A]">
            My Acquisition Progression — {member.full_name}
          </h2>
          <p className="text-xs text-[#475569]">
            Live stage counts from your private Lead Bank ({member.sheet_tab_name}) with automatic
            48-hour follow-up reminders.
          </p>
        </div>
        <button
          type="button"
          onClick={loadProgression}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Refresh Counts</span>
        </button>
      </div>

      {/* 4 Formal KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
              New Leads Collected
            </span>
            <Users className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
            {loading ? '...' : totalLeads.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[#475569]">
            <span className="font-semibold text-[#0F172A]">{newCount.toLocaleString()}</span>{' '}
            uncontacted · +{myRow?.added_today || 0} today
          </p>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
              Connected Leads
            </span>
            <PhoneCall className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#1D4ED8]">
            {loading ? '...' : connectedCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[#475569]">
            In active discussion &amp; 2-day follow-up cycle
          </p>
        </div>

        <div
          className={`rounded-lg border p-5 ${
            followupDueCount > 0
              ? 'border-[#FDE68A] bg-[#FFFBEB]'
              : 'border-[#E2E8F0] bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#92400E]">
              2-Day Follow-Up Due
            </span>
            <BellRing className="h-4 w-4 text-[#B45309]" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#92400E]">
            {loading ? '...' : followupDueCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[#92400E]">
            {upcomingFollowups.length} more scheduled within 48h
          </p>
        </div>

        <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5]/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#065F46]">
              Onboarded Merchants
            </span>
            <CheckCircle2 className="h-4 w-4 text-[#059669]" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#059669]">
            {loading ? '...' : onboardedCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[#065F46]">
            Conversion rate: <strong>{conversionPct}%</strong>
          </p>
        </div>
      </div>

      {/* 2-Day Follow-Up Reminder Engine Queue */}
      <div className="rounded-lg border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#B45309]" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[#0F172A]">
              2-Day Follow-Up Reminder Queue
            </h3>
            <span className="rounded border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#92400E]">
              {dueFollowups.length} Due Now
            </span>
          </div>
          <span className="text-xs text-[#475569]">
            Automatically triggers 2 days after marking a business Connected or Follow-Up
          </span>
        </div>

        {dueFollowups.length === 0 && upcomingFollowups.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-[#475569]">
            No overdue 2-day follow-ups right now. Mark any lead as &ldquo;Connected&rdquo; or
            &ldquo;Follow-Up (2d)&rdquo; in your Lead Bank and the portal will remind you
            automatically after 2 days.
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {dueFollowups.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-3 bg-[#FFFBEB]/40 px-5 py-3.5 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#B45309] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      Due Now
                    </span>
                    <span className="text-xs font-bold text-[#0F172A]">{item.business_name}</span>
                    {item.contact_number && (
                      <span className="font-mono text-xs text-[#334155]">
                        · {item.contact_number}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#475569]">
                    Contact: {item.contact_person || '—'} · Area: {item.pickup_area || '—'} · Due:{' '}
                    {item.followup_due_at
                      ? new Date(item.followup_due_at).toLocaleString('en-GB')
                      : '2+ days since last contact'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleFollowupAction(item.id, 'snooze_2_days')}
                    className="cursor-pointer rounded border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
                  >
                    Followed Up (+2d)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFollowupAction(item.id, 'onboard')}
                    className="inline-flex cursor-pointer items-center gap-1 rounded bg-[#059669] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#047857]"
                  >
                    <span>Mark Onboarded</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFollowupAction(item.id, 'dismiss_followup')}
                    className="cursor-pointer rounded px-2 py-1 text-xs font-medium text-[#64748B] hover:text-[#0F172A]"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ))}

            {upcomingFollowups.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-2 px-5 py-3 text-xs sm:flex-row sm:items-center"
              >
                <div>
                  <span className="rounded border border-[#CBD5E1] bg-[#F8FAFC] px-1.5 py-0.5 text-[10px] font-semibold text-[#475569]">
                    Scheduled
                  </span>{' '}
                  <strong className="ml-1 text-[#0F172A]">{item.business_name}</strong>
                  <span className="ml-2 font-mono text-[#475569]">{item.contact_number}</span>
                </div>
                <span className="font-mono text-[11px] text-[#475569]">
                  Reminds on{' '}
                  {item.followup_due_at
                    ? new Date(item.followup_due_at).toLocaleString('en-GB')
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Leader & Super Admin Aggregate Team Progression Table */}
      {canViewTeam ? (
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">
                Overall Team Progression (Aggregate Counts Only)
              </h3>
              <p className="mt-0.5 text-xs text-[#475569]">
                Visible to Team Leader &amp; Super Admin. Individual member lead lists remain
                strictly private and inaccessible.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8]">
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>Lead Rows Hidden · Counts Only</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-white text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                  <th className="px-5 py-3">Team Member</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Sheet Tab</th>
                  <th className="px-3 py-3 text-right">Total Collected</th>
                  <th className="px-3 py-3 text-right">New</th>
                  <th className="px-3 py-3 text-right">Connected</th>
                  <th className="px-3 py-3 text-right">2-Day Follow-Up Due</th>
                  <th className="px-3 py-3 text-right">Onboarded</th>
                  <th className="px-5 py-3 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {teamRows.map((row) => {
                  const conv =
                    row.total_leads > 0
                      ? ((row.onboarded_leads / row.total_leads) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <tr key={row.member_id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-semibold text-[#0F172A]">
                        <div>{row.full_name}</div>
                        <div className="font-normal text-[#64748B]">{row.email}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded border border-[#CBD5E1] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-semibold text-[#334155]">
                          {ROLE_LABELS[row.role] || row.role}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-[#475569]">
                        {row.sheet_tab_name}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-[#0F172A]">
                        {row.total_leads.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-[#475569]">
                        {row.new_leads.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-[#1D4ED8]">
                        {row.connected_leads.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-[#B45309]">
                        {row.followup_due_leads.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-[#059669]">
                        {row.onboarded_leads.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-[#0F172A]">
                        {conv}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#CBD5E1] bg-[#F8FAFC] font-bold text-[#0F172A]">
                  <td colSpan={3} className="px-5 py-3">
                    Team Total ({teamRows.length} Active Members)
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {teamRows.reduce((s, r) => s + r.total_leads, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {teamRows.reduce((s, r) => s + r.new_leads, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-[#1D4ED8]">
                    {teamRows.reduce((s, r) => s + r.connected_leads, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-[#B45309]">
                    {teamRows.reduce((s, r) => s + r.followup_due_leads, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-[#059669]">
                    {teamRows.reduce((s, r) => s + r.onboarded_leads, 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] bg-white p-4 text-xs text-[#475569]">
          <Lock className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden="true" />
          <span>
            Role Permission Notice: Team-wide aggregate counts are restricted to Team Leader and
            Super Admin accounts.
          </span>
        </div>
      )}
    </div>
  );
}
