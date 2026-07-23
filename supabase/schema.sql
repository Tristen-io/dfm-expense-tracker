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
  role text not null default 'employee' check (role in ('employee', 'admin', 'mechanic')),
  created_at timestamptz not null default now()
);

-- Re-stated as an explicit named constraint so this widens on a database
-- that already has the table (the inline check above only applies on a
-- genuinely fresh install — "create table if not exists" is a no-op
-- otherwise). "mechanic" is a new role: full parity with admin within
-- Fleet & Equipment, no access outside it — see is_fleet_staff() below and
-- the Fleet & Equipment RLS section for what that means in practice.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in ('employee', 'admin', 'mechanic')
);

-- Basic contact info + a copy of the auth email, so the app can show/edit
-- these without ever needing to query the protected auth.users table
-- directly (that schema isn't reachable through the anon-key REST API).
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists address text;

-- Backfills email for any profile created before this column existed.
-- Harmless no-op on every re-run after the first (only fills nulls).
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

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

-- Mechanic is scoped to Fleet & Equipment only — never used as a stand-in
-- for is_admin() outside that section (HR/expense/employee-management
-- policies below stay on is_admin()).
create or replace function public.is_mechanic()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'mechanic'
  );
$$;

-- "Can fully manage Fleet & Equipment" — admin or mechanic. Used throughout
-- the Fleet & Equipment section below in place of is_admin(), so a mechanic
-- gets the exact same fleet capabilities an admin has, and nothing more
-- (this function is never referenced outside that section).
create or replace function public.is_fleet_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'mechanic')
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
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'employee',
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Defense-in-depth: profiles_update_own (below) lets a signed-in user update
-- their own profile row (needed so employees can edit their own phone/
-- address), but a bare row-level policy can't restrict which *columns*
-- change — without this trigger, a crafted request could flip someone's own
-- role to 'admin'. Any non-admin attempt to change role is silently
-- reverted rather than erroring, so it never breaks a legitimate
-- phone/address update that happens to include the unchanged role value.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

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
-- TIME OFF REQUESTS
-- ============================================================
create table if not exists public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  employee_name text not null,
  type text not null,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending',
  -- True when the request was submitted with less than the minimum notice
  -- window (see MIN_NOTICE_DAYS in src/lib/actions/timeOff.ts). Computed
  -- once at submission time and stored, not recalculated later — the
  -- "was this short notice" fact shouldn't silently change after the fact
  -- just because time passed.
  short_notice boolean not null default false,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.time_off_requests drop constraint if exists time_off_requests_type_check;
alter table public.time_off_requests add constraint time_off_requests_type_check check (
  type in ('Vacation', 'Sick', 'Personal', 'Unpaid', 'Other')
);

alter table public.time_off_requests drop constraint if exists time_off_requests_status_check;
alter table public.time_off_requests add constraint time_off_requests_status_check check (
  status in ('pending', 'approved', 'denied')
);

alter table public.time_off_requests drop constraint if exists time_off_requests_dates_check;
alter table public.time_off_requests add constraint time_off_requests_dates_check check (
  end_date >= start_date
);

create index if not exists time_off_requests_user_id_idx on public.time_off_requests (user_id);
create index if not exists time_off_requests_status_idx on public.time_off_requests (status);
create index if not exists time_off_requests_start_date_idx on public.time_off_requests (start_date);

drop trigger if exists time_off_requests_set_updated_at on public.time_off_requests;
create trigger time_off_requests_set_updated_at
  before update on public.time_off_requests
  for each row execute function public.set_updated_at();

