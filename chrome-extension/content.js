(function () {
  const capturedMap = new Map();

  function parseDateFallback(rawText) {
    const text = (rawText || '').trim();
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmy) {
      const dd = dmy[1].padStart(2, '0');
      const mm = dmy[2].padStart(2, '0');
      return `${dmy[3]}-${mm}-${dd}`;
    }
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  }

  function scanDomOrdersTable() {
    const tables = Array.from(document.querySelectorAll('table'));
    for (const table of tables) {
      const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th')).map((th) =>
        (th.textContent || '').trim().toLowerCase()
      );
      if (headers.length < 3) continue;

      const idxId = headers.findIndex((h) => /order|consignment|invoice|tracking|id/i.test(h));
      const idxMerchant = headers.findIndex((h) => /merchant|store|shop|business|seller/i.test(h));
      const idxCod = headers.findIndex((h) => /cod|collect|amount|price|total|taka|bdt/i.test(h));
      const idxDate = headers.findIndex((h) => /date|created|placed|time/i.test(h));
      const idxStatus = headers.findIndex((h) => /status|state/i.test(h));

      if (idxId === -1 && idxMerchant === -1) continue;

      const rows = Array.from(table.querySelectorAll('tbody tr'));
      for (const tr of rows) {
        const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim());
        if (cells.length < 3) continue;

        const extId = cells[idxId >= 0 ? idxId : 0] || '';
        const merchantCell = idxMerchant >= 0 ? cells[idxMerchant] || '' : '';
        const codCell = idxCod >= 0 ? cells[idxCod] || '0' : '0';
        const dateCell = idxDate >= 0 ? cells[idxDate] || '' : '';
        const statusCell = idxStatus >= 0 ? cells[idxStatus] || 'confirmed' : 'confirmed';

        // Extract phone if embedded in merchant cell
        const phoneMatch = merchantCell.match(/(?:\+?880|0)?1[3-9]\d{8}/);
        const merchantPhone = phoneMatch ? phoneMatch[0] : '';
        const cleanMerchantName = merchantCell
          .replace(/(?:\+?880|0)?1[3-9]\d{8}/g, '')
          .split('\n')[0]
          .trim();

        const cleanId = extId.split('\n')[0].trim();
        const codNum = Number(codCell.replace(/[^0-9.-]/g, '')) || 0;

        if (cleanId) {
          capturedMap.set(cleanId, {
            external_order_id: cleanId,
            merchant_name: cleanMerchantName || 'Carrybee Merchant',
            merchant_phone: merchantPhone,
            carrybee_merchant_id: '',
            cod_amount: codNum,
            order_date: parseDateFallback(dateCell),
            order_status: statusCell.split('\n')[0].trim() || 'confirmed',
          });
        }
      }
    }
    updateWidgetCount();
  }

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
      updateWidgetCount();
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'SCAN_AND_GET_ORDERS') {
      scanDomOrdersTable();
      sendResponse({ orders: Array.from(capturedMap.values()) });
    }
    return true;
  });

  // Formal Floating Sync Bar on https://hive.carrybee.com/orders
  let widgetEl = null;
  let statusSpan = null;

  function mountWidget() {
    if (widgetEl || !document.body) return;
    widgetEl = document.createElement('div');
    widgetEl.style.cssText = [
      'position:fixed',
      'right:20px',
      'bottom:20px',
      'z-index:2147483647',
      'background:#0F172A',
      'color:#F8FAFC',
      'border:1px solid #334155',
      'border-radius:8px',
      'padding:10px 14px',
      'font-family:system-ui,-apple-system,sans-serif',
      'font-size:12px',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'box-shadow:0 4px 12px rgba(15,23,42,0.18)',
    ].join(';');

    statusSpan = document.createElement('span');
    statusSpan.textContent = 'Lead Bank Tracker · 0 orders detected';

    const syncBtn = document.createElement('button');
    syncBtn.textContent = 'Sync COD';
    syncBtn.style.cssText = [
      'background:#059669',
      'color:#FFFFFF',
      'border:none',
      'border-radius:6px',
      'padding:6px 10px',
      'font-weight:600',
      'font-size:12px',
      'cursor:pointer',
    ].join(';');

    syncBtn.addEventListener('click', () => {
      scanDomOrdersTable();
      const orders = Array.from(capturedMap.values());
      syncBtn.textContent = 'Syncing...';
      chrome.runtime.sendMessage({ type: 'SYNC_ORDERS_TO_DASHBOARD', orders }, (res) => {
        if (res && res.ok) {
          syncBtn.textContent = 'Synced';
          statusSpan.textContent = `Synced ${res.syncedOrders} orders · 2% Incentive: BDT ${Number(res.totalIncentive2Pct || 0).toLocaleString()}`;
          setTimeout(() => {
            syncBtn.textContent = 'Sync COD';
          }, 2500);
        } else {
          syncBtn.textContent = 'Setup Token';
          statusSpan.textContent = (res && res.error) || 'Open extension popup to paste token';
        }
      });
    });

    widgetEl.appendChild(statusSpan);
    widgetEl.appendChild(syncBtn);
    document.body.appendChild(widgetEl);
  }

  function updateWidgetCount() {
    mountWidget();
    if (!statusSpan) return;
    const list = Array.from(capturedMap.values());
    const codSum = list.reduce((acc, o) => acc + (Number(o.cod_amount) || 0), 0);
    statusSpan.textContent = `Lead Bank · ${list.length} orders (BDT ${codSum.toLocaleString()})`;
  }

  if (location.pathname.includes('/orders')) {
    mountWidget();
    setTimeout(scanDomOrdersTable, 1800);
  }
})();
