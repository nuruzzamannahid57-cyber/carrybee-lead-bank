alter table public.lead_stage_evidence
  drop constraint if exists lead_stage_evidence_stage_check;

alter table public.lead_stage_evidence
  add constraint lead_stage_evidence_stage_check
  check (stage in ('connected', 'followup', 'onboarded'));
