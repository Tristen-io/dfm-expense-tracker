import Link from "next/link";
import AssetStatusBadge from "@/components/AssetStatusBadge";
import { MaintenanceStatusDot } from "@/components/MaintenanceStatusBadge";
import type { MaintenanceStatus } from "@/lib/maintenanceUtils";
import { METER_TYPE_LABELS, type Asset } from "@/lib/types";

export default function AssetTable({
  assets,
  maintenanceStatusByAsset,
}: {
  assets: Asset[];
  // Worst maintenance status per asset (see worstMaintenanceStatus in
  // maintenanceUtils.ts) — optional so this table still works anywhere it
  // doesn't make sense to fetch schedules (there's currently no such call
  // site, but this keeps the component usable without them).
  maintenanceStatusByAsset?: Record<string, MaintenanceStatus | null>;
}) {
  if (assets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No assets found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-slate-500">
            <th className="px-4 py-2.5">Unit #</th>
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Category</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Meter</th>
            <th className="px-4 py-2.5">Maintenance</th>
            <th className="px-4 py-2.5">Assigned to</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assets.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <Link
                  href={`/fleet/assets/${a.id}`}
                  className="font-medium text-slate-900 underline-offset-2 hover:underline"
                >
                  {a.asset_number}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-slate-700">{a.name}</td>
              <td className="px-4 py-2.5 text-slate-500">{a.category ?? "—"}</td>
              <td className="px-4 py-2.5">
                <AssetStatusBadge status={a.status} />
              </td>
              <td className="px-4 py-2.5 text-slate-500">
                {a.meter_type === "none"
                  ? "—"
                  : `${a.current_meter_value?.toLocaleString() ?? "—"} (${METER_TYPE_LABELS[a.meter_type]})`}
              </td>
              <td className="px-4 py-2.5">
                <MaintenanceStatusDot status={maintenanceStatusByAsset?.[a.id] ?? null} />
              </td>
              <td className="px-4 py-2.5 text-slate-500">{a.assigned_to_name ?? "Unassigned"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
