-- DFM Concrete & Asphalt — Expense Tracker
-- Run this entire file once in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run: uses "if not exists" / "or replace" / "drop ... if exists" throughout.

create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES  (one row per auth.users row; role separates admin/employee)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'employee' check (role in ('employee', 'admin')),
  created_at timestamptz not null default now()
);

-- Security-definer helper so RLS policies can check "is this caller an admin?"
-- without recursively re-triggering RLS on profiles.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
-- full_name is pulled from the signup form's metadata; defaults to email if missing.
-- Every new user starts as 'employee' — promote yourself to 'admin' manually (see README).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'employee'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- VENDORS  (admin-curated list, used as suggestions on the expense form and
-- as the grouping key for "spend by vendor" in Reports)
-- ============================================================
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists vendors_name_idx on public.vendors (name);

-- ============================================================
-- JOBS  (admin-curated list, same pattern as vendors — suggestions on the
-- expense form's job/project field and the grouping key for "spend by
-- job" in Reports. expenses.job_name stays free text, not a foreign key,
-- so an employee can always type a job that isn't on the list yet.)
-- ============================================================
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists jobs_name_idx on public.jobs (name);

-- Case-insensitive uniqueness for both curated lists — otherwise "ABC
-- Supply" and "abc supply" could both get added and would split that
-- vendor's/job's spend across two rows in reports. Named as expression
-- indexes (not a plain UNIQUE column constraint) so casing differences are
-- caught, not just exact duplicates. Drops any older plain-unique
-- constraint from a prior version of this file first.
alter table public.vendors drop constraint if exists vendors_name_key;
create unique index if not exists vendors_name_lower_idx on public.vendors (lower(name));
alter table public.jobs drop constraint if exists jobs_name_key;
create unique index if not exists jobs_name_lower_idx on public.jobs (lower(name));

-- ============================================================
-- EXPENSES
-- ============================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  employee_name text not null,
  expense_date date not null,
  amount numeric(10, 2),
  job_name text not null,
  category text not null,
  notes text,
  receipt_path text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columns added after the initial release. These are no-ops on a fresh
-- install (the create table above already has them by the time this file
-- finishes running once) and are what actually updates a database that
-- already ran an earlier version of this file — that's why this whole file
-- stays safe to re-run any time it changes.
alter table public.expenses add column if not exists material_type text;
alter table public.expenses add column if not exists quantity numeric(10, 2);
alter table public.expenses add column if not exists quantity_unit text;
alter table public.expenses add column if not exists mix_design text;
-- Free text, not a foreign key to vendors — admins curate the vendors table
-- as suggestions for consistent reporting, but an employee can still type a
-- one-off vendor name that isn't on the list without being blocked.
alter table public.expenses add column if not exists vendor text;

-- Lightweight audit trail: who moved this entry to approved/flagged, and
-- when. Denormalized (a name, not a foreign key) same as employee_name, so
-- displaying it never needs a join. Cleared back to null when an entry is
-- reset to 'pending' (see updateExpenseStatus in src/lib/actions/expenses.ts).
alter table public.expenses add column if not exists reviewed_by_name text;
alter table public.expenses add column if not exists reviewed_at timestamptz;

-- Amount is nullable: a material order can be logged (with quantity/mix
-- design) before the price is known, then confirmed later once the invoice
-- or delivery ticket comes in. See the "expenses_approved_needs_amount"
-- constraint below for the safety net this implies.
alter table public.expenses alter column amount drop not null;

-- Named, re-creatable constraints (so this file stays re-runnable even when
-- a constraint's definition changes between versions).
alter table public.expenses drop constraint if exists expenses_amount_check;
alter table public.expenses add constraint expenses_amount_check
  check (amount is null or amount > 0);

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check check (
  category in ('General purchase', 'Material', 'Supplies', 'Fuel', 'Other')
);

-- material_type only applies when category = 'Material'; the app enforces
-- that pairing, this just constrains the value itself.
alter table public.expenses drop constraint if exists expenses_material_type_check;
alter table public.expenses add constraint expenses_material_type_check check (
  material_type is null or material_type in ('Concrete', 'Asphalt', 'Base Course', 'Other')
);

alter table public.expenses drop constraint if exists expenses_status_check;
alter table public.expenses add constraint expenses_status_check check (
  status in ('pending', 'approved', 'flagged')
);

-- Belt-and-suspenders: the app's UI already disables the Approve button
-- until an amount is entered, but this closes the gap at the database level
-- too, so an "awaiting price" order can never end up approved/exported with
-- no dollar value.
alter table public.expenses drop constraint if exists expenses_approved_needs_amount_check;
alter table public.expenses add constraint expenses_approved_needs_amount_check check (
  status <> 'approved' or amount is not null
);

create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_date_idx on public.expenses (expense_date);
create index if not exists expenses_job_idx on public.expenses (job_name);
create index if not exists expenses_status_idx on public.expenses (status);
create index if not exists expenses_category_idx on public.expenses (category);
create index if not exists expenses_vendor_idx on public.expenses (vendor);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.vendors enable row level security;
alter table public.jobs enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

drop policy if exists "expenses_select_own_or_admin" on public.expenses;
create policy "expenses_select_own_or_admin" on public.expenses
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own" on public.expenses
  for insert with check (user_id = auth.uid());

-- Employees may edit/delete their own entries only while still 'pending'
-- (once approved/flagged, only an admin can change it — keeps a clean audit trail).
drop policy if exists "expenses_update_own_pending_or_admin" on public.expenses;
create policy "expenses_update_own_pending_or_admin" on public.expenses
  for update using (
    (user_id = auth.uid() and status = 'pending') or public.is_admin()
  );

drop policy if exists "expenses_delete_own_pending_or_admin" on public.expenses;
create policy "expenses_delete_own_pending_or_admin" on public.expenses
  for delete using (
    (user_id = auth.uid() and status = 'pending') or public.is_admin()
  );

-- Anyone signed in can read the vendor list (it's just suggestions shown on
-- the expense form); only admins can add or remove entries.
drop policy if exists "vendors_select_authenticated" on public.vendors;
create policy "vendors_select_authenticated" on public.vendors
  for select using (auth.uid() is not null);

drop policy if exists "vendors_insert_admin" on public.vendors;
create policy "vendors_insert_admin" on public.vendors
  for insert with check (public.is_admin());

drop policy if exists "vendors_delete_admin" on public.vendors;
create policy "vendors_delete_admin" on public.vendors
  for delete using (public.is_admin());

-- Same read-for-everyone / write-for-admins pattern as vendors.
drop policy if exists "jobs_select_authenticated" on public.jobs;
create policy "jobs_select_authenticated" on public.jobs
  for select using (auth.uid() is not null);

drop policy if exists "jobs_insert_admin" on public.jobs;
create policy "jobs_insert_admin" on public.jobs
  for insert with check (public.is_admin());

drop policy if exists "jobs_delete_admin" on public.jobs;
create policy "jobs_delete_admin" on public.jobs
  for delete using (public.is_admin());

-- ============================================================
-- STORAGE — private "receipts" bucket, one folder per user (folder name = user id)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts_insert_own_folder" on storage.objects;
create policy "receipts_insert_own_folder" on storage.objects
  for insert with check (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_select_own_or_admin" on storage.objects;
create policy "receipts_select_own_or_admin" on storage.objects
  for select using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "receipts_delete_own_or_admin" on storage.objects;
create policy "receipts_delete_own_or_admin" on storage.objects
  for delete using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
