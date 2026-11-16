'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BadgeDollarSign,
  Wallet,
  PackageCheck,
  Store,
  Download,
  Plus,
  RefreshCw,
  ExternalLink,
  CalendarDays,
  ShieldCheck,
  Zap,
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
  const [canViewTeamMoney, setCanViewTeamMoney] = useState(false);
  const [teamRollup, setTeamRollup] = useState<TeamMoneyRollupItem[]>([]);

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState({
    lead_id: '',
    external_order_id: '',
    order_date: new Date().toISOString().slice(0, 10),
    cod_amount: '',
  });

  const loadMoney = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
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
          setCanViewTeamMoney(Boolean(data.canViewTeamMoney));
          setTeamRollup(data.teamMoneyRollup || []);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [accessToken, selectedMonth]
  );

  useEffect(() => {
    loadMoney(false);
    // Live background auto-refresh so extension auto-syncs reflect automatically without clicking Refresh
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMoney(true);
      }
    }, 12000);
    const onFocus = () => loadMoney(true);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadMoney]);

  async function handleSaveOrder(e: React.FormEvent) {
    e.preventDefault();
    setOrderError(null);
    if (!orderForm.lead_id) {
      setOrderError('Select an Onboarded Merchant from your Lead Bank first.');
      return;
    }
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
      const data = await res.json();
      if (res.ok) {
        setLogModalOpen(false);
        setOrderForm({
          lead_id: '',
          external_order_id: '',
          order_date: new Date().toISOString().slice(0, 10),
          cod_amount: '',
        });
        loadMoney(false);
      } else {
        setOrderError(data.error || 'Failed to save order');
      }
    } finally {
      setSavingOrder(false);
    }
  }

  const maxDailyCod = Math.max(1, ...dailySeries.map((d) => d.eligibleCod));

  return (
    <div className="space-y-6">
      {/* Strict Onboarded-Only COD Rule Notice */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-xs text-[#065F46]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#059669]" aria-hidden="true" />
          <span>
            <strong>Strict Onboarded-Merchant Rule:</strong> Orders, daily COD, and 2% incentives
            are shown <strong>only</strong> for merchants marked as <strong>Onboarded</strong> in
            your Lead Bank Dashboard ({member.full_name}). Non-onboarded merchants on Carrybee Hive
            are automatically ignored.
          </span>
        </div>
        <span className="inline-flex items-center gap-1 rounded border border-[#6EE7B7] bg-white px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#047857]">
          <Zap className="h-3 w-3" aria-hidden="true" />
          <span>Auto-Sync Active · Zero Token Needed</span>
        </span>
      </div>

      {/* Month Controls & Attribution Rule Header */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#E2E8F0] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-bold text-[#0F172A]">
            Money &amp; Onboarded Merchant COD Tracker
          </h2>
          <p className="mt-0.5 text-xs text-[#475569]">
            Auto-syncs your onboarded merchants&apos; orders from{' '}
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
            onClick={() => {
              setOrderError(null);
              if (onboardedLeads.length > 0 && !orderForm.lead_id) {
                setOrderForm((prev) => ({ ...prev, lead_id: onboardedLeads[0].id }));
              }
              setLogModalOpen(true);
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Log Onboarded Order</span>
          </button>

          <button
            type="button"
            onClick={() => loadMoney(false)}
            aria-label="Refresh Money metrics"
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Cards — Featuring "Incentives (2% of COD)" */}
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
            2.0% commission on onboarded merchant COD ({selectedMonth})
          </p>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
              Onboarded COD (1–31)
            </span>
            <Wallet className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
            {loading ? '...' : formatBdt(totalMonthEligibleCod)}
          </p>
          <p className="mt-1 text-xs text-[#475569]">
            Eligible COD from your onboarded merchants only
          </p>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
              Onboarded Merchant Orders
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
              Daily order volume and total COD across calendar days 1 through 31 (Onboarded
              Merchants only)
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
                pt.eligibleCod > 0
                  ? Math.max(10, Math.round((pt.eligibleCod / maxDailyCod) * 110))
                  : 3;
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
              {onboardedLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs text-[#475569]">
                    You currently have <strong>0 Onboarded Merchants</strong> in your Lead Bank.
                    Once you mark a merchant&apos;s stage as <strong>Onboarded</strong> in{' '}
                    <em>My Lead Bank</em>, their orders and COD from{' '}
                    <span className="font-mono">hive.carrybee.com/orders</span> will sync and appear
                    here automatically.
                  </td>
                </tr>
              ) : merchants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs text-[#475569]">
                    You have <strong>{onboardedLeads.length}</strong> Onboarded Merchant
                    {onboardedLeads.length === 1 ? '' : 's'}, with no orders synced for{' '}
                    {selectedMonth} yet. Open{' '}
                    <span className="font-mono">https://hive.carrybee.com/orders</span> with the
                    Chrome Extension installed and orders will sync automatically.
                  </td>
                </tr>
              ) : (
                merchants.map((m) => (
                  <tr key={m.merchantKey} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3 font-semibold text-[#0F172A]">
                      <div>{m.merchantName}</div>
                      <div className="font-mono text-[11px] font-normal text-[#64748B]">
                        {m.merchantPhone || m.carrybeeMerchantId || 'Matched Onboarded Merchant'}
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

      {/* Zero-Config Carrybee Hive Chrome Extension Card (No Token / No Button Required) */}
      <div className="rounded-lg border border-[#CBD5E1] bg-white p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
                Chrome Extension v2.0 · Zero-Config Auto-Sync
              </span>
              <span className="rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#047857]">
                No Token · No Button Needed
              </span>
            </div>
            <h3 className="mt-1.5 text-sm font-bold text-[#0F172A]">
              Carrybee Hive Orders Automatic Tracker (hive.carrybee.com/orders)
            </h3>
            <p className="mt-0.5 text-xs text-[#475569]">
              Automatically pairs with your signed-in Dashboard session ({member.full_name}) and
              background-syncs orders from{' '}
              <span className="font-mono">https://hive.carrybee.com/orders</span>{' '}
              <strong>exclusively for merchants marked Onboarded</strong> in your Lead Bank.
            </p>
          </div>

          <a
            href="/carrybee-hive-tracker-extension.zip"
            download
            className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md bg-[#0F172A] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1E293B]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Auto-Sync Extension (.zip)</span>
          </a>
        </div>

        <ol className="mt-4 list-inside list-decimal space-y-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs text-[#334155]">
          <li>
            Unzip <span className="font-mono font-semibold">carrybee-hive-tracker-extension.zip</span>{' '}
            and load it in <span className="font-mono font-semibold">chrome://extensions</span>{' '}
            (<strong>Developer mode</strong> &rarr; <strong>Load unpacked</strong>, or click{' '}
            <strong>Reload</strong> if already installed).
          </li>
          <li>
            <strong>No token or button needed:</strong> While signed into this Dashboard, open{' '}
            <span className="font-mono">https://hive.carrybee.com/orders</span> — the extension
            connects automatically and syncs COD <strong>only</strong> when a merchant is marked{' '}
            <strong>Onboarded</strong> in your Lead Bank.
          </li>
        </ol>
      </div>

      {/* Manual Order Log Modal (Strictly Onboarded Merchants Only) */}
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

            {onboardedLeads.length === 0 ? (
              <div className="space-y-4 text-xs text-[#334155]">
                <div className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] p-3.5 text-[#92400E]">
                  <strong>No Onboarded Merchants Yet:</strong> COD orders can only be recorded for
                  merchants marked as <strong>Onboarded</strong> in your Lead Bank Dashboard. Mark a
                  merchant as Onboarded in <em>My Lead Bank</em> first.
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setLogModalOpen(false)}
                    className="cursor-pointer rounded-md border border-[#CBD5E1] bg-white px-4 py-2 font-semibold text-[#334155]"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveOrder} className="space-y-3.5 text-xs">
                <div>
                  <label htmlFor="o-lead" className="mb-1 block font-semibold text-[#334155]">
                    Onboarded Merchant *
                  </label>
                  <select
                    id="o-lead"
                    required
                    value={orderForm.lead_id}
                    onChange={(e) => setOrderForm({ ...orderForm, lead_id: e.target.value })}
                    className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-[#0F172A]"
                  >
                    {onboardedLeads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.business_name} ({l.contact_number || 'no phone'})
                      </option>
                    ))}
                  </select>
                </div>

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
                    placeholder="e.g. F1116RMAR3P"
                    className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 font-mono text-[#0F172A]"
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
                      placeholder="e.g. 850"
                      className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 font-mono text-[#0F172A]"
                    />
                  </div>
                </div>

                {orderError && (
                  <p className="rounded border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 font-medium text-[#991B1B]">
                    {orderError}
                  </p>
                )}

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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
