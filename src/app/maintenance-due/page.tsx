import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import MaintenanceDueList from "@/components/MaintenanceDueList";
import { buildMaintenanceDueItems } from "@/lib/maintenanceUtils";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Employee-facing equivalent of /fleet/maintenance — same computed
// overdue/due-soon/ok status, but read-only and linking into
// /maintenance-due/[id] instead of the fleet-staff-only /fleet/assets/[id].
// No status filter tabs or "+ Add asset" here — just "what's due," full
// stop. Renders its own <Navbar> since it's outside the fleet layout.
export default async function MaintenanceDuePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data: assets }, { data: schedules }] = await Promise.all([
    supabase.from("assets").select("id, asset_number, name, current_meter_value"),
    supabase.from("maintenance_schedules").select("*"),
  ]);

  const items = buildMaintenanceDueItems(assets ?? [], schedules ?? []);

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">Maintenance due</h1>
        <p className="mt-1 text-sm text-slate-500">
          {items.length} tracked item{items.length === 1 ? "" : "s"} across the fleet. Tap one to
          see the details.
        </p>

        <div className="mt-6">
          <MaintenanceDueList
            items={items}
            linkBase="/maintenance-due"
            emptyMessage="Nothing is being tracked yet."
          />
        </div>
      </main>
    </div>
  );
}
