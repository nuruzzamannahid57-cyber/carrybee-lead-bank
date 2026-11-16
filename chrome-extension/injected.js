(function () {
  if (window.__CARRYBEE_LEADBANK_HOOKED__) return;
  window.__CARRYBEE_LEADBANK_HOOKED__ = true;

  function extractOrdersFromPayload(json) {
    if (!json || typeof json !== 'object') return [];
    const candidates =
      (Array.isArray(json) && json) ||
      (Array.isArray(json.data) && json.data) ||
      (json.data && Array.isArray(json.data.orders) && json.data.orders) ||
      (json.data && Array.isArray(json.data.items) && json.data.items) ||
      (json.data && Array.isArray(json.data.results) && json.data.results) ||
      (Array.isArray(json.orders) && json.orders) ||
      (Array.isArray(json.results) && json.results) ||
      [];

    const out = [];
    for (const row of candidates) {
      if (!row || typeof row !== 'object') continue;
      const orderId =
        row.consignment_id ||
        row.tracking_code ||
        row.invoice_id ||
        row.order_code ||
        row.order_id ||
        row.id;
      const merchantObj = row.merchant || row.store || row.shop || {};
      const merchantName =
        row.merchant_name ||
        row.store_name ||
        row.shop_name ||
        row.business_name ||
        merchantObj.name ||
        merchantObj.business_name ||
        merchantObj.store_name ||
        '';
      const merchantPhone =
        row.merchant_phone ||
        row.store_phone ||
        merchantObj.phone ||
        merchantObj.contact_number ||
        merchantObj.mobile ||
        '';
      const merchantId =
        row.merchant_id || row.store_id || merchantObj.id || merchantObj.merchant_id || '';
      const rawCod =
        row.cod_amount ??
        row.amount_to_collect ??
        row.collectable_amount ??
        row.cash_collection ??
        row.cod ??
        row.total_cod ??
        0;
      const rawDate =
        row.created_at || row.order_date || row.placed_at || row.date || new Date().toISOString();
      const status = row.status || row.order_status || row.delivery_status || 'confirmed';

      if (orderId && (merchantName || merchantId || rawCod !== undefined)) {
        out.push({
          external_order_id: String(orderId),
          merchant_name: String(merchantName || ''),
          merchant_phone: String(merchantPhone || ''),
          carrybee_merchant_id: String(merchantId || ''),
          cod_amount: Number(String(rawCod).replace(/[^0-9.-]/g, '')) || 0,
          order_date: String(rawDate).slice(0, 10),
          order_status: String(status),
        });
      }
    }
    return out;
  }

  function broadcastOrders(orders) {
    if (orders && orders.length > 0) {
      window.postMessage(
        {
          source: 'CARRYBEE_HIVE_INTERCEPTOR',
          type: 'ORDERS_CAPTURED',
          orders,
        },
        '*'
      );
    }
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const resp = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
      if (/order|consignment|parcel|shipment/i.test(url)) {
        resp
          .clone()
          .json()
          .then((data) => broadcastOrders(extractOrdersFromPayload(data)))
          .catch(() => {});
      }
    } catch (_) {}
    return resp;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__cbUrl = String(url || '');
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        if (/order|consignment|parcel|shipment/i.test(this.__cbUrl || '')) {
          const json = JSON.parse(this.responseText);
          broadcastOrders(extractOrdersFromPayload(json));
        }
      } catch (_) {}
    });
    return origSend.apply(this, args);
  };
})();
