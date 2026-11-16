(function () {
  function extractTokenFromLocalStorage() {
    try {
      const rawBridge = window.localStorage.getItem('carrybee_ext_bridge');
      if (rawBridge) {
        const parsed = JSON.parse(rawBridge);
        if (parsed && parsed.extensionToken) {
          return {
            dashboardUrl: parsed.dashboardUrl || window.location.origin,
            token: parsed.extensionToken,
            member: parsed.member || null,
          };
        }
      }

      // Fallback: auto-detect Supabase Auth session directly from localStorage (zero manual setup!)
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
              member: null,
            };
          }
        }
      }
    } catch (_) {}
    return null;
  }

  function pushSessionToExtension(reason) {
    const found = extractTokenFromLocalStorage();
    if (found && found.token) {
      chrome.runtime.sendMessage(
        {
          type: 'DASHBOARD_AUTO_AUTH',
          dashboardUrl: found.dashboardUrl,
          token: found.token,
          member: found.member,
          reason: reason || 'auto',
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
    }
  }

  // Initial automatic sync on page load
  pushSessionToExtension('page_load');
  setTimeout(() => pushSessionToExtension('delayed_check'), 1800);

  // Listen for live sign-in, lead stage changes (e.g. marking a merchant Onboarded), or sign-out
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'CARRYBEE_DASHBOARD_BRIDGE') return;

    if (event.data.type === 'DASHBOARD_STATE_SYNC' && event.data.payload) {
      const p = event.data.payload;
      chrome.runtime.sendMessage(
        {
          type: 'DASHBOARD_AUTO_AUTH',
          dashboardUrl: p.dashboardUrl || window.location.origin,
          token: p.extensionToken,
          member: p.member || null,
          reason: 'state_sync',
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
    } else if (event.data.type === 'DASHBOARD_LOGOUT') {
      chrome.runtime.sendMessage({ type: 'DASHBOARD_LOGOUT' }, () => {
        void chrome.runtime.lastError;
      });
    }
  });
})();
