import Link from "next/link";
import { logout } from "@/lib/actions/auth";
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

// Plain <details>/<summary> — no client JS needed for open/close, works
// without hydration, and every link inside navigates to a new page anyway
// (which resets the open state for free). `name="nav-dropdown"` makes the
// three menus mutually exclusive: opening one closes any other that's open.
function NavDropdown({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details name="nav-dropdown" className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
        {label}
        <span className="text-xs text-slate-400 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
        {children}
      </div>
    </details>
  );
}

function Divider() {
  return <div className="my-1 border-t border-slate-100" />;
}

export default function Navbar({ profile }: { profile: Profile }) {
  const isAdmin = profile.role === "admin";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-slate-900">DFM Concrete & Asphalt</span>

          {isAdmin ? (
            // Admins have a lot more to reach (personal pages + review/admin
            // screens for each area), so it's grouped into dropdowns by
            // area — expenses, time off, employee info — instead of one
            // long flat row.
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
            </nav>
          ) : (
            // Employees only ever see their own four pages — still short
            // enough that a flat row is simpler than a dropdown.
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
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>
            {profile.full_name}
            {isAdmin && (
              <span className="ml-1.5 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                admin
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
