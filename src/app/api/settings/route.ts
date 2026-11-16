import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleAppsScriptSource, getBridgeConfig } from '@/lib/google-bridge';
import { getSupabaseAdmin, requireAuthenticatedMember } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (auth.member.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 });
  }

  const cfg = await getBridgeConfig();
  return NextResponse.json({
    spreadsheetId: cfg.spreadsheetId,
    appsScriptUrl: cfg.appsScriptUrl,
    appsScriptSource: buildGoogleAppsScriptSource(cfg.spreadsheetId, cfg.bridgeSecret),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedMember(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (auth.member.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const admin = getSupabaseAdmin();

  if (typeof body.appsScriptUrl === 'string') {
    const cleanUrl = body.appsScriptUrl.trim();
    const { error } = await admin.from('app_settings').upsert(
      {
        key: 'google_apps_script_url',
        value: cleanUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.testPing) {
    const cfg = await getBridgeConfig();
    if (!cfg.appsScriptUrl) {
      return NextResponse.json(
        { ok: false, message: 'Save your deployed Google Apps Script Web App URL first.' },
        { status: 400 }
      );
    }
    try {
      const r = await fetch(cfg.appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          secret: cfg.bridgeSecret,
          spreadsheetId: cfg.spreadsheetId,
        }),
      });
      const json = await r.json().catch(() => ({}));
      return NextResponse.json({
        ok: Boolean(json?.ok),
        message: json?.message || `HTTP ${r.status}`,
      });
    } catch (e) {
      return NextResponse.json(
        { ok: false, message: e instanceof Error ? e.message : 'Ping failed' },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
