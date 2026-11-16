(function () {
  const capturedMap = new Map();
  let autoSyncTimer = null;
  let lastSyncedSignature = '';
  let statusPill = null;
  let dotEl = null;
  let textEl = null;

  function currentDhakaDate() {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  // Extract distinct text nodes inside a <td> so multi-line child <div>/<span> values NEVER glue together!
  function getCellTokens(cell) {
    if (!cell) return [];
    const tokens = [];
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null);
    let node = walker.nextNode();
    while (node) {
      const val = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (val) tokens.push(val);
      node = walker.nextNode();
    }
    return tokens;
  }

  function parseDateFromTokens(tokens) {
    const joined = tokens.join(' | ');
    const iso = joined.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = joined.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    for (const tok of tokens) {
      if (/[a-zA-Z]{3}\s+\d{1,2},?\s+\d{4}/.test(tok)) {
        const d = new Date(tok);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      }
    }
    return currentDhakaDate();
  }

  function parseOrderIdFromTokens(tokens) {
    for (const tok of tokens) {
      // Handle both clean token ("F1116RMAR3P") and any glued fallback ("F1116RMAR3PN/A2026-11-17...")
      const clean = tok
        .replace(/N\/A.*$/i, '')
        .replace(/\d{4}-\d{2}-\d{2}.*$/, '')
        .trim();
      if (/^[A-Z0-9-]{6,24}$/i.test(clean) && !/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        return clean;
      }
    }
    return (tokens[0] || '').split(/\s+/)[0].trim();
  }

  function parseMerchantFromTokens(tokens) {
    let merchantName = '';
    let storeAlias = '';
    let merchantPhone = '';
    let merchantId = '';

    for (const tok of tokens) {
      if (/^m\.\s*order\s*id/i.test(tok)) continue;

      const phoneMatch = tok.match(/(?:\+?880|0)?1[3-9]\d{8}/);
      if (phoneMatch && !merchantPhone) {
        merchantPhone = phoneMatch[0];
      }

      // Pure numeric store/merchant ID token (4 to 8 digits, not a 10/11-digit BD phone)
      if (/^\d{3,8}$/.test(tok) && !merchantId) {
        merchantId = tok;
        continue;
      }

      // Strip phone, "M. order id: ...", and trailing numeric IDs if inside same text node
      const stripped = tok
        .replace(/m\.\s*order\s*id.*$/i, '')
        .replace(/(?:\+?880|0)?1[3-9]\d{8}/g, '')
        .replace(/\d{4,10}$/, '')
        .trim();

      if (
        stripped &&
        stripped.length >= 2 &&
        !/^(n\/a|id|store|merchant|phone|:|-)+$/i.test(stripped) &&
        !merchantName
      ) {
        merchantName = stripped;
        const paren = stripped.match(/\((.+?)\)/);
        if (paren && paren[1]) {
          storeAlias = paren[1].trim();
        }
      }
    }

    return { merchantName, storeAlias, merchantPhone, merchantId };
  }

  // Extract ONLY the primary COD / Collectable amount — NEVER concatenate the separate Delivery Charge below it!
  function parseCodFromTokens(tokens) {
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      // Skip explicit fee/charge/discount labels
      if (/charge|fee|shipping|delivery|discount|weight|kg/i.test(tok) && !/cod|collect/i.test(tok)) {
        continue;
      }
      const numMatches = tok.match(/\d[\d,]*(?:\.\d{1,2})?/g);
      if (numMatches && numMatches.length > 0) {
        const val = Number(numMatches[0].replace(/,/g, ''));
        if (!isNaN(val) && val >= 0) {
          return val;
        }
      }
    }
    return 0;
  }

  function parseStatusFromTokens(tokens) {
    for (const tok of tokens) {
      const cleaned = tok.replace(/^\d+\s*/, '').trim();
      if (cleaned && /[a-zA-Z]{3,}/.test(cleaned)) {
        return cleaned;
      }
    }
    return 'confirmed';
  }

  function scanDomOrdersTable() {
    const tables = Array.from(document.querySelectorAll('table'));
    let addedOrUpdated = false;

    for (const table of tables) {
      const headerCells = Array.from(table.querySelectorAll('thead th, tr:first-child th'));
      const headers = headerCells.map((th) => (th.textContent || '').trim().toLowerCase());
      if (headers.length < 3) continue;

      const idxId = headers.findIndex((h) => /order|consignment|invoice|tracking|id/i.test(h));
      const idxMerchant = headers.findIndex((h) => /merchant|store|shop|business|seller/i.test(h));
      const idxCod = headers.findIndex((h) => /cod|collect|amount|price|payment|taka|bdt/i.test(h));
      const idxDate = headers.findIndex((h) => /date|created|placed|time/i.test(h));
      const idxStatus = headers.findIndex((h) => /status|state/i.test(h));

      if (idxId === -1 && idxMerchant === -1) continue;

      const rows = Array.from(table.querySelectorAll('tbody tr'));
      for (const tr of rows) {
        const tds = Array.from(tr.querySelectorAll('td'));
        if (tds.length < 3) continue;

        const idTokens = getCellTokens(tds[idxId >= 0 ? idxId : 0]);
        const merchantTokens = idxMerchant >= 0 ? getCellTokens(tds[idxMerchant]) : [];
        const codTokens = idxCod >= 0 ? getCellTokens(tds[idxCod]) : [];
        const dateTokens = [
          ...(idxDate >= 0 ? getCellTokens(tds[idxDate]) : []),
          ...idTokens,
        ];
        const statusTokens = idxStatus >= 0 ? getCellTokens(tds[idxStatus]) : [];

        const cleanId = parseOrderIdFromTokens(idTokens);
        if (!cleanId || cleanId.length < 4) continue;

        const existing = capturedMap.get(cleanId);
        // Never overwrite richer API-captured record with DOM fallback
        if (existing && existing.capture_type === 'api') continue;

        const mInfo = parseMerchantFromTokens(merchantTokens);
        const codNum = parseCodFromTokens(codTokens);
        const orderDate = parseDateFromTokens(dateTokens);
        const statusText = parseStatusFromTokens(statusTokens);

        capturedMap.set(cleanId, {
          external_order_id: cleanId,
          merchant_name: mInfo.merchantName,
          merchant_store_alias: mInfo.storeAlias,
          merchant_phone: mInfo.merchantPhone,
          carrybee_merchant_id: mInfo.merchantId,
          cod_amount: codNum,
          order_date: orderDate,
          order_status: statusText,
          capture_type: 'dom',
        });
        addedOrUpdated = true;
      }
    }

    if (addedOrUpdated) {
      scheduleAutoSync();
    }
  }

  // Passive Auto-Sync Status Pill (NO manual button, NO token prompt)
  function mountStatusPill() {
    if (statusPill || !document.body || !location.pathname.includes('/orders')) return;
    statusPill = document.createElement('div');
    statusPill.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:18px',
      'z-index:2147483647',
      'background:#0F172A',
      'color:#F8FAFC',
      'border:1px solid #334155',
      'border-radius:999px',
      'padding:7px 13px',
      'font-family:system-ui,-apple-system,sans-serif',
      'font-size:11.5px',
      'font-weight:500',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'box-shadow:0 4px 12px rgba(15,23,42,0.2)',
      'pointer-events:none',
    ].join(';');

    dotEl = document.createElement('span');
    dotEl.style.cssText =
      'width:8px;height:8px;border-radius:50%;background:#10B981;display:inline-block;flex-shrink:0';

    textEl = document.createElement('span');
    textEl.textContent = 'Carrybee Auto-Sync · Active (Onboarded Merchants Only)';

    statusPill.appendChild(dotEl);
    statusPill.appendChild(textEl);
    document.body.appendChild(statusPill);
  }

  function updatePill(state, text) {
    mountStatusPill();
    if (!textEl || !dotEl) return;
    dotEl.style.background =
      state === 'ok' ? '#10B981' : state === 'syncing' ? '#3B82F6' : '#F59E0B';
    textEl.textContent = text;
  }

  function runAutoSync(force) {
    if (!location.pathname.includes('/orders')) return;
    scanDomOrdersTable();
    const orders = Array.from(capturedMap.values());
    if (orders.length === 0 && !force) return;

    const sig = orders
      .map((o) => `${o.external_order_id}:${o.cod_amount}:${o.order_status}`)
      .sort()
      .join('|');

    if (!force && sig === lastSyncedSignature) return;
    lastSyncedSignature = sig;

    updatePill('syncing', 'Carrybee Auto-Sync · Checking Onboarded Merchants...');

    chrome.runtime.sendMessage(
      {
        type: 'AUTO_SYNC_ORDERS',
        orders,
      },
      (res) => {
        if (chrome.runtime.lastError || !res) return;
        if (!res.ok) {
          lastSyncedSignature = '';
          updatePill(
            'warn',
            'Carrybee Auto-Sync · Sign in once on Lead Bank Dashboard to auto-pair'
          );
          return;
        }

        const onbCount = Number(res.onboardedMerchantsCount || 0);
        const codBdt = Number(res.totalMonthEligibleCod || 0).toLocaleString('en-BD', {
          maximumFractionDigits: 2,
        });
        const incBdt = Number(res.totalIncentive2Pct || 0).toLocaleString('en-BD', {
          maximumFractionDigits: 2,
        });

        if (onbCount === 0) {
          updatePill(
            'ok',
            'Carrybee Auto-Sync · 0 Onboarded Merchants in Dashboard (COD: BDT 0)'
          );
        } else {
          updatePill(
            'ok',
            `Carrybee Auto-Sync · ${onbCount} Onboarded · COD: BDT ${codBdt} · 2%: BDT ${incBdt}`
          );
        }
      }
    );
  }

  function scheduleAutoSync(force) {
    if (autoSyncTimer) clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(() => runAutoSync(Boolean(force)), 700);
  }

  // Listen to API-intercepted orders from injected.js (MAIN world)
  window.addEventListener('message', (event) => {
    if (
      event.data &&
      event.data.source === 'CARRYBEE_HIVE_INTERCEPTOR' &&
      event.data.type === 'ORDERS_CAPTURED'
    ) {
      for (const ord of event.data.orders || []) {
        if (ord && ord.external_order_id) {
          capturedMap.set(ord.external_order_id, ord);
        }
      }
      scheduleAutoSync(false);
    }
  });

  // Allow background worker to trigger immediate re-sync when a merchant is marked Onboarded in Dashboard!
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'TRIGGER_AUTO_RESYNC') {
      lastSyncedSignature = '';
      runAutoSync(true);
      sendResponse({ ok: true });
    }
    return false;
  });

  function initAutoTracker() {
    if (location.pathname.includes('/orders')) {
      mountStatusPill();
      setTimeout(() => runAutoSync(true), 1200);
    }

    // Automatically observe table renders, pagination, date filters, and SPA route transitions
    const observer = new MutationObserver(() => {
      if (location.pathname.includes('/orders')) {
        mountStatusPill();
        scheduleAutoSync(false);
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    // Gentle background heartbeat every 20s while viewing /orders
    setInterval(() => {
      if (document.visibilityState === 'visible' && location.pathname.includes('/orders')) {
        scanDomOrdersTable();
      }
    }, 20000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoTracker);
  } else {
    initAutoTracker();
  }
})();
