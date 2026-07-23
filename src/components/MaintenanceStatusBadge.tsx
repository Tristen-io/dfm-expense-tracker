import type { MaintenanceStatus } from "@/lib/maintenanceUtils";

const styles: Record<MaintenanceStatus, string> = {
  ok: "bg-green-50 text-green-700 ring-green-600/20",
  due_soon: "bg-amber-50 text-amber-700 ring-amber-600/20",
  overdue: "bg-red-50 text-red-700 ring-red-600/20",
  unknown: "bg-slate-100 text-slate-500 ring-slate-500/20",
};

const labels: Record<MaintenanceStatus, string> = {
  ok: "OK",
  due_soon: "Due soon",
  overdue: "Overdue",
  unknown: "Not yet logged",
};

export default function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

// Compact dot version for dense contexts like the assets table, where a
// full badge per row would be too wide.
export function MaintenanceStatusDot({ status }: { status: MaintenanceStatus | null }) {
  if (status === null) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const dotColor = {
    ok: "bg-green-500",
    due_soon: "bg-amber-500",
    overdue: "bg-red-500",
    unknown: "bg-slate-300",
  }[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      {labels[status]}
    </span>
  );
}
