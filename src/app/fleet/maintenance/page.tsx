import Link from "next/link";
import MaintenanceDueList from "@/components/MaintenanceDueList";
import { buildMaintenanceDueItems, type MaintenanceStatus } from "@/lib/maintenanceUtils";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES: MaintenanceStatus[] = ["overdue", "due_soon", "unknown", "ok"];
const LABELS: Record<MaintenanceStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  unknown: "Not yet logged",
  ok: "OK",
};

export default async function FleetMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const statusParam = resolvedParams.status;
  const statusRaw = Array.isArray(statusParam) ? statusParam[0] : statusParam;
  const status = VALID_STATUSES.includes(statusRaw as MaintenanceStatus)
    ? (statusRaw as MaintenanceStatus)
    : undefined;

  const supabase = await createClient();
  const [{ data: assets }, { data: schedules }] = await Promise.all([
    supabase.from("assets").select("id, asset_number, name, current_meter_value"),
    supabase.from("maintenance_schedules").select("*"),
  ]);

  const allItems = buildMaintenanceDueItems(assets ?? [], schedules ?? []);
  const items = status ? allItems.filter((i) => i.status === status) : allItems;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Maintenance</h1>
          <p className="mt-1 text-sm text-slate-500">
            {items.length} tracked item{items.length === 1 ? "" : "s"}
            {status ? ` (${LABELS[status].toLowerCase()})` : ""} across the fleet.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {VALID_STATUSES.map((s) => (
          <a
            key={s}
            href={`/fleet/maintenance?status=${s}`}
            className={`rounded-lg border px-3 py-1.5 ${
              status === s
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {LABELS[s]}
          </a>
        ))}
        <Link
          href="/fleet/maintenance"
          className={`rounded-lg border px-3 py-1.5 ${
            !status
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          All
        </Link>
      </div>

      <div className="mt-6">
        <MaintenanceDueList
          items={items}
          emptyMessage={
            status
              ? `No items are currently "${LABELS[status].toLowerCase()}".`
              : "Nothing is being tracked yet — add items from an asset's page."
          }
        />
      </div>
    </div>
  );
}
