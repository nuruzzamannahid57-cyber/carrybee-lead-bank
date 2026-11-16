import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const extToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!extToken) {
    return NextResponse.json(
      { error: 'Missing Extension Sync Token' },
      { status: 401, headers: corsHeaders }
    );
  }

  const admin = getSupabaseAdmin();
  const { data: member } = await admin
    .from('team_members')
    .select('id, full_name, email, role, sheet_tab_name')
    .eq('extension_token', extToken)
    .eq('is_active', true)
    .single();

  if (!member) {
    return NextResponse.json(
      { error: 'Invalid Extension Sync Token' },
      { status: 401, headers: corsHeaders }
    );
  }

  const { data: merchants } = await admin
    .from('leads')
    .select(
      'id, business_name, contact_number, normalized_phone, carrybee_merchant_name, carrybee_merchant_id, onboarded_at'
    )
    .eq('owner_id', member.id)
    .eq('stage', 'onboarded');

  return NextResponse.json(
    {
      member: {
        full_name: member.full_name,
        role: member.role,
        sheet_tab_name: member.sheet_tab_name,
      },
      onboardedMerchants: merchants || [],
    },
    { headers: corsHeaders }
  );
}
