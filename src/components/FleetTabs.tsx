"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/fleet", label: "Dashboard", exact: true },
  { href: "/fleet/assets", label: "Assets", exact: false },
  { href: "/fleet/tickets", label: "Service tickets", exact: false },
];

// Sub-nav within the Fleet & Equipment section — keeps the main Navbar to a
// single "Fleet & Equipment" entry point (a flat link for employees, a
// dropdown for admins) instead of every sub-page needing its own top-level
// nav slot.
export default function FleetTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
      <nav className="-mb-px flex gap-4 text-sm">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`border-b-2 px-1 pb-3 font-medium ${
                active
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {isAdmin && (
        <Link href="/fleet/assets/new" className="mb-3 text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
          + Add asset
        </Link>
      )}
    </div>
  );
}
