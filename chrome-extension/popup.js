const liveBadgeEl = document.getElementById('liveBadge');
const badgeTextEl = document.getElementById('badgeText');
const memberNameEl = document.getElementById('memberName');
const merchantCountEl = document.getElementById('merchantCount');
const monthCodEl = document.getElementById('monthCod');
const incentiveValEl = document.getElementById('incentiveVal');
const openDashboardLinkEl = document.getElementById('openDashboardLink');
const footerMetaEl = document.getElementById('footerMeta');

function fmtBdt(n) {
  return `BDT ${Number(n || 0).toLocaleString('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function renderSummary(data) {
  if (!data || !data.ok) {
    liveBadgeEl.classList.add('warn');
    badgeTextEl.textContent = 'Sign In Needed';
    memberNameEl.textContent = 'Not Signed In';
    merchantCountEl.textContent = '0';
    monthCodEl.textContent = 'BDT 0';
    incentiveValEl.textContent = 'BDT 0';
    openDashboardLinkEl.style.display = 'block';
    if (data && data.dashboardUrl) {
      openDashboardLinkEl.href = data.dashboardUrl;
    }
    footerMetaEl.textContent =
      (data && data.error) || 'Sign in once on Carrybee Lead Bank Dashboard to auto-pair.';
    return;
  }

  liveBadgeEl.classList.remove('warn');
  badgeTextEl.textContent = 'Auto-Sync Live';
  openDashboardLinkEl.style.display = 'none';

  const member = data.member || {};
  const onbCount =
    data.onboardedMerchantsCount !== undefined
      ? Number(data.onboardedMerchantsCount)
      : Array.isArray(data.onboardedMerchants)
        ? data.onboardedMerchants.length
        : 0;

  memberNameEl.textContent = member.full_name || 'Connected';
  merchantCountEl.textContent = String(onbCount);

  // Strictly show BDT 0 when Onboarded Merchants is 0
  if (onbCount === 0) {
    monthCodEl.textContent = 'BDT 0';
    incentiveValEl.textContent = 'BDT 0';
    footerMetaEl.textContent = `Connected as ${member.full_name || ''} · 0 Onboarded Merchants in Dashboard`;
  } else {
    monthCodEl.textContent = fmtBdt(data.totalMonthEligibleCod || 0);
    incentiveValEl.textContent = fmtBdt(data.totalIncentive2Pct || 0);
    footerMetaEl.textContent = `Connected as ${member.full_name || ''} · ${data.month || ''} Auto-Synced`;
  }
}

// Render cached state immediately if available, then refresh live from server + open Hive tab
chrome.storage.local.get(['lastSummary'], (cfg) => {
  if (cfg && cfg.lastSummary) {
    renderSummary(cfg.lastSummary);
  }
});

chrome.runtime.sendMessage({ type: 'GET_LIVE_POPUP_SUMMARY' }, (fresh) => {
  if (!chrome.runtime.lastError && fresh) {
    renderSummary(fresh);
  }
});
