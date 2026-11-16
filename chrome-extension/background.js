chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'SYNC_ORDERS_TO_DASHBOARD') {
    chrome.storage.local.get(['dashboardUrl', 'extensionToken', 'matchOnlyOnboarded'], async (cfg) => {
      const baseUrl = String(cfg.dashboardUrl || '').replace(/\/+$/, '');
      const token = String(cfg.extensionToken || '').trim();
      if (!baseUrl || !token) {
        sendResponse({
          ok: false,
          error: 'Configure Dashboard URL & Sync Token in extension popup first.',
        });
        return;
      }

      try {
        const resp = await fetch(`${baseUrl}/api/extension/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            orders: message.orders || [],
            matchOnlyOnboarded: cfg.matchOnlyOnboarded !== false,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          sendResponse({ ok: false, error: data.error || `HTTP ${resp.status}` });
          return;
        }
        await chrome.storage.local.set({ lastSyncSummary: data, lastSyncAt: new Date().toISOString() });
        sendResponse(data);
      } catch (err) {
        sendResponse({ ok: false, error: err && err.message ? err.message : 'Network error' });
      }
    });
    return true;
  }
});
