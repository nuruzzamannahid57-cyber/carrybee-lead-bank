const DEFAULT_DASHBOARD_URL = 'https://carrybee-lead-bank-gamma.vercel.app';

// Auto-discover logged-in session from any open Lead Bank Dashboard tab (zero manual token needed!)
async function discoverSessionFromDashboardTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        'https://carrybee-lead-bank-gamma.vercel.app/*',
        'https://*.vercel.app/*',
        'http://localhost:3000/*',
      ],
    });

    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              const rawBridge = window.localStorage.getItem('carrybee_ext_bridge');
              if (rawBridge) {
                const parsed = JSON.parse(rawBridge);
                if (parsed && parsed.extensionToken) {
                  return {
                    dashboardUrl: parsed.dashboardUrl || window.location.origin,
                    token: parsed.extensionToken,
                  };
                }
              }
              for (let i = 0; i < window.localStorage.length; i++) {
                const k = window.localStorage.key(i) || '';
                if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
                  const val = JSON.parse(window.localStorage.getItem(k) || 'null');
                  const accessToken =
                    (val && val.access_token) ||
                    (val && val.currentSession && val.currentSession.access_token) ||
                    '';
                  if (accessToken) {
                    return {
                      dashboardUrl: window.location.origin,
                      token: accessToken,
                    };
                  }
                }
              }
            } catch (_) {}
            return null;
          },
        });

        const found = results && results[0] && results[0].result;
        if (found && found.token) {
          await chrome.storage.local.set({
            dashboardUrl: found.dashboardUrl || DEFAULT_DASHBOARD_URL,
            extensionToken: found.token,
          });
          return found;
        }
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

async function getAuthCredentials() {
  const cfg = await chrome.storage.local.get(['dashboardUrl', 'extensionToken']);
  let baseUrl = String(cfg.dashboardUrl || DEFAULT_DASHBOARD_URL).replace(/\/+$/, '');
  let token = String(cfg.extensionToken || '').trim();

  if (!token) {
    const discovered = await discoverSessionFromDashboardTabs();
    if (discovered && discovered.token) {
      baseUrl = String(discovered.dashboardUrl || DEFAULT_DASHBOARD_URL).replace(/\/+$/, '');
      token = String(discovered.token).trim();
    }
  }

  return { baseUrl, token };
}

async function fetchLiveSummary() {
  let { baseUrl, token } = await getAuthCredentials();
  if (!token) {
    return {
      ok: false,
      needsDashboardLogin: true,
      dashboardUrl: baseUrl || DEFAULT_DASHBOARD_URL,
      error: 'Sign in once to the Carrybee Lead Bank Dashboard to connect automatically.',
    };
  }

  try {
    let resp = await fetch(`${baseUrl}/api/extension/merchants`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // If stored token expired (e.g. rotated), re-discover from open Dashboard tab automatically
    if (resp.status === 401) {
      const discovered = await discoverSessionFromDashboardTabs();
      if (discovered && discovered.token && discovered.token !== token) {
        baseUrl = String(discovered.dashboardUrl || DEFAULT_DASHBOARD_URL).replace(/\/+$/, '');
        token = discovered.token;
        resp = await fetch(`${baseUrl}/api/extension/merchants`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }

    const data = await resp.json();
    if (!resp.ok) {
      return {
        ok: false,
        needsDashboardLogin: true,
        dashboardUrl: baseUrl,
        error: data.error || 'Open Carrybee Lead Bank Dashboard once to auto-connect.',
      };
    }

    // Upgrade to persistent extensionToken returned by server so it works even when Dashboard tab is closed
    const updates = {
      dashboardUrl: baseUrl,
      lastSummary: data,
      lastSyncAt: new Date().toISOString(),
    };
    if (data.extensionToken) {
      updates.extensionToken = data.extensionToken;
    }
    await chrome.storage.local.set(updates);
    return { ...data, ok: true, dashboardUrl: baseUrl };
  } catch (err) {
    return {
      ok: false,
      dashboardUrl: baseUrl,
      error: err && err.message ? err.message : 'Unable to reach Carrybee Lead Bank server.',
    };
  }
}

async function notifyHiveTabsToResync() {
  try {
    const hiveTabs = await chrome.tabs.query({ url: ['https://hive.carrybee.com/*'] });
    for (const t of hiveTabs) {
      if (t.id) {
        chrome.tabs.sendMessage(t.id, { type: 'TRIGGER_AUTO_RESYNC' }, () => {
          void chrome.runtime.lastError;
        });
      }
    }
  } catch (_) {}
}

async function handleAutoSyncOrders(orders) {
  let { baseUrl, token } = await getAuthCredentials();
  if (!token) {
    return {
      ok: false,
      needsDashboardLogin: true,
      error: 'Sign in once on Carrybee Lead Bank Dashboard to auto-pair.',
    };
  }

  try {
    let resp = await fetch(`${baseUrl}/api/extension/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orders: orders || [] }),
    });

    if (resp.status === 401) {
      const discovered = await discoverSessionFromDashboardTabs();
      if (discovered && discovered.token && discovered.token !== token) {
        baseUrl = String(discovered.dashboardUrl || DEFAULT_DASHBOARD_URL).replace(/\/+$/, '');
        token = discovered.token;
        resp = await fetch(`${baseUrl}/api/extension/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orders: orders || [] }),
        });
      }
    }

    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: data.error || `HTTP ${resp.status}` };
    }

    const updates = {
      dashboardUrl: baseUrl,
      lastSummary: data,
      lastSyncAt: new Date().toISOString(),
    };
    if (data.extensionToken) {
      updates.extensionToken = data.extensionToken;
    }
    await chrome.storage.local.set(updates);
    return data;
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'Network error' };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  fetchLiveSummary().then(() => notifyHiveTabsToResync());
});

chrome.runtime.onStartup.addListener(() => {
  fetchLiveSummary();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return false;

  if (message.type === 'DASHBOARD_AUTO_AUTH') {
    const cleanUrl = String(message.dashboardUrl || DEFAULT_DASHBOARD_URL).replace(/\/+$/, '');
    const tok = String(message.token || '').trim();
    if (tok) {
      chrome.storage.local
        .set({ dashboardUrl: cleanUrl, extensionToken: tok })
        .then(() => fetchLiveSummary())
        .then((summary) => {
          // Immediately trigger open Hive tabs to re-sync whenever Dashboard auth or Onboarded leads change!
          notifyHiveTabsToResync();
          sendResponse(summary);
        });
      return true;
    }
  }

  if (message.type === 'DASHBOARD_LOGOUT') {
    chrome.storage.local.remove(['extensionToken', 'lastSummary'], () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'AUTO_SYNC_ORDERS') {
    handleAutoSyncOrders(message.orders || []).then(sendResponse);
    return true;
  }

  if (message.type === 'GET_LIVE_POPUP_SUMMARY') {
    // Trigger any open Hive orders tab to sync first, then return fresh onboarded-only summary
    notifyHiveTabsToResync().then(() => {
      setTimeout(() => {
        fetchLiveSummary().then(sendResponse);
      }, 350);
    });
    return true;
  }

  return false;
});
