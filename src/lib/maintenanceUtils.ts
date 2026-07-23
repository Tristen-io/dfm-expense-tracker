import type { MaintenanceSchedule } from "@/lib/types";

// Status is computed here, not stored — see MaintenanceSchedule in
// types.ts. Each basis (calendar time, meter) is evaluated independently
// since they're different units and can't be directly compared; the
// overall status is the worst of whichever bases have enough data to
// evaluate. "unknown" means the schedule has never been logged and there's
// no baseline to measure from yet, not that it's actually overdue.
export type MaintenanceStatus = "ok" | "due_soon" | "overdue" | "unknown";

// A schedule is flagged "due soon" inside this many days of its calendar
// due date, or within whichever is larger of 10% of the meter interval or
// 100 units — a fixed 10% would round to ~0 for a short interval (e.g. a
// 200-mile interval) and a fixed 100 units would trigger far too early for
// a very long one (e.g. a 50,000-mile interval).
const DUE_SOON_DAYS = 14;
const DUE_SOON_METER_FRACTION = 0.1;
const DUE_SOON_METER_MIN = 100;

function worseOf(a: MaintenanceStatus, b: MaintenanceStatus): MaintenanceStatus {
  const rank: Record<MaintenanceStatus, number> = { unknown: 0, ok: 1, due_soon: 2, overdue: 3 };
  return rank[a] >= rank[b] ? a : b;
}

export function computeMaintenanceStatus(
  schedule: MaintenanceSchedule,
  currentMeterValue: number | null,
  today: Date = new Date()
): MaintenanceStatus {
  let dayStatus: MaintenanceStatus | null = null;
  if (schedule.interval_days !== null && schedule.last_performed_date) {
    const due = new Date(`${schedule.last_performed_date}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + schedule.interval_days);
    const daysRemaining = Math.floor(
      (due.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
        86_400_000
    );
    dayStatus = daysRemaining <= 0 ? "overdue" : daysRemaining <= DUE_SOON_DAYS ? "due_soon" : "ok";
  }

  let meterStatus: MaintenanceStatus | null = null;
  if (
    schedule.interval_meter !== null &&
    schedule.last_performed_meter !== null &&
    currentMeterValue !== null
  ) {
    const dueAt = schedule.last_performed_meter + schedule.interval_meter;
    const remaining = dueAt - currentMeterValue;
    const dueSoonThreshold = Math.max(schedule.interval_meter * DUE_SOON_METER_FRACTION, DUE_SOON_METER_MIN);
    meterStatus = remaining <= 0 ? "overdue" : remaining <= dueSoonThreshold ? "due_soon" : "ok";
  }

  if (dayStatus === null && meterStatus === null) return "unknown";
  if (dayStatus === null) return meterStatus!;
  if (meterStatus === null) return dayStatus;
  return worseOf(dayStatus, meterStatus);
}

// Worst status across a set of schedules for one asset — used for the
// single-dot summary on the assets table.
export function worstMaintenanceStatus(
  schedules: MaintenanceSchedule[],
  currentMeterValue: number | null,
  today: Date = new Date()
): MaintenanceStatus | null {
  if (schedules.length === 0) return null;
  return schedules
    .map((s) => computeMaintenanceStatus(s, currentMeterValue, today))
    .reduce((worst, s) => worseOf(worst, s), "unknown");
}