-- ============================================================
-- WRITE-UPS  (disciplinary documentation — admin-authored, visible to and
-- acknowledgeable by the employee it's about)
-- ============================================================
create table if not exists public.write_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  employee_name text not null,
  created_by_name text not null,
  incident_date date not null,
  category text not null,
  description text not null,
  corrective_action text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.write_ups drop constraint if exists write_ups_category_check;
alter table public.write_ups add constraint write_ups_category_check check (
  category in ('Attendance', 'Safety', 'Performance', 'Conduct', 'Other')
);

create index if not exists write_ups_user_id_idx on public.write_ups (user_id);

-- Lets an employee acknowledge a write-up about themselves (sets
-- acknowledged_at) without granting a general UPDATE policy that would let
-- them edit the description/category/etc of their own record. security
-- definer + the explicit user_id/acknowledged_at-is-null checks inside the
-- function body are what make this safe to expose — same pattern as
-- is_admin() above.
create or replace function public.acknowledge_write_up(write_up_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.write_ups
  set acknowledged_at = now()
  where id = write_up_id and user_id = auth.uid() and acknowledged_at is null;
end;
$$;

grant execute on function public.acknowledge_write_up(uuid) to authenticated;

-- ============================================================
-- FLEET & EQUIPMENT — Phase 1 (asset registry, meter readings, service
-- tickets, notifications). Deliberately scoped down from the full
-- CMMS ask (no PM schedules/health-color engine/inspections yet — those
-- are phases 2/3) so this lands as something reviewable and testable on
-- its own.
--
-- ACCESS MODEL (see RLS section below for the actual policies): admins and
-- mechanics ("fleet staff", is_fleet_staff()) have full read/write access
-- to everything in this section — asset registry, meter readings, service
-- tickets, comments/history, maintenance types/schedules/records, and the
-- asset-photos bucket. Employees get a deliberately narrow slice: they can
-- read the asset list and maintenance schedules (needed to report a ticket
-- against an asset and to see what maintenance is due), file a service
-- ticket and see their own reported tickets, but cannot read or write
-- meter readings, maintenance types/records, ticket comments/history, or
-- asset photos, and cannot write to the asset registry or maintenance
-- schedules at all.
-- ============================================================

-- ASSET CATEGORIES — admin-curated suggestions, same free-text-with-
-- curated-list pattern as vendors/jobs (assets.category stays free text,
-- not a foreign key, so an asset can be added before its category is).
create table if not exists public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists asset_categories_name_lower_idx
  on public.asset_categories (lower(name));

-- ASSETS
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_number text not null,
  name text not null,
  category text,
  make text,
  model text,
  year int,
  vin_or_serial text,
  status text not null default 'active',
  -- What kind of meter this asset tracks, if any — drives which unit
  -- meter_readings.reading_type is expected to use and whether the "add a
  -- reading" UI even shows up on the asset's profile page.
  meter_type text not null default 'mileage',
  -- Denormalized latest reading, kept in sync by apply_meter_reading()
  -- below whenever a new meter_readings row lands — same "store the
  -- current value, don't recompute it from history on every read" choice
  -- as expenses.reviewed_by_name. meter_readings is still the source of
  -- truth/audit trail.
  current_meter_value numeric(12, 1),
  assigned_to_id uuid references public.profiles(id) on delete set null,
  assigned_to_name text,
  location text,
  purchase_date date,
  notes text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assets drop constraint if exists assets_status_check;
alter table public.assets add constraint assets_status_check check (
  status in ('active', 'out_of_service', 'retired')
);

alter table public.assets drop constraint if exists assets_meter_type_check;
alter table public.assets add constraint assets_meter_type_check check (
  meter_type in ('mileage', 'hours', 'none')
);

alter table public.assets drop constraint if exists assets_year_check;
alter table public.assets add constraint assets_year_check check (
  year is null or (year between 1900 and 2100)
);

create unique index if not exists assets_asset_number_lower_idx
  on public.assets (lower(asset_number));
create index if not exists assets_status_idx on public.assets (status);
create index if not exists assets_category_idx on public.assets (category);

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

-- METER READINGS — mileage/engine-hour history per asset. A backwards
-- reading (odometer rolled back, hour meter replaced, fat-fingered entry)
-- is rejected unless is_override is set, which itself is only allowed for
-- an admin and requires a reason — see enforce_meter_reading_order() below.
create table if not exists public.meter_readings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  reading_type text not null,
  value numeric(12, 1) not null,
  recorded_by_id uuid references public.profiles(id) on delete set null,
  recorded_by_name text not null,
  is_override boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now()
);

alter table public.meter_readings drop constraint if exists meter_readings_reading_type_check;
alter table public.meter_readings add constraint meter_readings_reading_type_check check (
  reading_type in ('mileage', 'hours')
);

alter table public.meter_readings drop constraint if exists meter_readings_value_check;
alter table public.meter_readings add constraint meter_readings_value_check check (value >= 0);

create index if not exists meter_readings_asset_id_idx on public.meter_readings (asset_id);
create index if not exists meter_readings_created_at_idx on public.meter_readings (created_at);

-- Rejects a reading lower than the latest one on file for the same
-- asset+reading_type unless the caller is an admin, is_override is set,
-- and a reason was given. security definer so it can read across all of
-- meter_readings regardless of the caller's own RLS visibility.
create or replace function public.enforce_meter_reading_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  latest numeric;
begin
  select value into latest from public.meter_readings
    where asset_id = new.asset_id and reading_type = new.reading_type
    order by created_at desc, id desc
    limit 1;

  if latest is not null and new.value < latest then
    if not new.is_override then
      raise exception
        'New reading (%) is less than the latest recorded reading (%). An admin can override this with a reason.',
        new.value, latest;
    end if;
    if not public.is_fleet_staff() then
      raise exception 'Only an admin or mechanic can override a backwards meter reading.';
    end if;
    if new.override_reason is null or btrim(new.override_reason) = '' then
      raise exception 'An override reason is required when correcting a backwards reading.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists meter_readings_enforce_order on public.meter_readings;
create trigger meter_readings_enforce_order
  before insert on public.meter_readings
  for each row execute function public.enforce_meter_reading_order();

-- Keeps assets.current_meter_value in sync. Only applies when the reading's
-- type matches the asset's configured meter_type, so a stray reading of the
-- wrong type (shouldn't happen via the UI, but the table itself doesn't
-- forbid it) never overwrites the displayed current value with a mismatched
-- unit.
create or replace function public.apply_meter_reading()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.assets
  set current_meter_value = new.value, updated_at = now()
  where id = new.asset_id and meter_type = new.reading_type;
  return new;
end;
$$;

drop trigger if exists meter_readings_apply on public.meter_readings;
create trigger meter_readings_apply
  after insert on public.meter_readings
  for each row execute function public.apply_meter_reading();

-- SERVICE TICKETS
create table if not exists public.service_tickets (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  -- Denormalized snapshot of the asset's number/name at ticket-creation
  -- time, same "copy the display fields, don't join" convention as
  -- employee_name elsewhere in this file — lets ticket lists render
  -- without joining assets, and keeps showing something sensible even if
  -- the asset is later renamed.
  asset_number text not null,
  asset_name text not null,
  title text not null,
  description text not null,
  priority text not null default 'medium',
  status text not null default 'open',
  reported_by_id uuid references public.profiles(id) on delete set null,
  reported_by_name text not null,
  assigned_to_id uuid references public.profiles(id) on delete set null,
  assigned_to_name text,
  -- "Someone has seen this" tracking, mainly for 911-priority tickets —
  -- set via the acknowledge_ticket() security-definer function below (any
  -- signed-in user, not just admins/the assignee, since the point of a 911
  -- ticket is that whoever notices it first can flag "I've seen this").
  acknowledged_by_name text,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_tickets drop constraint if exists service_tickets_priority_check;
alter table public.service_tickets add constraint service_tickets_priority_check check (
  priority in ('low', 'medium', 'high', '911')
);

alter table public.service_tickets drop constraint if exists service_tickets_status_check;
alter table public.service_tickets add constraint service_tickets_status_check check (
  status in ('open', 'in_progress', 'on_hold', 'completed', 'cancelled')
);

create index if not exists service_tickets_asset_id_idx on public.service_tickets (asset_id);
create index if not exists service_tickets_status_idx on public.service_tickets (status);
create index if not exists service_tickets_priority_idx on public.service_tickets (priority);

drop trigger if exists service_tickets_set_updated_at on public.service_tickets;
create trigger service_tickets_set_updated_at
  before update on public.service_tickets
  for each row execute function public.set_updated_at();

-- Stamps completed_at when a ticket moves into/out of "completed", so the
-- timestamp doesn't need separate app-layer bookkeeping.
create or replace function public.stamp_ticket_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := now();
  elsif new.status <> 'completed' and old.status = 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists service_tickets_stamp_completed on public.service_tickets;
create trigger service_tickets_stamp_completed
  before update on public.service_tickets
  for each row execute function public.stamp_ticket_completed_at();

-- TICKET STATUS HISTORY — append-only audit trail, populated entirely by
-- the trigger below (no app-layer insert policy needed, same "owner-only
-- writes via a security-definer trigger" shape as how handle_new_user
-- populates profiles).
create table if not exists public.ticket_status_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.service_tickets(id) on delete cascade,
  status text not null,
  changed_by_name text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists ticket_status_history_ticket_id_idx
  on public.ticket_status_history (ticket_id);

create or replace function public.log_ticket_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_status_history (ticket_id, status, changed_by_name, note)
    values (new.id, new.status, new.reported_by_name, 'Ticket created');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.ticket_status_history (ticket_id, status, changed_by_name)
    values (
      new.id,
      new.status,
      coalesce((select full_name from public.profiles where id = auth.uid()), 'Unknown')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists service_tickets_log_status on public.service_tickets;
create trigger service_tickets_log_status
  after insert or update on public.service_tickets
  for each row execute function public.log_ticket_status();

-- TICKET COMMENTS
create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.service_tickets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists ticket_comments_ticket_id_idx on public.ticket_comments (ticket_id);

-- Lets any signed-in user acknowledge a ticket (not just an admin or the
-- assignee — the point of 911-priority acknowledgment is "whoever sees
-- this first flags that they've seen it"), without a generic UPDATE policy
-- that would let any employee edit a ticket's title/description/priority.
-- Same shape as acknowledge_write_up() above; only ever sets these two
-- columns, and only once (no-ops if already acknowledged).
create or replace function public.acknowledge_ticket(ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.service_tickets
  set acknowledged_by_name = coalesce((select full_name from public.profiles where id = auth.uid()), 'Unknown'),
      acknowledged_at = now()
  where id = ticket_id and acknowledged_at is null;
end;
$$;

grant execute on function public.acknowledge_ticket(uuid) to authenticated;

-- NOTIFICATIONS — in-app only for now. Shaped so an email/SMS channel can
-- be layered on later (e.g. a delivered_at/channel column) without a
-- rework: every notification is already a self-contained row with a type,
-- title, body, and link, not something computed on the fly.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in ('ticket_created', 'ticket_911', 'ticket_status_changed', 'meter_override')
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_unread_idx on public.notifications (user_id, read_at);

-- Fans a new ticket out to every admin and mechanic (fleet staff — they're
-- the ones who'll actually work the ticket). Runs as security definer so it
-- can insert on behalf of every fleet-staff profile regardless of who filed
-- the ticket.
create or replace function public.notify_new_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link_path)
  select
    p.id,
    case when new.priority = '911' then 'ticket_911' else 'ticket_created' end,
    case
      when new.priority = '911' then '911 priority ticket: ' || new.title
      else 'New service ticket: ' || new.title
    end,
    new.reported_by_name || ' reported an issue.',
    '/fleet/tickets/' || new.id
  from public.profiles p
  where p.role in ('admin', 'mechanic');
  return new;
end;
$$;

drop trigger if exists service_tickets_notify_new on public.service_tickets;
create trigger service_tickets_notify_new
  after insert on public.service_tickets
  for each row execute function public.notify_new_ticket();

-- Notifies whoever reported the ticket when its status changes (unless
-- they're the one who changed it).
create or replace function public.notify_ticket_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.reported_by_id is not null
     and new.reported_by_id <> auth.uid() then
    insert into public.notifications (user_id, type, title, body, link_path)
    values (
      new.reported_by_id,
      'ticket_status_changed',
      'Ticket updated: ' || new.title,
      'Status changed to ' || replace(new.status, '_', ' ') || '.',
      '/fleet/tickets/' || new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists service_tickets_notify_status on public.service_tickets;
create trigger service_tickets_notify_status
  after update of status on public.service_tickets
  for each row execute function public.notify_ticket_status_change();

-- Marks one notification (or, with null, all of the caller's notifications)
-- read. security definer + the explicit user_id = auth.uid() check is the
-- same "narrow capability, not a generic UPDATE policy" shape used
-- elsewhere in this file, though here a generic own-row UPDATE policy would
-- have been just as safe (the row has no other caller-facing mutable
-- field) — kept as a function anyway for consistency with the rest of this
-- section and so "mark all read" doesn't need N round trips.
create or replace function public.mark_notifications_read(notification_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (notification_id is null or id = notification_id);
end;
$$;

grant execute on function public.mark_notifications_read(uuid) to authenticated;

-- MAINTENANCE TYPES — admin-curated suggestions, same pattern as
-- asset_categories/vendors/jobs. maintenance_schedules.maintenance_type
-- stays free text, not a foreign key.
create table if not exists public.maintenance_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists maintenance_types_name_lower_idx
  on public.maintenance_types (lower(name));

-- Seeds a starter list so the "track a maintenance item" suggestions
-- aren't empty on a fresh install — matches the preset names in
-- src/lib/maintenancePresets.ts (the union across mileage/hours/none
-- meter types) so the checkbox quick-add always has a matching curated
-- entry. Only fires when the table is completely empty: an "on conflict do
-- nothing" per-row insert would re-add a type an admin deliberately
-- deleted the next time this file changes and gets re-run (a delete
-- leaves nothing to conflict with), which defeats the point of an
-- admin-curated list. Gating on "table is empty" means this seed can only
-- ever run once, on a genuinely fresh install.
insert into public.maintenance_types (name)
select v.name from (values
  ('Oil change'),
  ('Tire rotation'),
  ('Tire inspection'),
  ('Brake inspection'),
  ('Brake/track inspection'),
  ('Air filter'),
  ('Transmission fluid'),
  ('Coolant flush'),
  ('Coolant check'),
  ('Hydraulic fluid'),
  ('Grease fittings'),
  ('Battery check'),
  ('Wiper blades'),
  ('Lights & wiring check'),
  ('Registration / inspection renewal')
) as v(name)
where not exists (select 1 from public.maintenance_types);

-- MAINTENANCE SCHEDULES — one row per (asset, maintenance type) the crew
-- wants tracked, e.g. "Truck 1 — Oil change every 5,000 mi or 6 months,
-- whichever comes first." last_performed_date/meter are denormalized from
-- the most recent maintenance_records row (kept in sync by
-- apply_maintenance_record() below), same "store the current value, don't
-- recompute on every read" choice as assets.current_meter_value — this is
-- what lets the assets list page compute every row's status in one query
-- instead of one aggregate per asset.
create table if not exists public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  maintenance_type text not null,
  -- At least one of these two must be set — see
  -- maintenance_schedules_interval_check below. Both can be set at once
  -- ("whichever comes first").
  interval_days int,
  interval_meter numeric(12, 1),
  last_performed_date date,
  last_performed_meter numeric(12, 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maintenance_schedules drop constraint if exists maintenance_schedules_interval_check;
alter table public.maintenance_schedules add constraint maintenance_schedules_interval_check check (
  interval_days is not null or interval_meter is not null
);

alter table public.maintenance_schedules drop constraint if exists maintenance_schedules_interval_days_check;
alter table public.maintenance_schedules add constraint maintenance_schedules_interval_days_check check (
  interval_days is null or interval_days > 0
);

alter table public.maintenance_schedules drop constraint if exists maintenance_schedules_interval_meter_check;
alter table public.maintenance_schedules add constraint maintenance_schedules_interval_meter_check check (
  interval_meter is null or interval_meter > 0
);

create unique index if not exists maintenance_schedules_asset_type_lower_idx
  on public.maintenance_schedules (asset_id, lower(maintenance_type));
create index if not exists maintenance_schedules_asset_id_idx
  on public.maintenance_schedules (asset_id);

drop trigger if exists maintenance_schedules_set_updated_at on public.maintenance_schedules;
create trigger maintenance_schedules_set_updated_at
  before update on public.maintenance_schedules
  for each row execute function public.set_updated_at();

-- MAINTENANCE RECORDS — log of completed service against a schedule. A
-- schedule must exist first (set up by an admin with its interval); any
-- signed-in user can then log that the work was done, same "anyone can
-- log a meter reading, only an admin configures the asset" split as
-- meter_readings.
create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.maintenance_schedules(id) on delete cascade,
  performed_date date not null,
  performed_meter numeric(12, 1),
  performed_by_id uuid references public.profiles(id) on delete set null,
  performed_by_name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists maintenance_records_schedule_id_idx
  on public.maintenance_records (schedule_id);

-- Keeps maintenance_schedules.last_performed_date/meter in sync. Only
-- moves forward — a record logged out of order (backfilling an older
-- service) doesn't clobber a more recent one already on file.
create or replace function public.apply_maintenance_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.maintenance_schedules
  set
    last_performed_date = new.performed_date,
    last_performed_meter = new.performed_meter,
    updated_at = now()
  where id = new.schedule_id
    and (last_performed_date is null or new.performed_date >= last_performed_date);
  return new;
end;
$$;

drop trigger if exists maintenance_records_apply on public.maintenance_records;
create trigger maintenance_records_apply
  after insert on public.maintenance_records
  for each row execute function public.apply_maintenance_record();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.vendors enable row level security;
alter table public.jobs enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.write_ups enable row level security;
alter table public.asset_categories enable row level security;
alter table public.assets enable row level security;
alter table public.meter_readings enable row level security;
alter table public.service_tickets enable row level security;
alter table public.ticket_status_history enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.maintenance_types enable row level security;
alter table public.maintenance_schedules enable row level security;
alter table public.maintenance_records enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- Admins can also update any profile now (contact-info corrections, and
-- promoting/demoting role from /admin/employees instead of the Supabase
-- dashboard) — role changes are still guarded by the trigger above for
-- non-admin callers.
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

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

-- Same visibility shape as expenses: an employee sees/manages their own
-- requests, an admin sees and reviews everyone's.
drop policy if exists "time_off_select_own_or_admin" on public.time_off_requests;
create policy "time_off_select_own_or_admin" on public.time_off_requests
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "time_off_insert_own" on public.time_off_requests;
create policy "time_off_insert_own" on public.time_off_requests
  for insert with check (user_id = auth.uid());

drop policy if exists "time_off_update_own_pending_or_admin" on public.time_off_requests;
create policy "time_off_update_own_pending_or_admin" on public.time_off_requests
  for update using (
    (user_id = auth.uid() and status = 'pending') or public.is_admin()
  );

drop policy if exists "time_off_delete_own_pending_or_admin" on public.time_off_requests;
create policy "time_off_delete_own_pending_or_admin" on public.time_off_requests
  for delete using (
    (user_id = auth.uid() and status = 'pending') or public.is_admin()
  );

-- Write-ups: only an admin authors/removes one; the employee it's about can
-- read their own (acknowledging happens through the security-definer
-- function above, not a generic UPDATE policy).
drop policy if exists "write_ups_select_own_or_admin" on public.write_ups;
create policy "write_ups_select_own_or_admin" on public.write_ups
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "write_ups_insert_admin" on public.write_ups;
create policy "write_ups_insert_admin" on public.write_ups
  for insert with check (public.is_admin());

drop policy if exists "write_ups_delete_admin" on public.write_ups;
create policy "write_ups_delete_admin" on public.write_ups
  for delete using (public.is_admin());

-- Fleet & equipment access model (see the section comment above): fleet
-- staff (admin or mechanic, is_fleet_staff()) get full read/write access to
-- everything below. Employees get a narrow read-only slice — the asset
-- list and maintenance schedules (so they can pick an asset when reporting
-- a ticket, and see what maintenance is due), plus their own reported
-- tickets — and can only ever write a service ticket for themselves.
-- asset_categories, meter_readings, ticket history/comments, maintenance
-- types/records, and asset-photos are fleet-staff only, full stop —
-- employees have no UI that touches them and no RLS grant either.
drop policy if exists "asset_categories_select_authenticated" on public.asset_categories;
drop policy if exists "asset_categories_select_fleet_staff" on public.asset_categories;
create policy "asset_categories_select_fleet_staff" on public.asset_categories
  for select using (public.is_fleet_staff());

drop policy if exists "asset_categories_insert_admin" on public.asset_categories;
create policy "asset_categories_insert_admin" on public.asset_categories
  for insert with check (public.is_fleet_staff());

drop policy if exists "asset_categories_delete_admin" on public.asset_categories;
create policy "asset_categories_delete_admin" on public.asset_categories
  for delete using (public.is_fleet_staff());

-- Assets stay readable by every signed-in user, unlike the rest of this
-- section — the /report-issue asset picker and the employee-facing
-- /maintenance-due list both need it. Writes are fleet-staff only.
drop policy if exists "assets_select_authenticated" on public.assets;
create policy "assets_select_authenticated" on public.assets
  for select using (auth.uid() is not null);

drop policy if exists "assets_insert_admin" on public.assets;
create policy "assets_insert_admin" on public.assets
  for insert with check (public.is_fleet_staff());

drop policy if exists "assets_update_admin" on public.assets;
create policy "assets_update_admin" on public.assets
  for update using (public.is_fleet_staff());

drop policy if exists "assets_delete_admin" on public.assets;
create policy "assets_delete_admin" on public.assets
  for delete using (public.is_fleet_staff());

-- Meter readings are fleet-staff only now (previously any signed-in user
-- could log one) — logging equipment meters is "fleet info" in the sense
-- the employee-restriction request meant, so this moved alongside asset
-- writes. with check still pins recorded_by_id to the caller.
drop policy if exists "meter_readings_select_authenticated" on public.meter_readings;
drop policy if exists "meter_readings_select_fleet_staff" on public.meter_readings;
create policy "meter_readings_select_fleet_staff" on public.meter_readings
  for select using (public.is_fleet_staff());

drop policy if exists "meter_readings_insert_authenticated" on public.meter_readings;
drop policy if exists "meter_readings_insert_fleet_staff" on public.meter_readings;
create policy "meter_readings_insert_fleet_staff" on public.meter_readings
  for insert with check (public.is_fleet_staff() and recorded_by_id = auth.uid());

-- Anyone can report a ticket, and can see their own reported tickets
-- (needed for /my-tickets); full visibility into every ticket is
-- fleet-staff only. The reporter can keep editing their own ticket while
-- still "open" (that's their own submission, not "fleet info"), after
-- which only fleet staff can. Status changes normally go through fleet
-- staff — acknowledgment is the one exception, handled by
-- acknowledge_ticket() above so anyone can flag a 911 ticket as seen.
drop policy if exists "service_tickets_select_authenticated" on public.service_tickets;
drop policy if exists "service_tickets_select_own_or_fleet_staff" on public.service_tickets;
create policy "service_tickets_select_own_or_fleet_staff" on public.service_tickets
  for select using (reported_by_id = auth.uid() or public.is_fleet_staff());

drop policy if exists "service_tickets_insert_own" on public.service_tickets;
create policy "service_tickets_insert_own" on public.service_tickets
  for insert with check (reported_by_id = auth.uid());

drop policy if exists "service_tickets_update_own_open_or_admin" on public.service_tickets;
create policy "service_tickets_update_own_open_or_admin" on public.service_tickets
  for update using (
    (reported_by_id = auth.uid() and status = 'open') or public.is_fleet_staff()
  );

drop policy if exists "service_tickets_delete_own_open_or_admin" on public.service_tickets;
create policy "service_tickets_delete_own_open_or_admin" on public.service_tickets
  for delete using (
    (reported_by_id = auth.uid() and status = 'open') or public.is_fleet_staff()
  );

drop policy if exists "ticket_status_history_select_authenticated" on public.ticket_status_history;
drop policy if exists "ticket_status_history_select_fleet_staff" on public.ticket_status_history;
create policy "ticket_status_history_select_fleet_staff" on public.ticket_status_history
  for select using (public.is_fleet_staff());

drop policy if exists "ticket_comments_select_authenticated" on public.ticket_comments;
drop policy if exists "ticket_comments_select_fleet_staff" on public.ticket_comments;
create policy "ticket_comments_select_fleet_staff" on public.ticket_comments
  for select using (public.is_fleet_staff());

drop policy if exists "ticket_comments_insert_own" on public.ticket_comments;
drop policy if exists "ticket_comments_insert_fleet_staff" on public.ticket_comments;
create policy "ticket_comments_insert_fleet_staff" on public.ticket_comments
  for insert with check (public.is_fleet_staff() and user_id = auth.uid());

drop policy if exists "ticket_comments_delete_own_or_admin" on public.ticket_comments;
create policy "ticket_comments_delete_own_or_admin" on public.ticket_comments
  for delete using (user_id = auth.uid() or public.is_fleet_staff());

drop policy if exists "maintenance_types_select_authenticated" on public.maintenance_types;
drop policy if exists "maintenance_types_select_fleet_staff" on public.maintenance_types;
create policy "maintenance_types_select_fleet_staff" on public.maintenance_types
  for select using (public.is_fleet_staff());

drop policy if exists "maintenance_types_insert_admin" on public.maintenance_types;
create policy "maintenance_types_insert_admin" on public.maintenance_types
  for insert with check (public.is_fleet_staff());

drop policy if exists "maintenance_types_delete_admin" on public.maintenance_types;
create policy "maintenance_types_delete_admin" on public.maintenance_types
  for delete using (public.is_fleet_staff());

-- Configuring a schedule (what's tracked, how often) is fleet-staff only,
-- same as editing the asset itself. Unlike the rest of this section,
-- everyone signed in can read it — it's what drives the employee-facing
-- /maintenance-due list, and the overdue/due-soon coloring on the
-- fleet-staff assets list.
drop policy if exists "maintenance_schedules_select_authenticated" on public.maintenance_schedules;
create policy "maintenance_schedules_select_authenticated" on public.maintenance_schedules
  for select using (auth.uid() is not null);

drop policy if exists "maintenance_schedules_insert_admin" on public.maintenance_schedules;
create policy "maintenance_schedules_insert_admin" on public.maintenance_schedules
  for insert with check (public.is_fleet_staff());

drop policy if exists "maintenance_schedules_update_admin" on public.maintenance_schedules;
create policy "maintenance_schedules_update_admin" on public.maintenance_schedules
  for update using (public.is_fleet_staff());

drop policy if exists "maintenance_schedules_delete_admin" on public.maintenance_schedules;
create policy "maintenance_schedules_delete_admin" on public.maintenance_schedules
  for delete using (public.is_fleet_staff());

-- Logging that service was performed is fleet-staff only now (previously
-- any signed-in user could log one) — same reasoning as the meter_readings
-- change above. with check still pins performed_by_id to the caller.
drop policy if exists "maintenance_records_select_authenticated" on public.maintenance_records;
drop policy if exists "maintenance_records_select_fleet_staff" on public.maintenance_records;
create policy "maintenance_records_select_fleet_staff" on public.maintenance_records
  for select using (public.is_fleet_staff());

drop policy if exists "maintenance_records_insert_authenticated" on public.maintenance_records;
drop policy if exists "maintenance_records_insert_fleet_staff" on public.maintenance_records;
create policy "maintenance_records_insert_fleet_staff" on public.maintenance_records
  for insert with check (public.is_fleet_staff() and performed_by_id = auth.uid());

-- Notifications are strictly private to their recipient — no admin
-- override, unlike everything else in this file (an admin doesn't need to
-- read another user's notification feed).
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using (user_id = auth.uid());

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

-- ============================================================
-- STORAGE — private "asset-photos" bucket, one folder per asset (folder
-- name = asset id). Fleet-staff only, full stop — employees have no UI
-- that uploads or views an asset photo, unlike assets/maintenance_schedules
-- above which they still need read access to.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('asset-photos', 'asset-photos', false)
on conflict (id) do nothing;

drop policy if exists "asset_photos_insert_authenticated" on storage.objects;
drop policy if exists "asset_photos_insert_fleet_staff" on storage.objects;
create policy "asset_photos_insert_fleet_staff" on storage.objects
  for insert with check (bucket_id = 'asset-photos' and public.is_fleet_staff());

drop policy if exists "asset_photos_select_authenticated" on storage.objects;
drop policy if exists "asset_photos_select_fleet_staff" on storage.objects;
create policy "asset_photos_select_fleet_staff" on storage.objects
  for select using (bucket_id = 'asset-photos' and public.is_fleet_staff());

drop policy if exists "asset_photos_delete_admin" on storage.objects;
create policy "asset_photos_delete_admin" on storage.objects
  for delete using (bucket_id = 'asset-photos' and public.is_fleet_staff());
