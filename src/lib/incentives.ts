import type { DailyCodPoint, MerchantMoneySummary, MerchantOrder } from './types';

export const INCENTIVE_RATE = 0.02; // 2% of total eligible merchant COD

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

export function formatShortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

/**
 * Exact Carrybee Merchant Attribution Window:
 * - Shows COD from Day 1 to Day 31 of the selected month.
 * - If a merchant starts ordering on Day 1 of month M: tracked across all days (1..30/31) of month M.
 * - If a merchant starts ordering after Day 1 (e.g. 16th day of a 30-day month -> 15 days of same month
 *   + full 30/31 days of next month): tracked from firstOrderDate through the last day of the NEXT month.
 */
export function computeMerchantTrackingWindow(firstOrderDate: string): {
  windowStart: string;
  windowEnd: string;
  isMidMonthSplit: boolean;
  firstMonthDays: number;
  nextMonthDays: number;
  windowLabel: string;
} {
  const [y, m, d] = firstOrderDate.split('-').map(Number);
  const dimFirst = daysInMonth(y, m);

  if (d <= 1) {
    const windowEnd = `${y}-${pad2(m)}-${pad2(dimFirst)}`;
    return {
      windowStart: firstOrderDate,
      windowEnd,
      isMidMonthSplit: false,
      firstMonthDays: dimFirst,
      nextMonthDays: 0,
      windowLabel: `${formatShortDate(firstOrderDate)} – ${formatShortDate(windowEnd)} (${dimFirst}d full month)`,
    };
  }

  const firstMonthRemaining = dimFirst - d + 1; // e.g., Nov 16..30 = 30 - 16 + 1 = 15 days
  const nextYear = m === 12 ? y + 1 : y;
  const nextMonth = m === 12 ? 1 : m + 1;
  const dimNext = daysInMonth(nextYear, nextMonth);
  const windowEnd = `${nextYear}-${pad2(nextMonth)}-${pad2(dimNext)}`;

  return {
    windowStart: firstOrderDate,
    windowEnd,
    isMidMonthSplit: true,
    firstMonthDays: firstMonthRemaining,
    nextMonthDays: dimNext,
    windowLabel: `${formatShortDate(firstOrderDate)} – ${formatShortDate(windowEnd)} (${firstMonthRemaining}d M1 + ${dimNext}d M2)`,
  };
}

