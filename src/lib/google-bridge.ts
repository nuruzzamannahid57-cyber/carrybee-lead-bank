import nodemailer from 'nodemailer';
import { getSupabaseAdmin } from './supabase/server';
import type { Lead } from './types';

export interface BridgeConfig {
  spreadsheetId: string;
  appsScriptUrl: string;
  bridgeSecret: string;
}

export async function getBridgeConfig(): Promise<BridgeConfig> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('app_settings').select('key, value');
  const map = new Map<string, string>();
  for (const row of data || []) {
    map.set(row.key, row.value);
  }
  return {
    spreadsheetId:
      map.get('spreadsheet_id') ||
      process.env.GOOGLE_SPREADSHEET_ID ||
      '1f46_Wp-j4RNf2B5ojEVDJQXuayjNojuuh5u6GJimavM',
    appsScriptUrl: map.get('google_apps_script_url') || process.env.GOOGLE_APPS_SCRIPT_URL || '',
    bridgeSecret:
      map.get('bridge_secret') || process.env.GOOGLE_APPS_SCRIPT_BRIDGE_SECRET || 'carrybee_bridge',
  };
}

async function callAppsScriptBridge(payload: Record<string, unknown>): Promise<{
  synced: boolean;
  detail?: string;
}> {
  const cfg = await getBridgeConfig();
  if (!cfg.appsScriptUrl) {
    return { synced: false, detail: 'Google Apps Script webhook URL not yet configured' };
  }
  try {
    const res = await fetch(cfg.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: cfg.bridgeSecret,
        spreadsheetId: cfg.spreadsheetId,
        ...payload,
      }),
    });
    if (!res.ok) {
      return { synced: false, detail: `Apps Script HTTP ${res.status}` };
    }
    const json = await res.json().catch(() => ({}));
    return { synced: Boolean(json?.ok ?? true), detail: json?.message };
  } catch (err) {
    return { synced: false, detail: err instanceof Error ? err.message : 'Bridge call failed' };
  }
}

export async function syncLeadAppendToSheet(sheetTabName: string, lead: Lead) {
  return callAppsScriptBridge({
    action: 'append_lead',
    tabName: sheetTabName,
    row: [
      lead.business_name,
      lead.fb_link,
      lead.contact_person,
      lead.contact_number,
      lead.product_category,
      lead.pickup_area,
    ],
    leadId: lead.id,
    stage: lead.stage,
  });
}

export async function syncLeadUpdateInSheet(sheetTabName: string, lead: Lead) {
  return callAppsScriptBridge({
    action: 'update_lead',
    tabName: sheetTabName,
    leadId: lead.id,
    phone: lead.contact_number,
    businessName: lead.business_name,
    row: [
      lead.business_name,
      lead.fb_link,
      lead.contact_person,
      lead.contact_number,
      lead.product_category,
      lead.pickup_area,
    ],
    stage: lead.stage,
  });
}

export async function syncLeadDeleteFromSheet(
  sheetTabName: string,
  lead: Pick<Lead, 'id' | 'business_name' | 'contact_number' | 'sheet_row_number'>
) {
  return callAppsScriptBridge({
    action: 'delete_lead',
    tabName: sheetTabName,
    leadId: lead.id,
    phone: lead.contact_number,
    businessName: lead.business_name,
    sheetRowNumber: lead.sheet_row_number,
  });
}

export async function provisionSheetTabAndSendConfidentialEmail(params: {
  fullName: string;
  email: string;
  roleLabel: string;
  sheetTabName: string;
  plainPassword: string;
  dashboardUrl: string;
}): Promise<{ sheetCreated: boolean; emailSent: boolean; deliveryMethod: string }> {
  // 1. Call Google Apps Script Bridge (creates the tab on Lead Bank Google Sheet + sends email from Gmail & auto-trashes from Sent Mail!)
  const bridgeRes = await callAppsScriptBridge({
    action: 'provision_member',
    tabName: params.sheetTabName,
    recipientEmail: params.email,
    fullName: params.fullName,
    roleLabel: params.roleLabel,
    generatedPassword: params.plainPassword,
    dashboardUrl: params.dashboardUrl,
  });

  if (bridgeRes.synced) {
    return {
      sheetCreated: true,
      emailSent: true,
      deliveryMethod: 'gmail_apps_script_auto_purge',
    };
  }

  // 2. Optional SMTP fallback if SMTP_HOST & SMTP_USER & SMTP_PASS are set in Vercel env
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: `"Carrybee Lead Bank" <${process.env.SMTP_USER}>`,
      to: params.email,
      subject: 'Your Confidential Carrybee Lead Bank Portal Credentials',
      text: [
        `Hello ${params.fullName},`,
        ``,
        `Your Carrybee Lead Bank account (${params.roleLabel}) has been provisioned.`,
        `Portal URL: ${params.dashboardUrl}`,
        `Login Email: ${params.email}`,
        `Auto-Generated Password: ${params.plainPassword}`,
        ``,
        `Security Notice: This password was generated automatically and stored strictly as an encrypted hash. Nobody—including the Super Admin—can view your password.`,
      ].join('\n'),
    });
    return {
      sheetCreated: false,
      emailSent: true,
      deliveryMethod: 'smtp_direct',
    };
  }

  return {
    sheetCreated: false,
    emailSent: false,
    deliveryMethod: 'pending_apps_script_bridge',
  };
}

