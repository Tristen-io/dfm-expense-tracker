import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";

export default function Navbar({ profile }: { profile: Profile }) {
  const isAdmin = profile.role === "admin";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-slate-900">DFM Concrete & Asphalt</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/submit" className="text-slate-600 hover:text-slate-900">
              New expense
            </Link>
            <Link href="/my-entries" className="text-slate-600 hover:text-slate-900">
              My entries
            </Link>
            <Link href="/time-off" className="text-slate-600 hover:text-slate-900">
              Time off
            </Link>
            <Link href="/profile" className="text-slate-600 hover:text-slate-900">
              My profile
            </Link>
            {isAdmin && (
              <>
                <Link href="/admin/entries" className="text-slate-600 hover:text-slate-900">
                  All entries
                </Link>
                <Link href="/admin/reports" className="text-slate-600 hover:text-slate-900">
                  Reports
                </Link>
                <Link href="/admin/vendors" className="text-slate-600 hover:text-slate-900">
                  Vendors
                </Link>
                <Link href="/admin/jobs" className="text-slate-600 hover:text-slate-900">
                  Jobs
                </Link>
                <Link href="/admin/time-off" className="text-slate-600 hover:text-slate-900">
                  Time off requests
                </Link>
                <Link href="/admin/employees" className="text-slate-600 hover:text-slate-900">
                  Employees
                </Link>
              </>
            )}
          </nav>
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
