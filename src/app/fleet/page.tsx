import Link from "next/link";
import MaintenanceDueList from "@/components/MaintenanceDueList";
import TicketList from "@/components/TicketList";
import { buildMaintenanceDueItems } from "@/lib/maintenanceUtils";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function FleetDashboard() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [
    { count: totalAssets },
    { count: outOfService },
    { count: openTickets },
    { data: unacknowledged911 },
    { data: recentTickets },
    { data: maintenanceAssets },
    { data: maintenanceSchedules },
  ] = await Promise.all([
    supabase.from("assets").select("*", { count: "exact", head: true }),
    supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("status", "out_of_service"),
    supabase
      .from("service_tickets")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "on_hold"]),
    supabase
      .from("service_tickets")
      .select("*")
      .eq("priority", "911")
      .is("acknowledged_at", null)
      .in("status", ["open", "in_progress", "on_hold"]),
    supabase
      .from("service_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("assets").select("id, asset_number, name, current_meter_value"),
    supabase.from("maintenance_schedules").select("*"),
  ]);

  const maintenanceDueItems = buildMaintenanceDueItems(
    maintenanceAssets ?? [],
    maintenanceSchedules ?? []
  ).filter((i) => i.status === "overdue" || i.status === "due_soon");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Fleet & equipment</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assets, meter readings, and service tickets for the crew. Signed in as{" "}
            <span className="font-medium">{profile?.full_name}</span>.
          </p>
        </div>
        <Link
          href="/fleet/tickets/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Report an issue
        </Link>
      </div>

      {(unacknowledged911?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            {unacknowledged911!.length} unacknowledged 911-priority ticket
            {unacknowledged911!.length === 1 ? "" : "s"}
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/fleet/assets"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs font-medium text-slate-500">Total assets</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{totalAssets ?? 0}</p>
        </Link>
        <Link
          href="/fleet/assets?status=out_of_service"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs font-medium text-slate-500">Out of service</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{outOfService ?? 0}</p>
        </Link>
        <Link
          href="/fleet/tickets"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs font-medium text-slate-500">Open tickets</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{openTickets ?? 0}</p>
        </Link>
        <Link
          href="/fleet/maintenance"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs font-medium text-slate-500">Needs maintenance</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{maintenanceDueItems.length}</p>
        </Link>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Needs maintenance</h2>
        {maintenanceDueItems.length > 0 && (
          <Link href="/fleet/maintenance" className="text-sm text-slate-500 underline underline-offset-2">
            View all
          </Link>
        )}
      </div>
      <div className="mt-3">
        <MaintenanceDueList
          items={maintenanceDueItems.slice(0, 10)}
          emptyMessage="Nothing overdue or due soon — you're all caught up."
        />
      </div>

      <h2 className="mt-8 text-base font-semibold text-slate-900">Recent tickets</h2>
      <div className="mt-3">
        <TicketList tickets={recentTickets ?? []} />
      </div>
    </div>
  );
}
