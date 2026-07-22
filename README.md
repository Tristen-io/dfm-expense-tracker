# DFM Concrete & Asphalt — Expense Tracker

A small web app for logging and reviewing employee expenses, material purchases,
and fuel costs. Built for a 5–10 person crew, running entirely on free-tier
hosting.

## Stack, and why

| Piece | Choice | Why |
|---|---|---|
| Frontend + backend | **Next.js 16** (App Router, TypeScript, Tailwind) | One codebase, one deploy. Server Components + Server Actions mean no separate API layer to build or host. |
| Hosting | **Vercel** (free/Hobby tier) | Built for Next.js, zero-config deploys from GitHub, generous free tier that a 5–10 person internal tool will never come close to hitting. |
| Database + Auth + File storage | **Supabase** (free tier) | One free-tier service covers all three needs: a real Postgres database (not a spreadsheet — you get proper filtering, aggregation, and relational integrity), built-in email/password auth, and private file storage for receipt photos. Row Level Security (RLS) enforces "employees see only their own entries, admin sees everything" *in the database itself*, not just in the UI. |

Why not Google Sheets as the datastore? It would work for a while, but you'd
be hand-rolling auth, role separation, and concurrent-write safety, and
filtering/reporting gets painful past a few hundred rows. Why not Firebase?
Also a reasonable choice, but Supabase's SQL database made the reporting
(totals by day/week/month/job) and admin filtering much more natural to build
and much cheaper to extend later (e.g. payroll integration is just another
SQL query or export).

**Free-tier headroom for this use case:** Supabase's free tier includes a
500MB database, 1GB of file storage, and 50,000 monthly active users.
5–10 employees logging a handful of expenses a day will use a tiny fraction
of that — you'd need years of steady use to approach the database limit.
Vercel's free tier covers hosting, builds, and bandwidth for an internal tool
at this scale with room to spare. Neither should ever charge you anything at
this size unless Supabase or Vercel change their free-tier terms.

## What's built

- **Submission form** (`/submit`) — date, amount, job/project, category
  (General purchase / Material / Supplies / Fuel / Other), notes, optional
  receipt photo. Mobile-friendly, uses the phone camera when available.
  Picking "Material" reveals a material type (Concrete / Asphalt / Base
  Course / Other), a quantity + unit, and — for Concrete — a mix design
  field. The dollar amount is optional at submission time: material orders
  are often placed before the price is known, so amount can be left blank
  and filled in later (see "Awaiting price" below).
- **Awaiting price** — any entry submitted with no amount shows an "Awaiting
  price" badge instead of a dollar figure. Either the employee who submitted
  it (while still pending) or an admin can go back and add the amount once
  the invoice or delivery ticket arrives. An entry can't be approved (or
  exported) until it has an amount — enforced both in the UI and as a
  database constraint.
- **My entries** (`/my-entries`) — an employee's own submissions and their
  review status. Entries can be edited/deleted only while still "pending."
- **Admin — All entries** (`/admin/entries`) — every submission, filterable
  by employee, job, category, status, and date range. Approve, flag, or
  reset any entry.
- **Admin — Reports** (`/admin/reports`) — totals by day, week, month, and
  job/project for a selected date range and status.
- **CSV export** (`/admin/export`) — exports approved entries (respecting
  the current filters) as a CSV for accounting/payroll.
- **Auth** — Supabase email/password. New signups start as "employee";
  promote an account to "admin" directly in Supabase (see below). Route
  access is enforced both in `proxy.ts` (Next.js's replacement for
  `middleware.ts` as of v16) and via Postgres Row Level Security, so even a
  bug in the UI can't leak another employee's data.

## One-time setup

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account/project.
2. In the project dashboard, open **SQL Editor → New query**, paste in the
   entire contents of [`supabase/schema.sql`](./supabase/schema.sql), and run
   it. This creates the `profiles` and `expenses` tables, Row Level Security
   policies, and the private `receipts` storage bucket. It's safe to re-run
   if you ever need to.
3. Go to **Project Settings → API** and copy the **Project URL** and the
   **anon public** key. You'll need both in step 3 below.

