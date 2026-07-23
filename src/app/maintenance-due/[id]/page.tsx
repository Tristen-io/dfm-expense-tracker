import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AssetMaintenanceReadOnly from "@/components/AssetMaintenanceReadOnly";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Employee-safe, view-only single-asset maintenance detail — deliberately
// NOT the full /fleet/assets/[id] page: no forms, no edit, no photo, no
// meter logging, no ticket list. Just the asset's name/number and what
// maintenance is due, per the "click into it and see what maintenance is
// due but nothing else" scope.
export default async function MaintenanceDueAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data: asset }, { data: schedules }] = await Promise.all([
    supabase
      .from("assets")
      .select("id, asset_number, name, current_meter_value")
      .eq("id", id)
      .single(),
    supabase.from("maintenance_schedules").select("*").eq("asset_id", id),
  ]);

  if (!asset) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">
          {asset.asset_number} — {asset.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Maintenance due for this asset.</p>

        <div className="mt-6">
          <AssetMaintenanceReadOnly
            schedules={schedules ?? []}
            currentMeterValue={asset.current_meter_value}
          />
        </div>
      </main>
    </div>
  );
}
