export type UserRole = 'super_admin' | 'team_leader' | 'team_member';

export type LeadStage = 'new' | 'connected' | 'followup' | 'onboarded';

export interface TeamMemberProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  sheet_tab_name: string;
  extension_token?: string;
  is_active: boolean;
  created_at: string;
}

export interface Lead {
  id: string;
  owner_id: string;
  business_name: string;
  fb_link: string;
  contact_person: string;
  contact_number: string;
  normalized_phone: string;
  product_category: string;
  pickup_area: string;
  stage: LeadStage;
  needs_followup: boolean;
  last_contacted_at: string | null;
  followup_due_at: string | null;
  onboarded_at: string | null;
  carrybee_merchant_name: string;
  carrybee_merchant_id: string;
  notes: string;
  sheet_row_number: number | null;
  created_at: string;
  updated_at: string;
}

export interface TeamProgressionRow {
  member_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  sheet_tab_name: string;
  total_leads: number;
  new_leads: number;
  connected_leads: number;
  followup_due_leads: number;
  onboarded_leads: number;
  added_today: number;
  added_this_month: number;
}

export interface MerchantOrder {
  id: string;
  owner_id: string;
  lead_id: string | null;
  merchant_name: string;
  merchant_phone: string;
  carrybee_merchant_id: string;
  external_order_id: string;
  order_date: string; // YYYY-MM-DD
  cod_amount: number;
  order_status: string;
  source: string;
  synced_at: string;
}

export interface DailyCodPoint {
  day: number; // 1..31
  dateStr: string;
  orderCount: number;
  eligibleCod: number;
  incentiveAmount: number;
}

export interface MerchantMoneySummary {
  merchantKey: string;
  leadId: string | null;
  merchantName: string;
  merchantPhone: string;
  carrybeeMerchantId: string;
  firstOrderDate: string;
  windowStart: string;
  windowEnd: string;
  windowLabel: string;
  isMidMonthSplit: boolean;
  monthOrderCount: number;
  monthEligibleCod: number;
  monthIncentive: number;
  lifetimeOrdersInWindow: number;
  lifetimeEligibleCod: number;
}