### 2. Run it locally (optional, for development)

```bash
npm install
cp .env.local.example .env.local
# paste your Supabase URL + anon key into .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up for an account —
this becomes your first employee account.

### 3. Make yourself an admin

New accounts always start as `employee` (see the `handle_new_user` trigger in
`supabase/schema.sql`) — this is intentional so a stray signup can't grant
itself admin access. To promote your own account:

1. In the Supabase dashboard, go to **Table Editor → profiles**.
2. Find your row (matched by email is easiest to spot via the `auth.users`
   table if you're not sure which row is yours) and change `role` from
   `employee` to `admin`.
3. Sign out and back in on the site. You'll now land on `/admin/entries`
   instead of the submission form, and the nav bar will show "All entries"
   and "Reports."

Repeat this for anyone else who should have admin access.

### 4. Deploy to Vercel

1. Push this project to a GitHub repo.
2. In [Vercel](https://vercel.com), **Add New → Project**, import the repo.
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (same values as your `.env.local`)
4. Deploy. Vercel auto-detects Next.js — no build configuration needed.
5. Share the resulting `*.vercel.app` URL (or a custom domain, also free
   to attach on Vercel's Hobby tier) with your crew.

That's the whole deployment — no servers to manage, no ongoing infrastructure
cost at this scale.

## Project structure

```
src/
  app/
    login/, signup/          — auth pages
    submit/                  — employee expense submission form
    my-entries/              — employee's own entries
    admin/
      entries/                — all entries + filters + approve/flag
      reports/                 — totals by day/week/month/job
      export/route.ts          — CSV export (GET, streams a download)
    page.tsx                  — redirects to /submit or /admin/entries by role
  components/                 — ExpenseForm, EntriesTable, FiltersBar, etc.
  lib/
    actions/                  — Server Actions (auth, expenses, receipts)
    supabase/                 — browser + server Supabase clients
    types.ts                  — shared domain types + the Database schema type
    queries.ts                — shared filtered-query builder (entries + export use the same logic)
    reportUtils.ts             — day/week/month/job aggregation
  proxy.ts                    — route protection + session refresh (Next.js 16's renamed "middleware")
supabase/
  schema.sql                  — the entire database schema, RLS policies, and storage bucket setup
```

## Updating an already-deployed project

When you get an updated copy of this project (a new zip, or new files to
upload to GitHub), two things need to happen, in this order:

1. **Re-run `supabase/schema.sql`** in the Supabase SQL Editor. The whole
   file is written to be safe to re-run any time — it only adds/updates what
   changed, it won't touch or duplicate your existing data.
2. **Push the updated code** — upload the new files to GitHub the same way
   you did the first time (uploading a file with the same path as an
   existing one just updates it). Vercel redeploys automatically on push.

Do the database step first — if the code deploys before the matching
database columns exist, you'll see errors until both are in sync.

## Extending it later

- **More categories**: add the value to the `category` check constraint in
  `supabase/schema.sql` (and re-run just that `ALTER TABLE` statement) and to
  `EXPENSE_CATEGORIES` in `src/lib/types.ts`.
- **Payroll integration**: the CSV export in `src/app/admin/export/route.ts`
  is the natural extension point — swap or add an export format there, or
  point a payroll system at the same filtered-query logic in
  `src/lib/queries.ts`.
- **Per-job budgets, mileage, etc.**: add columns to the `expenses` table
  (or a related table) and extend `ExpenseForm.tsx` / the admin views.

## A note on the versions used

This project pins **Next.js 16** and a **current Supabase JS client**, both
of which introduced breaking changes worth knowing about if you (or an AI
assistant) modify this code later:

- Next.js 16 renamed `middleware.ts` to `proxy.ts` (function name `proxy`,
  not `middleware`). This project already uses the new convention.
- The Supabase JS client's TypeScript types now require the `Database` type's
  table `Row`/`Insert`/`Update` shapes to be written as `type` aliases, not
  `interface`s (interfaces don't satisfy the internal structural checks the
  client uses, and silently resolve to `never`). See the comment at the top
  of `src/lib/types.ts`.
