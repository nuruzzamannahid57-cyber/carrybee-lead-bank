(function () {
  if (window.__CARRYBEE_LEADBANK_HOOKED_V2__) return;
  window.__CARRYBEE_LEADBANK_HOOKED_V2__ = true;

  function toDhakaDateString(rawDate) {
    const s = String(rawDate || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // If timestamp already formatted in local YYYY-MM-DD HH:mm:ss without timezone offset
    const localMatch = s.match(/^(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}/);
    if (localMatch) return localMatch[1];

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      try {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Dhaka',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(parsed);
      } catch (_) {
        return parsed.toISOString().slice(0, 10);
      }
    }

    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  function findOrderArray(node, depth) {
    if (!node || typeof node !== 'object' || depth > 4) return [];
    if (Array.isArray(node)) {
      if (
        node.length > 0 &&
        typeof node[0] === 'object' &&
        node[0] !== null &&
        (node[0].consignment_id ||
          node[0].tracking_code ||
          node[0].order_id ||
          node[0].invoice_id ||
          node[0].cod_amount !== undefined ||
          node[0].amount_to_collect !== undefined ||
          node[0].collectable_amount !== undefined ||
          node[0].merchant ||
          node[0].store)
      ) {
        return node;
      }
      return [];
    }

    const priorityKeys = ['orders', 'consignments', 'items', 'results', 'rows', 'list', 'data'];
    for (const k of priorityKeys) {
      if (node[k] !== undefined) {
        const found = findOrderArray(node[k], depth + 1);
        if (found.length > 0) return found;
      }
    }
    return [];
  }

  function extractOrdersFromPayload(json) {
    const candidates = findOrderArray(json, 0);
    if (!candidates.length) return [];

    const out = [];
    for (const row of candidates) {
      if (!row || typeof row !== 'object') continue;
      const orderId =
        row.consignment_id ||
        row.tracking_code ||
        row.order_code ||
        row.order_id ||
        row.invoice_id ||
        row.id;

      const merchantObj = row.merchant || row.store || row.shop || row.business || {};
      const storeObj = row.store || row.shop || {};

      const merchantName =
        row.merchant_name ||
        row.business_name ||
        merchantObj.business_name ||
        merchantObj.name ||
        row.store_name ||
        storeObj.name ||
        '';

      const storeAlias =
        row.store_name ||
        storeObj.name ||
        storeObj.store_name ||
        merchantObj.store_name ||
        '';

      const merchantPhone =
        row.merchant_phone ||
        row.store_phone ||
        merchantObj.phone ||
        merchantObj.contact_number ||
        merchantObj.mobile ||
        storeObj.phone ||
        '';

      const merchantId =
        row.merchant_id ||
        merchantObj.id ||
        merchantObj.merchant_id ||
        row.store_id ||
        storeObj.id ||
        '';

      const rawCod =
        row.cod_amount ??
        row.amount_to_collect ??
        row.collectable_amount ??
        row.cash_collection ??
        row.cod ??
        row.total_cod ??
        row.collection_amount;

      const rawDate =
        row.created_at || row.order_date || row.placed_at || row.updated_at || row.date || '';

      const status =
        row.status_label ||
        row.order_status ||
        row.delivery_status ||
        row.status ||
        'confirmed';

      if (orderId && (merchantName || merchantId || merchantPhone)) {
        const numericCod =
          rawCod !== undefined && rawCod !== null
            ? Number(String(rawCod).replace(/[^0-9.-]/g, '')) || 0
            : 0;

        out.push({
          external_order_id: String(orderId).trim(),
          merchant_name: String(merchantName || '').trim(),
          merchant_store_alias: String(storeAlias || '').trim(),
          merchant_phone: String(merchantPhone || '').trim(),
          carrybee_merchant_id: String(merchantId || '').trim(),
          cod_amount: Math.max(0, numericCod),
          order_date: toDhakaDateString(rawDate),
          order_status: String(status || 'confirmed').trim(),
          capture_type: 'api',
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
      const ct = (resp.headers && resp.headers.get && resp.headers.get('content-type')) || '';
      if (ct.includes('json')) {
        resp
          .clone()
          .json()
          .then((data) => broadcastOrders(extractOrdersFromPayload(data)))
          .catch(() => {});
      }
    } catch (_) {}
    return resp;
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        if (this.responseText && this.responseText.trim().startsWith('{')) {
          const json = JSON.parse(this.responseText);
          broadcastOrders(extractOrdersFromPayload(json));
        }
      } catch (_) {}
    });
    return origSend.apply(this, args);
  };
})();
