const urlInput = document.getElementById('dashboardUrl');
const tokenInput = document.getElementById('extensionToken');
const matchCheck = document.getElementById('matchOnlyOnboarded');
const saveBtn = document.getElementById('saveBtn');
const syncNowBtn = document.getElementById('syncNowBtn');
const memberNameEl = document.getElementById('memberName');
const merchantCountEl = document.getElementById('merchantCount');
const monthCodEl = document.getElementById('monthCod');
const incentiveValEl = document.getElementById('incentiveVal');
const statusMsgEl = document.getElementById('statusMsg');

function setStatus(msg) {
  statusMsgEl.textContent = msg;
}

async function verifyConnection(baseUrl, token) {
  const cleanUrl = String(baseUrl || '').replace(/\/+$/, '');
  if (!cleanUrl || !token) return;
  try {
    const resp = await fetch(`${cleanUrl}/api/extension/merchants`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json();
    if (!resp.ok) {
      setStatus(data.error || 'Token verification failed');
      return;
    }
    memberNameEl.textContent = data.member.full_name;
    merchantCountEl.textContent = String((data.onboardedMerchants || []).length);
    setStatus(`Connected as ${data.member.full_name} (${data.member.sheet_tab_name})`);
  } catch (err) {
    setStatus('Unable to reach Dashboard URL.');
  }
}

chrome.storage.local.get(
  ['dashboardUrl', 'extensionToken', 'matchOnlyOnboarded', 'lastSyncSummary'],
  (cfg) => {
    if (cfg.dashboardUrl) urlInput.value = cfg.dashboardUrl;
    if (cfg.extensionToken) tokenInput.value = cfg.extensionToken;
    matchCheck.checked = cfg.matchOnlyOnboarded !== false;
    if (cfg.lastSyncSummary) {
      monthCodEl.textContent = `BDT ${Number(cfg.lastSyncSummary.totalMonthEligibleCod || 0).toLocaleString()}`;
      incentiveValEl.textContent = `BDT ${Number(cfg.lastSyncSummary.totalIncentive2Pct || 0).toLocaleString()}`;
    }
    if (cfg.dashboardUrl && cfg.extensionToken) {
      verifyConnection(cfg.dashboardUrl, cfg.extensionToken);
    }
  }
);

saveBtn.addEventListener('click', () => {
  const dashboardUrl = urlInput.value.trim().replace(/\/+$/, '');
  const extensionToken = tokenInput.value.trim();
  const matchOnlyOnboarded = matchCheck.checked;
  chrome.storage.local.set({ dashboardUrl, extensionToken, matchOnlyOnboarded }, () => {
    setStatus('Saved. Verifying...');
    verifyConnection(dashboardUrl, extensionToken);
  });
});

syncNowBtn.addEventListener('click', async () => {
  setStatus('Scanning active Carrybee Hive Orders tab...');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !(tab.url || '').includes('hive.carrybee.com')) {
    setStatus('Open https://hive.carrybee.com/orders in the active tab first.');
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: 'SCAN_AND_GET_ORDERS' }, (scanRes) => {
    const orders = (scanRes && scanRes.orders) || [];
    if (orders.length === 0) {
      setStatus('No orders found on current view yet. Wait for orders table to load.');
      return;
    }
    setStatus(`Uploading ${orders.length} captured orders...`);
    chrome.runtime.sendMessage({ type: 'SYNC_ORDERS_TO_DASHBOARD', orders }, (syncRes) => {
      if (syncRes && syncRes.ok) {
        monthCodEl.textContent = `BDT ${Number(syncRes.totalMonthEligibleCod || 0).toLocaleString()}`;
        incentiveValEl.textContent = `BDT ${Number(syncRes.totalIncentive2Pct || 0).toLocaleString()}`;
        setStatus(`Synced ${syncRes.syncedOrders} orders (${syncRes.matchedCount} matched).`);
      } else {
        setStatus((syncRes && syncRes.error) || 'Sync failed.');
      }
    });
  });
});
