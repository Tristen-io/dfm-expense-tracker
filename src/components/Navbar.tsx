import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import NavDropdown from "@/components/NavDropdown";
import NotificationBell from "@/components/NotificationBell";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block whitespace-nowrap px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}

function Divider() {
  return <div className="my-1 border-t border-slate-100" />;
}

// Async because it fetches the caller's own notifications here rather than
// making every page that renders <Navbar> (nine and counting) do it — the
// only call sites are Server Components, so an async component is a drop-in
// replacement. Notifications are strictly own-row (see notifications RLS in
// schema.sql), so this can't leak another user's data.
export default async function Navbar({ profile }: { profile: Profile }) {
  const isAdmin = profile.role === "admin";
  const isMechanic = profile.role === "mechanic";

  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-slate-900">DFM Concrete & Asphalt</span>

          {isAdmin ? (
            // Admins have a lot more to reach (personal pages + review/admin
            // screens for each area), so it's grouped into dropdowns by
            // area — expenses, time off, employee info, fleet & equipment —
            // instead of one long flat row.
            <nav className="flex items-center gap-1 text-sm">
              <NavDropdown label="Expenses">
                <NavLink href="/submit">New expense</NavLink>
                <NavLink href="/my-entries">My entries</NavLink>
                <Divider />
                <NavLink href="/admin/entries">All entries</NavLink>
                <NavLink href="/admin/reports">Reports</NavLink>
                <NavLink href="/admin/vendors">Vendors</NavLink>
                <NavLink href="/admin/jobs">Jobs</NavLink>
              </NavDropdown>
              <NavDropdown label="Time Off">
                <NavLink href="/time-off">My time off</NavLink>
                <Divider />
                <NavLink href="/admin/time-off">Review requests</NavLink>
              </NavDropdown>
              <NavDropdown label="Employee Info">
                <NavLink href="/profile">My profile</NavLink>
                <Divider />
                <NavLink href="/admin/employees">Employee directory</NavLink>
              </NavDropdown>
              <NavDropdown label="Fleet & Equipment">
                <NavLink href="/fleet">Dashboard</NavLink>
                <NavLink href="/fleet/assets">Assets</NavLink>
                <NavLink href="/fleet/assets/new">New asset</NavLink>
                <Divider />
                <NavLink href="/fleet/maintenance">Maintenance</NavLink>
                <NavLink href="/fleet/maintenance-types">Maintenance types</NavLink>
                <Divider />
                <NavLink href="/fleet/tickets">Service tickets</NavLink>
              </NavDropdown>
            </nav>
          ) : isMechanic ? (
            // Mechanics have no HR/expense admin screens — just their own
            // personal pages as a flat row, plus the exact same Fleet &
            // Equipment dropdown an admin gets (full parity within fleet,
            // nothing outside it).
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/submit" className="text-slate-600 hover:text-slate-900">
                New expense
              </Link>
              <Link href="/my-entries" className="text-slate-600 hover:text-slate-900">
                My entries
              </Link>
              <Link href="/time-off" className="text-slate-600 hover:text-slate-900">
                My time off
              </Link>
              <Link href="/profile" className="text-slate-600 hover:text-slate-900">
                My profile
              </Link>
              <NavDropdown label="Fleet & Equipment">
                <NavLink href="/fleet">Dashboard</NavLink>
                <NavLink href="/fleet/assets">Assets</NavLink>
                <NavLink href="/fleet/assets/new">New asset</NavLink>
                <Divider />
                <NavLink href="/fleet/maintenance">Maintenance</NavLink>
                <NavLink href="/fleet/maintenance-types">Maintenance types</NavLink>
                <Divider />
                <NavLink href="/fleet/tickets">Service tickets</NavLink>
              </NavDropdown>
            </nav>
          ) : (
            // Employees only ever see their own personal pages, plus a
            // deliberately narrow Fleet & Equipment slice — report an
            // issue, see their own reported tickets, and a read-only view
            // of what maintenance is due. No dashboard, no asset registry,
            // no editing — see /report-issue, /my-tickets, /maintenance-due
            // and fleet/layout.tsx (which redirects employees out of
            // /fleet/* entirely).
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/submit" className="text-slate-600 hover:text-slate-900">
                New expense
              </Link>
              <Link href="/my-entries" className="text-slate-600 hover:text-slate-900">
                My entries
              </Link>
              <Link href="/time-off" className="text-slate-600 hover:text-slate-900">
                My time off
              </Link>
              <Link href="/profile" className="text-slate-600 hover:text-slate-900">
                My profile
              </Link>
              <NavDropdown label="Fleet & Equipment">
                <NavLink href="/report-issue">Report an issue</NavLink>
                <NavLink href="/my-tickets">My tickets</NavLink>
                <NavLink href="/maintenance-due">Maintenance due</NavLink>
              </NavDropdown>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <NotificationBell notifications={notifications ?? []} />
          <span>
            {profile.full_name}
            {(isAdmin || isMechanic) && (
              <span className="ml-1.5 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                {profile.role}
              </span>
            )}
          </span>
          <form action={logout}>
            <button type="submit" className="text-slate-500 underline underline-offset-2 hover:text-slate-900">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
