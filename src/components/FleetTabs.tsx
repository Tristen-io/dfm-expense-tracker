"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/fleet", label: "Dashboard", exact: true },
  { href: "/fleet/assets", label: "Assets", exact: false },
  { href: "/fleet/maintenance", label: "Maintenance", exact: false },
  { href: "/fleet/tickets", label: "Service tickets", exact: false },
];

// Sub-nav within the Fleet & Equipment section — /fleet/* is fleet-staff
// only (admin or mechanic) now, so this always renders for one of those two
// roles; the isFleetStaff prop just gates the "+ Add asset" shortcut (both
// roles get it — mechanics have full parity with admins here).
export default function FleetTabs({ isFleetStaff }: { isFleetStaff: boolean }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
      <nav className="-mb-px flex gap-4 text-sm">
        {TABS.map((tab) => {
          // "startsWith(tab.href + "/")" rather than a bare startsWith —
          // otherwise "/fleet/maintenance-types" would (wrongly) light up
          // the "Maintenance" tab, since it shares that string as a prefix.
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
      {isFleetStaff && (
        <Link href="/fleet/assets/new" className="mb-3 text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
          + Add asset
        </Link>
      )}
    </div>
  );
}
