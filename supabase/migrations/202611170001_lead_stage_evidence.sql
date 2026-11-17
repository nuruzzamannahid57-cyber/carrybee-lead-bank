create table if not exists public.lead_stage_evidence (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  owner_id uuid not null references public.team_members(id) on delete cascade,
  stage text not null check (stage in ('connected', 'followup')),
  file_path text not null unique,
  original_name text not null,
  mime_type text not null,
  original_size_bytes bigint not null check (original_size_bytes > 0),
  stored_size_bytes bigint not null check (stored_size_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists lead_stage_evidence_owner_lead_created_idx
  on public.lead_stage_evidence (owner_id, lead_id, created_at desc);

alter table public.lead_stage_evidence enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_stage_evidence' and policyname='Members can read own lead evidence') then
    create policy "Members can read own lead evidence" on public.lead_stage_evidence
      for select to authenticated using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_stage_evidence' and policyname='Members can add own lead evidence') then
    create policy "Members can add own lead evidence" on public.lead_stage_evidence
      for insert to authenticated with check (
        owner_id = auth.uid()
        and exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_stage_evidence' and policyname='Members can delete own lead evidence') then
    create policy "Members can delete own lead evidence" on public.lead_stage_evidence
      for delete to authenticated using (owner_id = auth.uid());
  end if;
end $$;

grant select, insert, delete on public.lead_stage_evidence to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-evidence',
  'lead-evidence',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/x-m4a','audio/webm','audio/ogg']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Members can read own lead evidence files') then
    create policy "Members can read own lead evidence files" on storage.objects
      for select to authenticated using (
        bucket_id = 'lead-evidence' and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Members can upload own lead evidence files') then
    create policy "Members can upload own lead evidence files" on storage.objects
      for insert to authenticated with check (
        bucket_id = 'lead-evidence' and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Members can delete own lead evidence files') then
    create policy "Members can delete own lead evidence files" on storage.objects
      for delete to authenticated using (
        bucket_id = 'lead-evidence' and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
