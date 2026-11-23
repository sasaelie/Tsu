create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.tsu_watch_drafts (
  week date primary key check (extract(isodow from week) = 1),
  contents jsonb not null,
  collected_at timestamptz not null default now()
);
create table if not exists public.tsu_watch_runs (
  id bigint generated always as identity primary key,
  week date not null,
  checked_at timestamptz not null default now(),
  count integer not null,
  sources jsonb not null
);
alter table public.tsu_watch_drafts enable row level security;
alter table public.tsu_watch_runs enable row level security;
revoke all on public.tsu_watch_drafts, public.tsu_watch_runs from public, anon, authenticated;
grant select, insert, update on public.tsu_watch_drafts to service_role;
grant select, insert on public.tsu_watch_runs to service_role;
grant usage on sequence public.tsu_watch_runs_id_seq to service_role;

create or replace function public.tsu_watch_authorized(candidate text, is_writer boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from vault.decrypted_secrets s
    where s.name = case when is_writer then 'tsu_watch_runner' else 'tsu_watch_reader' end
      and extensions.digest(s.decrypted_secret, 'sha256') = extensions.digest(candidate, 'sha256')
  )
$$;
revoke all on function public.tsu_watch_authorized(text, boolean) from public, anon, authenticated;
grant execute on function public.tsu_watch_authorized(text, boolean) to service_role;
