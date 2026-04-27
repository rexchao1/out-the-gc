create extension if not exists "pgcrypto";

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  response text not null,
  created_at timestamp not null default now(),
  constraint rsvps_response_check check (response in ('in', 'out'))
);

create index if not exists rsvps_trip_id_created_at_idx on public.rsvps (trip_id, created_at);

alter table public.rsvps enable row level security;

create policy "Allow public insert rsvps"
on public.rsvps
for insert
to anon
with check (true);

create policy "Allow public select rsvps"
on public.rsvps
for select
to anon
using (true);
