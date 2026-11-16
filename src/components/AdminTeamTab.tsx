'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  UserPlus,
  ShieldCheck,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { TeamMemberProfile, UserRole } from '@/lib/types';

interface AdminTeamTabProps {
  accessToken: string;
}

export default function AdminTeamTab({ accessToken }: AdminTeamTabProps) {
  const [members, setMembers] = useState<TeamMemberProfile[]>([]);
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [appsScriptSource, setAppsScriptSource] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('team_member');
  const [addingMember, setAddingMember] = useState(false);

  const [savingBridge, setSavingBridge] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const loadAdminData = useCallback(async () => {
    const [mRes, sRes] = await Promise.all([
      fetch('/api/members', { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('/api/settings', { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);
    if (mRes.ok) {
      const mJson = await mRes.json();
      setMembers(mJson.members || []);
    }
    if (sRes.ok) {
      const sJson = await sRes.json();
      setAppsScriptUrl(sJson.appsScriptUrl || '');
      setAppsScriptSource(sJson.appsScriptSource || '');
    }
  }, [accessToken]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddingMember(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusBanner({ type: 'err', text: data.error || 'Failed to add member' });
        return;
      }
      setFullName('');
      setEmail('');
      setRole('team_member');
      loadAdminData();

      const prov = data.provisioning;
      setStatusBanner({
        type: 'ok',
        text: prov?.emailSent
          ? `Provisioned ${data.member.full_name} (${data.member.email}): encrypted password stored in Supabase and confidential login email dispatched + purged from Sent Mail.`
          : `Created ${data.member.full_name} (${data.member.email}) in Supabase with encrypted password. Connect the Apps Script Web App URL below to enable automatic Gmail credential dispatch + Sent Mail auto-purge.`,
      });
    } finally {
      setAddingMember(false);
    }
  }

  async function handleSaveAndTestBridge(testPing: boolean) {
    setSavingBridge(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ appsScriptUrl, testPing }),
      });
      const data = await res.json();
      if (!res.ok || (testPing && !data.ok)) {
        setStatusBanner({
          type: 'err',
          text: data.message || data.error || 'Bridge test failed',
        });
        return;
      }
      setStatusBanner({
        type: 'ok',
        text: testPing
          ? `Background Sync & Gmail Auto-Purge Bridge verified: ${data.message}`
          : 'Saved Apps Script Web App URL.',
      });
    } finally {
      setSavingBridge(false);
    }
  }

  return (
    <div className="space-y-6">
      {statusBanner && (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-md border p-3.5 text-xs font-medium ${
            statusBanner.type === 'ok'
              ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
              : 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
          }`}
        >
          {statusBanner.type === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{statusBanner.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Add New Member Form */}
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-5 lg:col-span-5">
          <div className="mb-4 flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
            <UserPlus className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Add New Team Member</h2>
              <p className="text-xs text-[#475569]">
                Super Admin Only — Auto-provisions isolated workspace + confidential password
              </p>
            </div>
          </div>

          <form onSubmit={handleAddMember} className="space-y-3.5 text-xs">
            <div>
              <label htmlFor="m-name" className="mb-1 block font-semibold text-[#334155]">
                Full Name *
              </label>
              <input
                id="m-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Sabbir Rahman"
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-[#0F172A]"
              />
            </div>

            <div>
              <label htmlFor="m-email" className="mb-1 block font-semibold text-[#334155]">
                Carrybee Email Address *
              </label>
              <input
                id="m-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@carrybee.com"
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-[#0F172A]"
              />
            </div>

            <div>
              <label htmlFor="m-role" className="mb-1 block font-semibold text-[#334155]">
                Portal Role
              </label>
              <select
                id="m-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 font-semibold text-[#0F172A]"
              >
                <option value="team_member">Team Member</option>
                <option value="team_leader">Team Leader</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div className="rounded border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[11px] text-[#475569]">
              <div className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
                <span>Zero-Knowledge Password Guarantee</span>
              </div>
              <p className="mt-1">
                A random cryptographic password is generated on the server, hashed in Supabase,
                emailed directly to the member, and immediately deleted from Sent Mail. Not even
                Super Admin sees the password.
              </p>
            </div>

            <button
              type="submit"
              disabled={addingMember}
              className="w-full cursor-pointer rounded-md bg-[#2563EB] px-4 py-2.5 font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {addingMember ? 'Provisioning Member...' : 'Provision New Team Member'}
            </button>
          </form>
        </div>

        {/* Active Team Directory */}
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white lg:col-span-7">
          <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
            <h2 className="text-sm font-bold text-[#0F172A]">Authorized Team Directory</h2>
            <p className="text-xs text-[#475569]">
              Strict per-member data isolation enforced via Row-Level Security
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-5 py-3">Password Storage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-[#0F172A]">{m.full_name}</div>
                      <div className="text-[#64748B]">{m.email}</div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-[#334155]">
                      {m.role === 'super_admin'
                        ? 'Super Admin'
                        : m.role === 'team_leader'
                          ? 'Team Leader'
                          : 'Team Member'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#065F46]">
                        Encrypted Hash (Hidden)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Background Sync & Confidential Email Auto-Purge Bridge Configuration */}
      <div className="rounded-lg border border-[#E2E8F0] bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              Background Sync &amp; Confidential Email Auto-Purge Bridge
            </h3>
            <p className="text-xs text-[#475569]">
              Connect your Google Apps Script Web App endpoint once to enable real-time background
              workspace sync and automatic Gmail credential dispatch + Sent Mail auto-deletion.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(appsScriptSource);
              setCopiedScript(true);
              setTimeout(() => setCopiedScript(false), 2000);
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F1F5F9]"
          >
            {copiedScript ? (
              <Check className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{copiedScript ? 'Copied Apps Script' : 'Copy Code.gs Script'}</span>
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={appsScriptUrl}
            onChange={(e) => setAppsScriptUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            aria-label="Google Apps Script Web App URL"
            className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 font-mono text-xs text-[#0F172A]"
          />
          <button
            type="button"
            disabled={savingBridge}
            onClick={() => handleSaveAndTestBridge(false)}
            className="shrink-0 cursor-pointer rounded-md border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
          >
            Save URL
          </button>
          <button
            type="button"
            disabled={savingBridge}
            onClick={() => handleSaveAndTestBridge(true)}
            className="shrink-0 cursor-pointer rounded-md bg-[#059669] px-4 py-2 text-xs font-semibold text-white hover:bg-[#047857]"
          >
            Test Connection
          </button>
        </div>
      </div>
    </div>
  );
}