export function buildMonthlyMoneyReport(
  allOrders: MerchantOrder[],
  selectedMonth: string // YYYY-MM
): {
  selectedMonth: string;
  daysInSelectedMonth: number;
  dailySeries: DailyCodPoint[];
  merchants: MerchantMoneySummary[];
  totalMonthOrders: number;
  totalMonthEligibleCod: number;
  totalIncentive2Pct: number;
  activeMerchantsCount: number;
} {
  const [selYear, selMonth] = selectedMonth.split('-').map(Number);
  const maxDay = daysInMonth(selYear, selMonth);

  // Group orders by merchant identity (lead_id if linked, else carrybee_merchant_id, else normalized name+phone)
  const grouped = new Map<string, MerchantOrder[]>();
  for (const ord of allOrders) {
    // Ignore cancelled/returned orders if explicitly marked cancelled
    const st = (ord.order_status || '').toLowerCase();
    if (st === 'cancelled' || st === 'canceled') continue;

    const key =
      ord.lead_id ||
      (ord.carrybee_merchant_id ? `cb:${ord.carrybee_merchant_id.toLowerCase()}` : '') ||
      `name:${ord.merchant_name.trim().toLowerCase()}|${ord.merchant_phone.trim()}`;
    const arr = grouped.get(key) || [];
    arr.push(ord);
    grouped.set(key, arr);
  }

  // Initialize 1..31 daily array (always 1 to 31 per spec, marking days <= maxDay with exact date)
  const dailyMap = new Map<number, { orderCount: number; eligibleCod: number }>();
  for (let d = 1; d <= 31; d++) {
    dailyMap.set(d, { orderCount: 0, eligibleCod: 0 });
  }

  const merchantSummaries: MerchantMoneySummary[] = [];

  for (const [merchantKey, mOrders] of grouped.entries()) {
    const sorted = [...mOrders].sort((a, b) => a.order_date.localeCompare(b.order_date));
    const firstOrder = sorted[0];
    const win = computeMerchantTrackingWindow(firstOrder.order_date);

    let lifetimeOrdersInWindow = 0;
    let lifetimeEligibleCod = 0;
    let monthOrderCount = 0;
    let monthEligibleCod = 0;

    for (const ord of sorted) {
      const cod = Number(ord.cod_amount) || 0;
      const isInWindow = ord.order_date >= win.windowStart && ord.order_date <= win.windowEnd;
      if (!isInWindow) continue;

      lifetimeOrdersInWindow += 1;
      lifetimeEligibleCod += cod;

      if (ord.order_date.startsWith(`${selectedMonth}-`)) {
        const dayNum = Number(ord.order_date.slice(8, 10));
        monthOrderCount += 1;
        monthEligibleCod += cod;
        const slot = dailyMap.get(dayNum);
        if (slot) {
          slot.orderCount += 1;
          slot.eligibleCod += cod;
        }
      }
    }

    // Include merchant in view if selectedMonth overlaps their eligibility window OR they had orders in selectedMonth
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = `${selectedMonth}-${pad2(maxDay)}`;
    const windowOverlapsSelectedMonth = win.windowStart <= monthEnd && win.windowEnd >= monthStart;

    if (windowOverlapsSelectedMonth || monthOrderCount > 0) {
      merchantSummaries.push({
        merchantKey,
        leadId: firstOrder.lead_id,
        merchantName: firstOrder.merchant_name,
        merchantPhone: firstOrder.merchant_phone,
        carrybeeMerchantId: firstOrder.carrybee_merchant_id,
        firstOrderDate: firstOrder.order_date,
        windowStart: win.windowStart,
        windowEnd: win.windowEnd,
        windowLabel: win.windowLabel,
        isMidMonthSplit: win.isMidMonthSplit,
        monthOrderCount,
        monthEligibleCod: Math.round(monthEligibleCod * 100) / 100,
        monthIncentive: Math.round(monthEligibleCod * INCENTIVE_RATE * 100) / 100,
        lifetimeOrdersInWindow,
        lifetimeEligibleCod: Math.round(lifetimeEligibleCod * 100) / 100,
      });
    }
  }

  merchantSummaries.sort((a, b) => b.monthEligibleCod - a.monthEligibleCod);

  const dailySeries: DailyCodPoint[] = [];
  let totalMonthOrders = 0;
  let totalMonthEligibleCod = 0;

  for (let d = 1; d <= 31; d++) {
    const item = dailyMap.get(d)!;
    const codRounded = Math.round(item.eligibleCod * 100) / 100;
    totalMonthOrders += item.orderCount;
    totalMonthEligibleCod += codRounded;
    dailySeries.push({
      day: d,
      dateStr: d <= maxDay ? `${selectedMonth}-${pad2(d)}` : '—',
      orderCount: item.orderCount,
      eligibleCod: codRounded,
      incentiveAmount: Math.round(codRounded * INCENTIVE_RATE * 100) / 100,
    });
  }

  totalMonthEligibleCod = Math.round(totalMonthEligibleCod * 100) / 100;
  const totalIncentive2Pct = Math.round(totalMonthEligibleCod * INCENTIVE_RATE * 100) / 100;

  return {
    selectedMonth,
    daysInSelectedMonth: maxDay,
    dailySeries,
    merchants: merchantSummaries,
    totalMonthOrders,
    totalMonthEligibleCod,
    totalIncentive2Pct,
    activeMerchantsCount: merchantSummaries.length,
  };
}
