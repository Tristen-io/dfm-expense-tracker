import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AssetForm from "@/components/AssetForm";
import AssetPhotoUpload from "@/components/AssetPhotoUpload";
import AssetStatusBadge from "@/components/AssetStatusBadge";
import MaintenanceSchedulePanel from "@/components/MaintenanceSchedulePanel";
import MeterReadingPanel from "@/components/MeterReadingPanel";
import TicketList from "@/components/TicketList";
import { deleteAsset, updateAsset } from "@/lib/actions/assets";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MaintenanceRecord, Profile } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  // /fleet/* is already fleet-staff only (see fleet/layout.tsx), so this is
  // always true in practice — kept explicit since the edit/read-only split
  // below is keyed off it, and it reads clearer than a bare `true`.
  const isFleetStaff = profile.role === "admin" || profile.role === "mechanic";

  const supabase = await createClient();
  const [{ data: asset }, { data: readings }, { data: tickets }, { data: schedules }, { data: maintenanceTypes }] =
    await Promise.all([
      supabase.from("assets").select("*").eq("id", id).single(),
      supabase
        .from("meter_readings")
        .select("*")
        .eq("asset_id", id)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("service_tickets")
        .select("*")
        .eq("asset_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("asset_id", id)
        .order("maintenance_type"),
      supabase.from("maintenance_types").select("*").order("name"),
    ]);

  if (!asset) notFound();

  let categories: { id: string; name: string; created_at: string }[] = [];
  let profiles: Profile[] = [];
  if (isFleetStaff) {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("asset_categories").select("*").order("name"),
      supabase.from("profiles").select("*").order("full_name"),
    ]);
    categories = c ?? [];
    profiles = p ?? [];
  }

  const scheduleIds = (schedules ?? []).map((s) => s.id);
  const { data: records } =
    scheduleIds.length > 0
      ? await supabase
          .from("maintenance_records")
          .select("*")
          .in("schedule_id", scheduleIds)
          .order("performed_date", { ascending: false })
      : { data: [] as MaintenanceRecord[] };

  const recordsBySchedule: Record<string, MaintenanceRecord[]> = {};
  for (const r of records ?? []) {
    (recordsBySchedule[r.schedule_id] ??= []).push(r);
  }

  async function handleDelete() {
    "use server";
    await deleteAsset(id);
    redirect("/fleet/assets");
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {asset.asset_number} — {asset.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {[asset.year, asset.make, asset.model].filter(Boolean).join(" ") || "No make/model on file"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AssetStatusBadge status={asset.status} />
          <Link
            href={`/fleet/tickets/new?asset=${asset.id}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Report an issue
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {isFleetStaff ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Edit asset</h2>
              <div className="mt-3">
                <AssetForm
                  action={updateAsset.bind(null, id)}
                  asset={asset}
                  categories={categories}
                  profiles={profiles}
                  submitLabel="Save changes"
                />
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">Photo</h3>
                <div className="mt-2">
                  <AssetPhotoUpload assetId={asset.id} photoPath={asset.photo_path} />
                </div>
              </div>
              <form action={handleDelete} className="mt-5 border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  className="text-sm text-slate-400 underline underline-offset-2 hover:text-red-600"
                >
                  Delete asset
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Details</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Category</dt>
                  <dd className="text-slate-900">{asset.category ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">VIN / serial</dt>
                  <dd className="text-slate-900">{asset.vin_or_serial ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Assigned to</dt>
                  <dd className="text-slate-900">{asset.assigned_to_name ?? "Unassigned"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Location</dt>
                  <dd className="text-slate-900">{asset.location ?? "—"}</dd>
                </div>
                {asset.purchase_date && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Purchased</dt>
                    <dd className="text-slate-900">
                      {dateFmt.format(new Date(`${asset.purchase_date}T00:00:00Z`))}
                    </dd>
                  </div>
                )}
              </dl>
              {asset.notes && <p className="mt-3 text-sm text-slate-600">{asset.notes}</p>}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {asset.meter_type !== "none" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Meter readings</h2>
              <div className="mt-3">
                <MeterReadingPanel
                  assetId={asset.id}
                  readingType={asset.meter_type}
                  currentValue={asset.current_meter_value}
                  readings={readings ?? []}
                  isFleetStaff={isFleetStaff}
                />
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Maintenance</h2>
            <div className="mt-3">
              <MaintenanceSchedulePanel
                assetId={asset.id}
                meterType={asset.meter_type}
                currentMeterValue={asset.current_meter_value}
                schedules={schedules ?? []}
                recordsBySchedule={recordsBySchedule}
                maintenanceTypes={maintenanceTypes ?? []}
                isFleetStaff={isFleetStaff}
              />
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">Service tickets</h2>
            <div className="mt-3">
              <TicketList tickets={tickets ?? []} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
