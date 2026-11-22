'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Search,
  ExternalLink,
  Trash2,
  Edit3,
  Clock,
  Shield,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Phone,
  Paperclip,
  X,
} from 'lucide-react';
import LeadEvidenceUploadModal from '@/components/LeadEvidenceUploadModal';
import LeadEvidenceListModal from '@/components/LeadEvidenceListModal';
import { standardizePhoneField } from '@/lib/phone';
import type { Lead, LeadStage, TeamMemberProfile } from '@/lib/types';

interface LeadBankTabProps {
  accessToken: string;
  member: TeamMemberProfile;
  onCountsChanged: () => void;
}

function LeadTableSkeleton() {
  return (
    <>
      <tr className="sr-only"><td colSpan={7} role="status">Loading your private leads</td></tr>
      {Array.from({ length: 5 }, (_, index) => (
        <tr key={index} aria-hidden="true" className="lead-skeleton-row">
          <td className="px-4 py-4"><div className="skeleton-shimmer h-3 w-3/4 rounded-md" /><div className="skeleton-shimmer mt-2 h-2.5 w-1/2 rounded-md opacity-60" /></td>
          <td className="px-3 py-4"><div className="skeleton-shimmer h-3 w-2/3 rounded-md" /></td>
          <td className="px-3 py-4"><div className="skeleton-shimmer h-3 w-4/5 rounded-md" /></td>
          <td className="px-3 py-4"><div className="skeleton-shimmer h-3 w-2/3 rounded-md" /><div className="skeleton-shimmer mt-2 h-2.5 w-1/2 rounded-md opacity-60" /></td>
          <td className="px-3 py-4"><div className="skeleton-shimmer h-6 w-20 rounded-full" /></td>
          <td className="px-3 py-4"><div className="skeleton-shimmer h-3 w-3/4 rounded-md" /></td>
          <td className="px-4 py-4"><div className="ml-auto flex w-fit gap-1.5"><div className="skeleton-shimmer h-7 w-7 rounded-md" /><div className="skeleton-shimmer h-7 w-7 rounded-md" /></div></td>
        </tr>
      ))}
    </>
  );
}

const STAGE_OPTIONS: Array<{ value: LeadStage; label: string; badgeClass: string }> = [
  {
    value: 'new',
    label: 'New Lead',
    badgeClass: 'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]',
  },
  {
    value: 'connected',
    label: 'Connected',
    badgeClass: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  },
  {
    value: 'followup',
    label: 'Follow-Up (2d)',
    badgeClass: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  },
  {
    value: 'onboarded',
    label: 'Onboarded',
    badgeClass: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
  },
];

