'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Database,
  BarChart3,
  BadgeDollarSign,
  Users,
  BellRing,
  LogOut,
  KeyRound,
  X,
} from 'lucide-react';
import AdminTeamTab from '@/components/AdminTeamTab';
import LeadBankTab from '@/components/LeadBankTab';
import LoginView from '@/components/LoginView';
import MoneyTab from '@/components/MoneyTab';
import ProgressionTab from '@/components/ProgressionTab';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { TeamMemberProfile } from '@/lib/types';

type ActiveTab = 'leads' | 'progression' | 'money' | 'admin';

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  super_admin: {
    label: 'Super Admin',
    cls: 'border-[#1E3A8A] bg-[#1E3A8A] text-white',
  },
  team_leader: {
    label: 'Team Leader',
    cls: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]',
  },
  team_member: {
    label: 'Team Member',
    cls: 'border-[#CBD5E1] bg-[#F8FAFC] text-[#334155]',
  },
};

export default function DashboardHomePage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [member, setMember] = useState<TeamMemberProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('leads');
  const [counts, setCounts] = useState({
    total: 0,
    new: 0,
    connected: 0,
    onboarded: 0,
    followupDue: 0,
  });

  // Self-service change password modal
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const loadMemberProfile = useCallback(async (token: string) => {
    setAuthError(null);
    const res = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || 'Unauthorized');
      setMember(null);
      return;
    }
    setMember(data.member);
    if (data.counts) setCounts(data.counts);

    // Zero-token automatic pairing bridge for Carrybee COD Tracker Chrome Extension
    if (typeof window !== 'undefined' && data.member?.extension_token) {
      const bridgePayload = {
        dashboardUrl: window.location.origin,
        extensionToken: data.member.extension_token,
        member: {
          id: data.member.id,
          full_name: data.member.full_name,
          email: data.member.email,
          role: data.member.role,
        },
        onboardedCount: data.counts?.onboarded || 0,
        updatedAt: Date.now(),
      };
      try {
        window.localStorage.setItem('carrybee_ext_bridge', JSON.stringify(bridgePayload));
        window.postMessage(
          {
            source: 'CARRYBEE_DASHBOARD_BRIDGE',
            type: 'DASHBOARD_STATE_SYNC',
            payload: bridgePayload,
          },
          '*'
        );
      } catch {
        // Ignore storage quota issues in restricted frames
      }
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const tok = data.session?.access_token || null;
      setSessionToken(tok);
      if (tok) {
        loadMemberProfile(tok).finally(() => setCheckingAuth(false));
      } else {
        setCheckingAuth(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const tok = session?.access_token || null;
      setSessionToken(tok);
      if (tok) {
        loadMemberProfile(tok);
      } else {
        setMember(null);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadMemberProfile]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('carrybee_ext_bridge');
        window.postMessage(
          { source: 'CARRYBEE_DASHBOARD_BRIDGE', type: 'DASHBOARD_LOGOUT' },
          '*'
        );
      } catch {
        // Ignore
      }
    }
    setSessionToken(null);
    setMember(null);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    setPwMsg(null);
    const res = await fetch('/api/me', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ action: 'change_password', newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setPwMsg('Your confidential password has been updated in Supabase.');
      setNewPassword('');
      setTimeout(() => {
        setPwModalOpen(false);
        setPwMsg(null);
      }, 1500);
    } else {
      setPwMsg(data.error || 'Failed to update password');
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm font-medium text-[#475569]">
        Initializing Carrybee Lead Bank Portal...
      </div>
    );
  }

  if (!sessionToken || !member) {
    return (
      <div>
        {authError && (
          <div className="bg-[#FEF2F2] px-4 py-2 text-center text-xs font-medium text-[#991B1B]">
            {authError}
          </div>
        )}
        <LoginView
          onLoginSuccess={async () => {
            const supabase = getSupabaseBrowserClient();
            const { data } = await supabase.auth.getSession();
            if (data.session?.access_token) {
              setSessionToken(data.session.access_token);
              loadMemberProfile(data.session.access_token);
            }
          }}
        />
      </div>
    );
  }

  const badge = ROLE_BADGE[member.role] || ROLE_BADGE.team_member;

  return (
    <div className="app-shell dashboard-shell min-h-screen">
      {/* Formal Corporate Top Bar */}
      <header className="glass-header border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1E3A8A] text-white">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-[#0F172A]">
                  Carrybee Lead Bank
                </h1>
                <span
                  className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
              <p className="text-xs text-[#475569]">
                Signed in as <strong className="text-[#0F172A]">{member.full_name}</strong> (
                {member.email})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPwModalOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Change Password</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav aria-label="Dashboard sections" className="-mb-px flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('leads')}
              className={`inline-flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors duration-150 ${
                activeTab === 'leads'
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              <Database className="h-4 w-4" aria-hidden="true" />
              <span>My Lead Bank</span>
              <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-[#334155]">
                {counts.total.toLocaleString()}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('progression')}
              className={`inline-flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors duration-150 ${
                activeTab === 'progression'
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <span>Progression &amp; Follow-Ups</span>
              {counts.followupDue > 0 && (
                <span className="rounded bg-[#B45309] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  {counts.followupDue} Due
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('money')}
              className={`inline-flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors duration-150 ${
                activeTab === 'money'
                  ? 'border-[#059669] text-[#059669]'
                  : 'border-transparent text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              <BadgeDollarSign className="h-4 w-4" aria-hidden="true" />
              <span>Money (COD &amp; 2% Incentives)</span>
            </button>

            {member.role === 'super_admin' && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`inline-flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors duration-150 ${
                  activeTab === 'admin'
                    ? 'border-[#2563EB] text-[#2563EB]'
                    : 'border-transparent text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                <span>Team Management</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Global 2-Day Follow-Up Reminder Banner */}
      {counts.followupDue > 0 && activeTab !== 'progression' && (
        <div className="border-b border-[#FDE68A] bg-[#FFFBEB]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-[#92400E] sm:px-6">
            <div className="flex items-center gap-2 font-medium">
              <BellRing className="h-4 w-4 shrink-0 text-[#B45309]" aria-hidden="true" />
              <span>
                <strong>2-Day Follow-Up Reminder:</strong> You have{' '}
                <strong>{counts.followupDue}</strong> business
                {counts.followupDue === 1 ? '' : 'es'} requiring follow-up today.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('progression')}
              className="cursor-pointer rounded bg-[#B45309] px-3 py-1 font-semibold text-white hover:bg-[#92400E]"
            >
              Review Follow-Ups
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === 'leads' && (
          <LeadBankTab
            accessToken={sessionToken}
            member={member}
            onCountsChanged={() => loadMemberProfile(sessionToken)}
          />
        )}
        {activeTab === 'progression' && (
          <ProgressionTab
            accessToken={sessionToken}
            member={member}
            onCountsChanged={() => loadMemberProfile(sessionToken)}
          />
        )}
        {activeTab === 'money' && <MoneyTab accessToken={sessionToken} member={member} />}
        {activeTab === 'admin' && member.role === 'super_admin' && (
          <AdminTeamTab accessToken={sessionToken} />
        )}
      </main>

      {/* Self-Service Password Update Modal */}
      {pwModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pw-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 p-4"
        >
          <div className="w-full max-w-sm rounded-lg border border-[#E2E8F0] bg-white p-6">
            <div className="mb-3 flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
              <h3 id="pw-modal-title" className="text-sm font-bold text-[#0F172A]">
                Update Confidential Password
              </h3>
              <button
                type="button"
                onClick={() => setPwModalOpen(false)}
                aria-label="Close modal"
                className="cursor-pointer rounded p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
              <div>
                <label htmlFor="new-pw" className="mb-1 block font-semibold text-[#334155]">
                  New Confidential Password (min 8 characters)
                </label>
                <input
                  id="new-pw"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 font-mono text-[#0F172A]"
                />
              </div>
              {pwMsg && <p className="font-medium text-[#059669]">{pwMsg}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPwModalOpen(false)}
                  className="cursor-pointer rounded border border-[#CBD5E1] px-3 py-1.5 font-semibold text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded bg-[#2563EB] px-3.5 py-1.5 font-semibold text-white hover:bg-[#1D4ED8]"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
