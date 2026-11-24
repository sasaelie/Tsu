create table public.tsu_watch_publications (
  week date primary key check (extract(isodow from week) = 1),
  contents jsonb not null,
  published_at timestamptz not null default now()
);

alter table public.tsu_watch_publications enable row level security;
revoke all on public.tsu_watch_publications from public, anon, authenticated;
grant select, insert on public.tsu_watch_publications to service_role;

alter table public.tsu_watch_runs add column decision text;