export function buildGoogleAppsScriptSource(spreadsheetId: string, bridgeSecret: string): string {
  return `/**
 * Carrybee Lead Bank — Live Google Sheets + Confidential Gmail Auto-Purge Bridge
 * 1. Open https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit
 * 2. Click Extensions -> Apps Script, paste this script, and click Deploy -> New deployment -> Web app
 * 3. Execute as: Me (Nuruzzaman Nahid) | Who has access: Anyone
 * 4. Copy the Web App URL into the Lead Bank Dashboard -> Team & Sheet Sync tab.
 */
const SPREADSHEET_ID = '${spreadsheetId}';
const BRIDGE_SECRET = '${bridgeSecret}';
const HEADERS = [
  'Business name',
  'Business FB Link',
  'Contact Person',
  'Contact  Number\\n[Format: 17xxxxxxxx]',
  'Product Category',
  'Pick up Area'
];

function ensureMemberTab(ss, tabName) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.getRange('A2:F1000').setNumberFormat('@');
  }
  return sheet;
}

function sendConfidentialPasswordAndDeleteSentCopy(to, fullName, roleLabel, _tabName, password, dashboardUrl) {
  const subject = 'Carrybee Lead Bank — Confidential Access Credentials';
  const body = [
    'Hello ' + fullName + ',',
    '',
    'Your Carrybee Lead Bank Dashboard account has been created.',
    '',
    'Role: ' + roleLabel,
    'Dashboard URL: ' + dashboardUrl,
    'Login Email: ' + to,
    'Auto-Generated Password: ' + password,
    '',
    'Confidentiality Notice: This password was auto-generated by the server, hashed in Supabase, and automatically purged from the sender\\'s Sent Mail immediately after dispatch.'
  ].join('\\n');

  GmailApp.sendEmail(to, subject, body);
  Utilities.sleep(1500);

  // Immediately move the sent copy out of Sent Mail to Trash (or permanently remove if Advanced Gmail Service is enabled)
  const threads = GmailApp.search('in:sent to:' + to + ' subject:"' + subject + '" newer_than:1d', 0, 3);
  for (const thread of threads) {
    thread.moveToTrash();
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.secret !== BRIDGE_SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, message: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(data.spreadsheetId || SPREADSHEET_ID);
    const action = data.action;

    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Bridge connected to ' + ss.getName() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'provision_member') {
      ensureMemberTab(ss, data.tabName);
      if (data.recipientEmail && data.generatedPassword) {
        sendConfidentialPasswordAndDeleteSentCopy(
          data.recipientEmail,
          data.fullName,
          data.roleLabel,
          data.tabName,
          data.generatedPassword,
          data.dashboardUrl
        );
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Tab created and password emailed + purged' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = ensureMemberTab(ss, data.tabName);

    if (action === 'append_lead') {
      const nextRow = sheet.getLastRow() + 1;
      const range = sheet.getRange(nextRow, 1, 1, 6);
      range.setNumberFormat('@');
      range.setValues([data.row]);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, row: nextRow }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'update_lead' || action === 'delete_lead') {
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const values = sheet.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
        for (let i = values.length - 1; i >= 0; i--) {
          const rName = (values[i][0] || '').trim();
          const rPhone = (values[i][3] || '').trim();
          const matchPhone = data.phone && rPhone === String(data.phone).trim();
          const matchName = !data.phone && rName === String(data.businessName || '').trim();
          if (matchPhone || matchName) {
            if (action === 'delete_lead') {
              sheet.deleteRow(i + 2);
            } else {
              const rng = sheet.getRange(i + 2, 1, 1, 6);
              rng.setNumberFormat('@');
              rng.setValues([data.row]);
            }
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
}