export default function LeadBankTab({
  accessToken,
  member,
  onCountsChanged,
}: LeadBankTabProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [evidenceRequest, setEvidenceRequest] = useState<{
    lead: Lead;
    stage: Extract<LeadStage, 'connected' | 'followup'>;
  } | null>(null);
  const [evidenceListLead, setEvidenceListLead] = useState<Lead | null>(null);
  const [attachEvidenceLead, setAttachEvidenceLead] = useState<Lead | null>(null);

  // Add / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    business_name: '',
    fb_link: '',
    contact_person: '',
    contact_number: '',
    product_category: '',
    pickup_area: '',
    stage: 'new' as LeadStage,
    needs_followup: false,
    carrybee_merchant_name: '',
    carrybee_merchant_id: '',
    notes: '',
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 280);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        stage: stageFilter,
        search: debouncedSearch,
      });
      const res = await fetch(`/api/leads?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLeads(data.leads || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, stageFilter, debouncedSearch]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  function openAddModal() {
    setEditingLead(null);
    setForm({
      business_name: '',
      fb_link: '',
      contact_person: '',
      contact_number: '',
      product_category: '',
      pickup_area: '',
      stage: 'new',
      needs_followup: false,
      carrybee_merchant_name: '',
      carrybee_merchant_id: '',
      notes: '',
    });
    setModalOpen(true);
  }

  function openEditModal(lead: Lead) {
    setEditingLead(lead);
    setForm({
      business_name: lead.business_name,
      fb_link: lead.fb_link,
      contact_person: lead.contact_person,
      contact_number: lead.contact_number,
      product_category: lead.product_category,
      pickup_area: lead.pickup_area,
      stage: lead.stage,
      needs_followup: lead.needs_followup,
      carrybee_merchant_name: lead.carrybee_merchant_name || '',
      carrybee_merchant_id: lead.carrybee_merchant_id || '',
      notes: lead.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSaveLead(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const targetStage = form.stage;
      const needsEvidence =
        (targetStage === 'connected' || targetStage === 'followup') &&
        (!editingLead || targetStage !== editingLead.stage);
      const payload = needsEvidence
        ? { ...form, stage: editingLead?.stage || 'new' }
        : form;
      const url = editingLead ? `/api/leads/${editingLead.id}` : '/api/leads';
      const method = editingLead ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Failed to save lead' });
        return;
      }
      setModalOpen(false);
      if (needsEvidence) {
        setEvidenceRequest({ lead: data.lead as Lead, stage: targetStage as 'connected' | 'followup' });
        setFeedback({ type: 'ok', text: 'Saved the lead. Upload evidence to complete the stage change.' });
      } else {
        setFeedback({
          type: 'ok',
          text: editingLead
            ? `Updated "${data.lead.business_name}" in your private Lead Bank.`
            : `Added "${data.lead.business_name}" to your private Lead Bank.`,
        });
      }
      fetchLeads();
      onCountsChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStageChange(lead: Lead, nextStage: LeadStage) {
    setFeedback(null);
    if ((nextStage === 'connected' || nextStage === 'followup') && nextStage !== lead.stage) {
      setEvidenceRequest({ lead, stage: nextStage });
      return;
    }
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ stage: nextStage }),
    });
    const data = await res.json();
    if (res.ok) {
      setLeads((prev) => prev.map((r) => (r.id === lead.id ? data.lead : r)));
      onCountsChanged();
      if (nextStage === 'connected' || nextStage === 'followup') {
        setFeedback({
          type: 'ok',
          text: `"${lead.business_name}" marked ${nextStage === 'connected' ? 'Connected' : 'Follow-Up'} — 2-day follow-up reminder scheduled automatically.`,
        });
      } else if (nextStage === 'onboarded') {
        setFeedback({
          type: 'ok',
          text: `"${lead.business_name}" marked Onboarded — now active for Carrybee Hive COD & 2% Incentive tracking in Money tab.`,
        });
      }
    }
  }

  function handleEvidenceSuccess(updatedLead: Lead) {
    setLeads((prev) => prev.map((row) => row.id === updatedLead.id ? updatedLead : row));
    setEvidenceRequest(null);
    setFeedback({
      type: 'ok',
      text: updatedLead.stage === 'onboarded'
        ? `Evidence attached to onboarded lead "${updatedLead.business_name}".`
        : `Evidence saved. "${updatedLead.business_name}" is now ${updatedLead.stage === 'connected' ? 'Connected' : 'Follow-Up'}.`,
    });
    fetchLeads();
    onCountsChanged();
  }

  async function handleDeleteLead(lead: Lead) {
    const confirmed = window.confirm(
      `Delete "${lead.business_name}" (${lead.contact_number || 'no phone'}) from your private Lead Bank?`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      setLeads((prev) => prev.filter((r) => r.id !== lead.id));
      setTotal((t) => Math.max(0, t - 1));
      onCountsChanged();
      setFeedback({
        type: 'ok',
        text: `Removed "${lead.business_name}" from your Lead Bank.`,
      });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const previewStdPhone = standardizePhoneField(form.contact_number).standardized;

  function isFollowupDue(lead: Lead): boolean {
    if (lead.stage === 'onboarded') return false;
    const nowMs = Date.now();
    if (lead.needs_followup && lead.followup_due_at) {
      return new Date(lead.followup_due_at).getTime() <= nowMs;
    }
    if (lead.stage === 'connected' && lead.last_contacted_at) {
      return new Date(lead.last_contacted_at).getTime() <= nowMs - 2 * 24 * 60 * 60 * 1000;
    }
    return false;
  }

  return (
    <div className="space-y-4">
      {/* Privacy Header Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] text-[#1D4ED8]">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-[#0F172A]">My Private Lead Bank</h2>
              <span className="tabular-nums text-xs font-medium text-[#475569]">
                ({total.toLocaleString()} leads)
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#475569]">
              Strict row-level isolation active — nobody else can view, edit, or access your leads.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Add New Lead</span>
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-md border px-4 py-2.5 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
              : 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss notification"
            className="cursor-pointer p-1 hover:opacity-75"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#E2E8F0] bg-white p-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#64748B]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search your private leads"
            placeholder="Search business, 17xxxxxxxx phone, category, area..."
            className="w-full rounded-md border border-[#CBD5E1] bg-white py-1.5 pl-9 pr-3 text-xs text-[#0F172A] placeholder-[#64748B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Leads' },
            { id: 'new', label: 'New' },
            { id: 'connected', label: 'Connected' },
            { id: 'followup_due', label: '2-Day Follow-Up Due' },
            { id: 'onboarded', label: 'Onboarded' },
          ].map((pill) => {
            const active = stageFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setStageFilter(pill.id);
                  setPage(1);
                }}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                  active
                    ? 'border-[#1E40AF] bg-[#1E40AF] text-white'
                    : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] hover:bg-[#F1F5F9]'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Formal Data Table */}
      <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                <th className="px-4 py-3">Business Name</th>
                <th className="px-3 py-3">Contact Person</th>
                <th className="px-3 py-3">Phone (17xxxxxxxx)</th>
                <th className="px-3 py-3">Category &amp; Area</th>
                <th className="px-3 py-3">Pipeline Stage</th>
                <th className="px-3 py-3">2-Day Follow-Up</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody aria-busy={loading} className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <LeadTableSkeleton />
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-[#475569]">
                    No leads match your current filter. Click &ldquo;Add New Lead&rdquo; to add a
                    business to your private Lead Bank.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const due = isFollowupDue(lead);
                  const cleanUrl =
                    lead.fb_link && lead.fb_link.startsWith('http') ? lead.fb_link : '';
                  return (
                    <tr
                      key={lead.id}
                      className={`transition-colors duration-150 hover:bg-[#F8FAFC] ${
                        due ? 'bg-[#FFFBEB]/60' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 font-semibold text-[#0F172A]">
                        <div className="flex items-center gap-1.5">
                          <span className="max-w-[220px] truncate" title={lead.business_name}>
                            {lead.business_name}
                          </span>
                          {cleanUrl && (
                            <a
                              href={cleanUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open Facebook page for ${lead.business_name}`}
                              className="inline-flex shrink-0 text-[#2563EB] hover:text-[#1D4ED8]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                        {lead.carrybee_merchant_id && (
                          <span className="mt-0.5 block font-mono text-[10px] font-normal text-[#059669]">
                            Carrybee ID: {lead.carrybee_merchant_id}
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-[#334155]">
                        {lead.contact_person || '—'}
                      </td>

                      <td className="px-3 py-2.5 font-mono tabular-nums text-[#0F172A]">
                        {lead.contact_number ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3 text-[#64748B]" aria-hidden="true" />
                            <span>{lead.contact_number}</span>
                          </span>
                        ) : (
                          <span className="text-[#94A3B8]">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-[#475569]">
                        <div className="max-w-[180px] truncate font-medium text-[#334155]">
                          {lead.product_category || '—'}
                        </div>
                        <div className="max-w-[180px] truncate text-[11px] text-[#64748B]">
                          {lead.pickup_area || '—'}
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <select
                          aria-label={`Stage for ${lead.business_name}`}
                          value={lead.stage}
                          onChange={(e) =>
                            handleQuickStageChange(lead, e.target.value as LeadStage)
                          }
                          className="cursor-pointer rounded border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                        >
                          {STAGE_OPTIONS.map((st) => (
                            <option key={st.value} value={st.value}>
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-2.5">
                        {lead.stage === 'onboarded' ? (
                          <span className="inline-flex items-center gap-1 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#065F46]">
                            Onboarded
                          </span>
                        ) : due ? (
                          <span className="inline-flex items-center gap-1 rounded border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-semibold text-[#92400E]">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            <span>Follow-Up Due</span>
                          </span>
                        ) : lead.followup_due_at ? (
                          <span className="font-mono text-[11px] text-[#475569]">
                            Due {new Date(lead.followup_due_at).toLocaleDateString('en-GB')}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#94A3B8]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEvidenceListLead(lead)}
                            aria-label={`View evidence for ${lead.business_name}`}
                            title="View uploaded evidence"
                            className="cursor-pointer rounded p-1.5 text-[#475569] transition-colors hover:bg-[#EFF6FF] hover:text-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                          >
                            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(lead)}
                            aria-label={`Edit ${lead.business_name}`}
                            className="cursor-pointer rounded p-1.5 text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLead(lead)}
                            aria-label={`Delete ${lead.business_name}`}
                            className="cursor-pointer rounded p-1.5 text-[#64748B] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col items-center justify-between gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-xs text-[#475569] sm:flex-row">
          {loading ? (
            <span role="status" className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="skeleton-shimmer h-3 w-40 rounded-md" />
              <span className="sr-only">Loading private lead count</span>
            </span>
          ) : (
            <span className="tabular-nums">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> (
              {total.toLocaleString()} total private leads)
            </span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#CBD5E1] bg-white px-2.5 py-1 font-medium text-[#334155] hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#CBD5E1] bg-white px-2.5 py-1 font-medium text-[#334155] hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Lead Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 p-4"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white p-6">
            <div className="mb-4 flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 id="lead-modal-title" className="text-base font-bold text-[#0F172A]">
                  {editingLead ? 'Edit Private Lead' : 'Add New Lead'}
                </h3>
                <p className="text-xs text-[#475569]">
                  Saved directly to your isolated Lead Bank workspace
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="cursor-pointer rounded p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="f-bname" className="mb-1 block font-semibold text-[#334155]">
                    Business Name *
                  </label>
                  <input
                    id="f-bname"
                    type="text"
                    required
                    value={form.business_name}
                    onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                    placeholder="e.g. Optilux Fashion"
                    className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="f-fb" className="mb-1 block font-semibold text-[#334155]">
                    Business Facebook / Website URL
                  </label>
                  <input
                    id="f-fb"
                    type="text"
                    value={form.fb_link}
                    onChange={(e) => setForm({ ...form, fb_link: e.target.value })}
                    placeholder="https://www.facebook.com/..."
                    className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                </div>

                <div>
                  <label htmlFor="f-cp" className="mb-1 block font-semibold text-[#334155]">
                    Contact Person
                  </label>
                  <input
                    id="f-cp"
                    type="text"
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    placeholder="Owner / POC Name"
                    className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                </div>

                <div>
                  <label htmlFor="f-phone" className="mb-1 block font-semibold text-[#334155]">
                    Contact Number (Auto 17xxxxxxxx)
                  </label>
                  <input
                    id="f-phone"
                    type="text"
                    value={form.contact_number}
                    onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                    placeholder="017xxxxxxxx or 17xxxxxxxx"
                    className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 font-mono text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                  {previewStdPhone && (
                    <p className="mt-1 font-mono text-[11px] text-[#059669]">
                      Stored as: {previewStdPhone}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="f-cat" className="mb-1 block font-semibold text-[#334155]">
                    Product Category
                  </label>
                  <input
                    id="f-cat"
                    type="text"
                    value={form.product_category}
                    onChange={(e) => setForm({ ...form, product_category: e.target.value })}
                    placeholder="Clothing, Health & Beauty..."
                    className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                </div>

                <div>
                  <label htmlFor="f-area" className="mb-1 block font-semibold text-[#334155]">
                    Pick-up Area
                  </label>
                  <input
                    id="f-area"
                    type="text"
                    value={form.pickup_area}
                    onChange={(e) => setForm({ ...form, pickup_area: e.target.value })}
                    placeholder="Mirpur, Uttara, Dhanmondi..."
                    className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                </div>

                <div>
                  <label htmlFor="f-stage" className="mb-1 block font-semibold text-[#334155]">
                    Pipeline Stage
                  </label>
                  <select
                    id="f-stage"
                    value={form.stage}
                    onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })}
                    className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  >
                    {STAGE_OPTIONS.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#334155]">
                    <input
                      type="checkbox"
                      checked={
                        form.needs_followup ||
                        form.stage === 'followup' ||
                        form.stage === 'connected'
                      }
                      disabled={form.stage === 'onboarded'}
                      onChange={(e) => setForm({ ...form, needs_followup: e.target.checked })}
                      className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB]"
                    />
                    <span>Remind me to follow up in 2 days</span>
                  </label>
                </div>

                {form.stage === 'onboarded' && (
                  <>
                    <div>
                      <label
                        htmlFor="f-cbname"
                        className="mb-1 block font-semibold text-[#065F46]"
                      >
                        Carrybee Hive Store Name (Optional)
                      </label>
                      <input
                        id="f-cbname"
                        type="text"
                        value={form.carrybee_merchant_name}
                        onChange={(e) =>
                          setForm({ ...form, carrybee_merchant_name: e.target.value })
                        }
                        placeholder="Exact name on hive.carrybee.com"
                        className="w-full rounded-md border border-[#A7F3D0] bg-[#ECFDF5]/40 px-3 py-2 text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="f-cbid"
                        className="mb-1 block font-semibold text-[#065F46]"
                      >
                        Carrybee Merchant ID (Optional)
                      </label>
                      <input
                        id="f-cbid"
                        type="text"
                        value={form.carrybee_merchant_id}
                        onChange={(e) =>
                          setForm({ ...form, carrybee_merchant_id: e.target.value })
                        }
                        placeholder="e.g. CB-1042"
                        className="w-full rounded-md border border-[#A7F3D0] bg-[#ECFDF5]/40 px-3 py-2 font-mono text-[#0F172A]"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="cursor-pointer rounded-md border border-[#CBD5E1] bg-white px-4 py-2 font-semibold text-[#334155] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="cursor-pointer rounded-md bg-[#2563EB] px-4 py-2 font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
                >
                  {saving ? 'Saving & Syncing...' : editingLead ? 'Save Changes' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {evidenceRequest && (
        <LeadEvidenceUploadModal
          lead={evidenceRequest.lead}
          stage={evidenceRequest.stage}
          mode="stage-change"
          accessToken={accessToken}
          memberId={member.id}
          onClose={() => setEvidenceRequest(null)}
          onSuccess={handleEvidenceSuccess}
        />
      )}
      {attachEvidenceLead && (
        <LeadEvidenceUploadModal
          lead={attachEvidenceLead}
          stage="onboarded"
          mode="attach-only"
          accessToken={accessToken}
          memberId={member.id}
          onClose={() => setAttachEvidenceLead(null)}
          onSuccess={(updated) => { setAttachEvidenceLead(null); handleEvidenceSuccess(updated); }}
        />
      )}
      {evidenceListLead && (
        <LeadEvidenceListModal
          lead={evidenceListLead}
          accessToken={accessToken}
          onAddEvidence={() => { const target = evidenceListLead; setEvidenceListLead(null); setAttachEvidenceLead(target); }}
          onClose={() => setEvidenceListLead(null)}
        />
      )}
    </div>
  );
}
