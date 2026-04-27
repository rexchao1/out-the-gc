create extension if not exists "pgcrypto";

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  trip_name text not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  cost_per_person numeric not null,
  rsvp_deadline timestamp not null,
  organizer_name text not null,
  created_at timestamp not null default now()
);

alter table public.trips enable row level security;

create policy "Allow public insert trips"
on public.trips
for insert
to anon
with check (true);

create policy "Allow public select trips"
on public.trips
for select
to anon
using (true);
