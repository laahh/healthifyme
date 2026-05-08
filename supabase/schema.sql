-- Run this SQL in Supabase SQL Editor.
-- Best practice: keep RLS ON and scope by auth.uid().

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  address jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_profiles (
  id bigint primary key,
  nik text,
  foto text,
  nama text,
  site text,
  usia integer,
  divisi text,
  mainkon text,
  dedikasi text,
  dept_dic bigint,
  kategori text,
  kode_sid text unique not null,
  masa_kerja integer,
  departement text,
  work_permit text,
  dept_mainkon text,
  id_perusahaan bigint,
  level_jabatan text,
  status_permit text,
  dic_perusahaan bigint,
  id_work_permit bigint,
  nama_perusahaan text,
  status_karyawan text,
  kategori_karyawan text,
  jabatan_fungsional text,
  jabatan_struktural text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.user_profiles enable row level security;
alter table public.user_history enable row level security;
alter table public.employee_profiles enable row level security;

drop policy if exists "user profiles select own" on public.user_profiles;
create policy "user profiles select own"
on public.user_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "user profiles upsert own" on public.user_profiles;
create policy "user profiles upsert own"
on public.user_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "employee profiles select own sid" on public.employee_profiles;
create policy "employee profiles select own sid"
on public.employee_profiles
for select
using (lower(split_part(auth.email(), '@', 1)) = lower(kode_sid));

drop policy if exists "employee profiles update own sid" on public.employee_profiles;
create policy "employee profiles update own sid"
on public.employee_profiles
for update
using (lower(split_part(auth.email(), '@', 1)) = lower(kode_sid))
with check (lower(split_part(auth.email(), '@', 1)) = lower(kode_sid));

drop policy if exists "user history select own" on public.user_history;
create policy "user history select own"
on public.user_history
for select
using (auth.uid() = user_id);

drop policy if exists "user history mutate own" on public.user_history;
create policy "user history mutate own"
on public.user_history
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
