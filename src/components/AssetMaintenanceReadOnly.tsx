import MaintenanceStatusBadge from "@/components/MaintenanceStatusBadge";
import { computeMaintenanceStatus } from "@/lib/maintenanceUtils";
import type { MaintenanceSchedule } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

// The employee-safe view of one asset's maintenance schedules — status and
// "last done," nothing editable. Used only on /maintenance-due/[id]; the
// fleet-staff equivalent (with add/edit/log-completed controls) lives on
// /fleet/assets/[id] instead.
export default function AssetMaintenanceReadOnly({
  schedules,
  currentMeterValue,
}: {
  schedules: MaintenanceSchedule[];
  currentMeterValue: number | null;
}) {
  if (schedules.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        Nothing is being tracked for this asset yet.
      </p>
    );
  }

  const sorted = [...schedules].sort(
    (a, b) => a.maintenance_type.localeCompare(b.maintenance_type)
  );

  return (
    <ul className="space-y-3">
      {sorted.map((schedule) => {
        const status = computeMaintenanceStatus(schedule, currentMeterValue);
        return (
          <li
            key={schedule.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {schedule.maintenance_type}
                </p>
                <p className="text-sm text-slate-500">
                  {schedule.last_performed_date
                    ? `Last done ${dateFmt.format(
                        new Date(`${schedule.last_performed_date}T00:00:00Z`)
                      )}`
                    : "Never logged"}
                  {schedule.interval_days && <> · Every {schedule.interval_days} days</>}
                  {schedule.interval_meter && <> · Every {schedule.interval_meter} units</>}
                </p>
              </div>
              <MaintenanceStatusBadge status={status} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
