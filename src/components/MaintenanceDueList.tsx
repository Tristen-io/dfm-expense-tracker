import Link from "next/link";
import MaintenanceStatusBadge from "@/components/MaintenanceStatusBadge";
import type { MaintenanceDueItem } from "@/lib/maintenanceUtils";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

// linkBase controls where each row links to: default is the fleet-staff
// asset detail page (/fleet/assets/[id]); pass a different base (e.g.
// "/maintenance-due") to link into the employee-safe read-only view
// instead — employees can't reach /fleet/assets/[id] (fleet-staff only).
export default function MaintenanceDueList({
  items,
  emptyMessage = "Nothing tracked yet.",
  linkBase = "/fleet/assets",
}: {
  items: MaintenanceDueItem[];
  emptyMessage?: string;
  linkBase?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map(({ schedule, assetId, assetNumber, assetName, status }) => (
        <li key={schedule.id}>
          <Link
            href={`${linkBase}/${assetId}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {schedule.maintenance_type}
                </p>
                <p className="text-sm text-slate-500">
                  {assetNumber} — {assetName}
                  {schedule.last_performed_date && (
                    <> · Last done {dateFmt.format(new Date(`${schedule.last_performed_date}T00:00:00Z`))}</>
                  )}
                </p>
              </div>
              <MaintenanceStatusBadge status={status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
