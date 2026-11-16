'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BadgeDollarSign,
  Wallet,
  PackageCheck,
  Store,
  Download,
  Copy,
  Check,
  Plus,
  RefreshCw,
  ExternalLink,
  CalendarDays,
  X,
} from 'lucide-react';
import type {
  DailyCodPoint,
  Lead,
  MerchantMoneySummary,
  TeamMemberProfile,
} from '@/lib/types';

interface MoneyTabProps {
  accessToken: string;
  member: TeamMemberProfile;
}

interface TeamMoneyRollupItem {
  member_id: string;
  full_name: string;
  role: string;
  monthOrders: number;
  monthEligibleCod: number;
  incentive2Pct: number;
}

function formatBdt(val: number): string {
  return `৳ ${Number(val || 0).toLocaleString('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export default function MoneyTab({ accessToken, member }: MoneyTabProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [dailySeries, setDailySeries] = useState<DailyCodPoint[]>([]);
  const [daysInSelectedMonth, setDaysInSelectedMonth] = useState(30);
  const [merchants, setMerchants] = useState<MerchantMoneySummary[]>([]);
  const [onboardedLeads, setOnboardedLeads] = useState<Lead[]>([]);
  const [totalMonthOrders, setTotalMonthOrders] = useState(0);
  const [totalMonthEligibleCod, setTotalMonthEligibleCod] = useState(0);
  const [totalIncentive2Pct, setTotalIncentive2Pct] = useState(0);
  const [extensionToken, setExtensionToken] = useState('');
  const [canViewTeamMoney, setCanViewTeamMoney] = useState(false);
  const [teamRollup, setTeamRollup] = useState<TeamMoneyRollupItem[]>([]);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState({
    lead_id: '',
    external_order_id: '',
    merchant_name: '',
    merchant_phone: '',
    carrybee_merchant_id: '',
    order_date: new Date().toISOString().slice(0, 10),
    cod_amount: '',
  });

  const loadMoney = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/money?month=${encodeURIComponent(selectedMonth)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setDailySeries(data.dailySeries || []);
        setDaysInSelectedMonth(data.daysInSelectedMonth || 30);
        setMerchants(data.merchants || []);
        setOnboardedLeads(data.onboardedLeads || []);
        setTotalMonthOrders(data.totalMonthOrders || 0);
        setTotalMonthEligibleCod(data.totalMonthEligibleCod || 0);
        setTotalIncentive2Pct(data.totalIncentive2Pct || 0);
        setExtensionToken(data.extensionToken || '');
        setCanViewTeamMoney(Boolean(data.canViewTeamMoney));
        setTeamRollup(data.teamMoneyRollup || []);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedMonth]);

  useEffect(() => {
    loadMoney();
  }, [loadMoney]);

  function copyText(key: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function handleRotateToken() {
    const res = await fetch('/api/me', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: 'rotate_extension_token' }),
    });
    const data = await res.json();
    if (res.ok && data.extension_token) {
      setExtensionToken(data.extension_token);
    }
  }

  async function handleSaveOrder(e: React.FormEvent) {
    e.preventDefault();
    setSavingOrder(true);
    try {
      const res = await fetch('/api/money', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...orderForm,
          cod_amount: Number(orderForm.cod_amount),
        }),
      });
      if (res.ok) {
        setLogModalOpen(false);
        setOrderForm({
          lead_id: '',
          external_order_id: '',
          merchant_name: '',
          merchant_phone: '',
          carrybee_merchant_id: '',
          order_date: new Date().toISOString().slice(0, 10),
          cod_amount: '',
        });
        loadMoney();
      }
    } finally {
      setSavingOrder(false);
    }
  }

  const maxDailyCod = Math.max(1, ...dailySeries.map((d) => d.eligibleCod));
  const dashboardOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-6">
      {/* Month Controls & Attribution Rule Header */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#E2E8F0] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-bold text-[#0F172A]">
            Money &amp; Onboarded Merchant COD Tracker
          </h2>
          <p className="mt-0.5 text-xs text-[#475569]">
            Tracks onboarded merchant orders from{' '}
            <a
              href="https://hive.carrybee.com/orders"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#2563EB] hover:underline"
            >
              <span>hive.carrybee.com/orders</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>{' '}
            across Days 1–31. Mid-month starters (e.g. Day 16) track remaining days of Month 1 (15d)
            + full 30/31 days of Month 2.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5 text-[#475569]" aria-hidden="true" />
            <label htmlFor="money-month" className="font-semibold text-[#334155]">
              Month:
            </label>
            <input
              id="money-month"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-mono font-semibold text-[#0F172A] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setLogModalOpen(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Log Merchant Order</span>
          </button>

          <button
            type="button"
            onClick={loadMoney}
            aria-label="Refresh Money metrics"
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Cards — Featuring "Incentives (2% COD)" */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border-2 border-[#059669] bg-[#ECFDF5] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#065F46]">
              Incentives (2% of COD)
            </span>
            <BadgeDollarSign className="h-5 w-5 text-[#059669]" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#065F46]">
            {loading ? '...' : formatBdt(totalIncentive2Pct)}
          </p>
          <p className="mt-1 text-xs font-medium text-[#047857]">
            2.0% commission on eligible merchant COD ({selectedMonth})
          </p>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
              Total Merchant COD (1–31)
            </span>
            <Wallet className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
            {loading ? '...' : formatBdt(totalMonthEligibleCod)}
          </p>
          <p className="mt-1 text-xs text-[#475569]">
            Eligible COD within active merchant windows
          </p>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
              Tracked Merchant Orders
            </span>
            <PackageCheck className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
            {loading ? '...' : totalMonthOrders.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[#475569]">
            Orders placed in {selectedMonth} (Days 1–{daysInSelectedMonth})
          </p>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
              Onboarded Merchants
            </span>
            <Store className="h-4 w-4 text-[#059669]" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
            {loading ? '...' : onboardedLeads.length.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[#475569]">
            {merchants.length} with active order window in {selectedMonth}
          </p>
        </div>
      </div>

      {/* Day 1 to Day 31 Monthly COD Visual Breakdown */}
      <div className="rounded-lg border border-[#E2E8F0] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              Daily COD Schedule — Days 1 to 31 ({selectedMonth})
            </h3>
            <p className="text-xs text-[#475569]">
              Daily order volume and total COD across calendar days 1 through 31
            </p>
          </div>
          <span className="font-mono text-xs font-semibold text-[#059669]">
            2% Incentive Rate Active
          </span>
        </div>

        <div className="grid grid-cols-31 gap-1 overflow-x-auto pb-2">
          <div className="flex min-w-[720px] items-end gap-1.5 border-b border-[#E2E8F0] pb-2 pt-4">
            {dailySeries.map((pt) => {
              const isValidDay = pt.day <= daysInSelectedMonth;
              const barHeight =
                pt.eligibleCod > 0 ? Math.max(10, Math.round((pt.eligibleCod / maxDailyCod) * 110)) : 3;
              return (
                <div
                  key={pt.day}
                  title={
                    isValidDay
                      ? `Day ${pt.day} (${pt.dateStr}): ${pt.orderCount} orders · ${formatBdt(pt.eligibleCod)} COD · ${formatBdt(pt.incentiveAmount)} incentive`
                      : `Day ${pt.day} (N/A in ${selectedMonth})`
                  }
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div className="flex h-[116px] w-full items-end justify-center">
                    <div
                      style={{ height: `${barHeight}px` }}
                      className={`w-full max-w-[18px] rounded-t transition-all duration-150 ${
                        !isValidDay
                          ? 'bg-[#F1F5F9]'
                          : pt.eligibleCod > 0
                            ? 'bg-[#2563EB] hover:bg-[#059669]'
                            : 'bg-[#E2E8F0]'
                      }`}
                    />
                  </div>
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      isValidDay ? 'font-semibold text-[#334155]' : 'text-[#CBD5E1]'
                    }`}
                  >
                    {pt.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Per-Merchant COD & Attribution Window Ledger */}
      <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
        <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          <h3 className="text-sm font-bold text-[#0F172A]">
            Onboarded Merchant Order &amp; COD Attribution Ledger
          </h3>
          <p className="mt-0.5 text-xs text-[#475569]">
            Rule: Day-1 starters track 1–30/31 of that month. Mid-month starters (e.g. 16th) track
            remaining days of start month + full 30/31 days of next month.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-white text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                <th className="px-5 py-3">Onboarded Merchant</th>
                <th className="px-3 py-3">First Order Date</th>
                <th className="px-3 py-3">Active Attribution Window</th>
                <th className="px-3 py-3 text-right">Orders ({selectedMonth})</th>
                <th className="px-3 py-3 text-right">Eligible COD ({selectedMonth})</th>
                <th className="px-5 py-3 text-right">2% Incentive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {merchants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs text-[#475569]">
                    No merchant orders synced for {selectedMonth} yet. Install the Carrybee Hive
                    Chrome Extension below or click &ldquo;Log Merchant Order&rdquo; to record COD
                    orders.
                  </td>
                </tr>
              ) : (
                merchants.map((m) => (
                  <tr key={m.merchantKey} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3 font-semibold text-[#0F172A]">
                      <div>{m.merchantName}</div>
                      <div className="font-mono text-[11px] font-normal text-[#64748B]">
                        {m.merchantPhone || m.carrybeeMerchantId || 'Matched Merchant'}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[#334155]">{m.firstOrderDate}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                          m.isMidMonthSplit
                            ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                            : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#334155]'
                        }`}
                      >
                        {m.windowLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-[#0F172A]">
                      {m.monthOrderCount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-[#0F172A]">
                      {formatBdt(m.monthEligibleCod)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold tabular-nums text-[#059669]">
                      {formatBdt(m.monthIncentive)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Money Rollup (Super Admin & Team Leader Only) */}
      {canViewTeamMoney && teamRollup.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5">
            <h3 className="text-sm font-bold text-[#0F172A]">
              Team COD &amp; 2% Incentives Summary ({selectedMonth})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                  <th className="px-5 py-2.5">Team Member</th>
                  <th className="px-3 py-2.5 text-right">Month Orders</th>
                  <th className="px-3 py-2.5 text-right">Month Eligible COD</th>
                  <th className="px-5 py-2.5 text-right">2% Incentive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {teamRollup.map((tr) => (
                  <tr key={tr.member_id}>
                    <td className="px-5 py-2.5 font-semibold text-[#0F172A]">{tr.full_name}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {tr.monthOrders.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatBdt(tr.monthEligibleCod)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono font-bold tabular-nums text-[#059669]">
                      {formatBdt(tr.incentive2Pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Carrybee Hive Chrome Extension Download & Sync Credentials Hub */}
      <div className="rounded-lg border border-[#CBD5E1] bg-white p-5">
        <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-4 md:flex-row md:items-center">
          <div>
            <span className="rounded border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
              Chrome Extension · Manifest V3
            </span>
            <h3 className="mt-1.5 text-sm font-bold text-[#0F172A]">
              Carrybee Hive Orders Tracker Extension (hive.carrybee.com/orders)
            </h3>
            <p className="mt-0.5 text-xs text-[#475569]">
              Automatically captures onboarded merchant order counts and COD amounts from{' '}
              <span className="font-mono">https://hive.carrybee.com/orders</span> into your Money
              tab.
            </p>
          </div>

          <a
            href="/carrybee-hive-tracker-extension.zip"
            download
            className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md bg-[#0F172A] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1E293B]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Chrome Extension (.zip)</span>
          </a>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
              1. Dashboard URL (Paste into Extension Popup)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={dashboardOrigin}
                aria-label="Dashboard URL"
                className="w-full rounded border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 font-mono text-xs text-[#0F172A]"
              />
              <button
                type="button"
                onClick={() => copyText('url', dashboardOrigin)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
              >
                {copiedKey === 'url' ? (
                  <Check className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{copiedKey === 'url' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
              2. Personal Sync Token for {member.full_name}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                readOnly
                value={extensionToken}
                aria-label="Personal Extension Sync Token"
                className="w-full rounded border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 font-mono text-xs text-[#0F172A]"
              />
              <button
                type="button"
                onClick={() => copyText('token', extensionToken)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
              >
                {copiedKey === 'token' ? (
                  <Check className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{copiedKey === 'token' ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={handleRotateToken}
                className="shrink-0 cursor-pointer rounded border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A]"
              >
                Rotate
              </button>
            </div>
          </div>
        </div>

        <ol className="mt-4 list-inside list-decimal space-y-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs text-[#334155]">
          <li>
            Unzip <span className="font-mono font-semibold">carrybee-hive-tracker-extension.zip</span>{' '}
            and open <span className="font-mono font-semibold">chrome://extensions</span> (enable{' '}
            <strong>Developer mode</strong> &rarr; <strong>Load unpacked</strong>).
          </li>
          <li>
            Click the extension icon, paste the <strong>Dashboard URL</strong> and your{' '}
            <strong>Personal Sync Token</strong> above, and click <strong>Save &amp; Verify</strong>.
          </li>
          <li>
            Visit <span className="font-mono">https://hive.carrybee.com/orders</span> and click{' '}
            <strong>Sync COD</strong> on the bottom-right bar to sync onboarded merchant orders &amp;
            calculate your 2% COD incentive automatically.
          </li>
        </ol>
      </div>

      {/* Manual Order Log Modal */}
      {logModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[#E2E8F0] bg-white p-6">
            <div className="mb-4 flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 id="order-modal-title" className="text-base font-bold text-[#0F172A]">
                Log Onboarded Merchant Order
              </h3>
              <button
                type="button"
                onClick={() => setLogModalOpen(false)}
                aria-label="Close modal"
                className="cursor-pointer rounded p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-3.5 text-xs">
              {onboardedLeads.length > 0 && (
                <div>
                  <label htmlFor="o-lead" className="mb-1 block font-semibold text-[#334155]">
                    Select Onboarded Merchant (Optional Quick Fill)
                  </label>
                  <select
                    id="o-lead"
                    value={orderForm.lead_id}
                    onChange={(e) => {
                      const chosen = onboardedLeads.find((l) => l.id === e.target.value);
                      setOrderForm({
                        ...orderForm,
                        lead_id: e.target.value,
                        merchant_name: chosen ? chosen.business_name : orderForm.merchant_name,
                        merchant_phone: chosen ? chosen.contact_number : orderForm.merchant_phone,
                        carrybee_merchant_id: chosen
                          ? chosen.carrybee_merchant_id
                          : orderForm.carrybee_merchant_id,
                      });
                    }}
                    className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-[#0F172A]"
                  >
                    <option value="">— Custom / Enter Manually —</option>
                    {onboardedLeads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.business_name} ({l.contact_number || 'no phone'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="o-id" className="mb-1 block font-semibold text-[#334155]">
                  Carrybee Order / Consignment ID *
                </label>
                <input
                  id="o-id"
                  type="text"
                  required
                  value={orderForm.external_order_id}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, external_order_id: e.target.value })
                  }
                  placeholder="e.g. CB-ORD-90214"
                  className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 font-mono text-[#0F172A]"
                />
              </div>

              <div>
                <label htmlFor="o-mname" className="mb-1 block font-semibold text-[#334155]">
                  Merchant Name *
                </label>
                <input
                  id="o-mname"
                  type="text"
                  required
                  value={orderForm.merchant_name}
                  onChange={(e) => setOrderForm({ ...orderForm, merchant_name: e.target.value })}
                  placeholder="Merchant store name"
                  className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="o-date" className="mb-1 block font-semibold text-[#334155]">
                    Order Date *
                  </label>
                  <input
                    id="o-date"
                    type="date"
                    required
                    value={orderForm.order_date}
                    onChange={(e) => setOrderForm({ ...orderForm, order_date: e.target.value })}
                    className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
                <div>
                  <label htmlFor="o-cod" className="mb-1 block font-semibold text-[#334155]">
                    COD Amount (BDT ৳) *
                  </label>
                  <input
                    id="o-cod"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={orderForm.cod_amount}
                    onChange={(e) => setOrderForm({ ...orderForm, cod_amount: e.target.value })}
                    placeholder="e.g. 1850"
                    className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 font-mono text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={() => setLogModalOpen(false)}
                  className="cursor-pointer rounded-md border border-[#CBD5E1] bg-white px-4 py-2 font-semibold text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOrder}
                  className="cursor-pointer rounded-md bg-[#059669] px-4 py-2 font-semibold text-white hover:bg-[#047857] disabled:opacity-60"
                >
                  {savingOrder ? 'Saving...' : 'Save Order & Compute 2%'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
