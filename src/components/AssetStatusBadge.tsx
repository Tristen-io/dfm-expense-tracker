import type { AssetStatus } from "@/lib/types";

const styles: Record<AssetStatus, string> = {
  active: "bg-green-50 text-green-700 ring-green-600/20",
  out_of_service: "bg-red-50 text-red-700 ring-red-600/20",
  retired: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

const labels: Record<AssetStatus, string> = {
  active: "Active",
  out_of_service: "Out of service",
  retired: "Retired",
};

export default function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
