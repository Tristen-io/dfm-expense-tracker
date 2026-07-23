"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addMaintenanceType(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter a maintenance type name.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("maintenance_types").insert({ name: trimmed });
  if (error) {
    if (error.code === "23505") throw new Error(`"${trimmed}" is already on the list.`);
    throw new Error(error.message);
  }

  revalidatePath("/fleet/assets", "layout");
  revalidatePath("/fleet/maintenance-types");
}

export async function deleteMaintenanceType(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("maintenance_types").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/fleet/maintenance-types");
}

export interface MaintenanceScheduleFormState {
  error: string | null;
  success?: boolean;
}

// Admin-only (also enforced by RLS: maintenance_schedules_insert_admin).
export async function createMaintenanceSchedule(
  assetId: string,
  _prevState: MaintenanceScheduleFormState,
  formData: FormData
): Promise<MaintenanceScheduleFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const maintenance_type = String(formData.get("maintenance_type") || "").trim();
  const intervalDaysRaw = String(formData.get("interval_days") || "").trim();
  const intervalMeterRaw = String(formData.get("interval_meter") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!maintenance_type) return { error: "Choose or enter a maintenance type." };

  let interval_days: number | null = null;
  if (intervalDaysRaw) {
    interval_days = Number(intervalDaysRaw);
    if (!Number.isFinite(interval_days) || interval_days <= 0) {
      return { error: "Enter a valid number of days greater than 0." };
    }
  }

  let interval_meter: number | null = null;
  if (intervalMeterRaw) {
    interval_meter = Number(intervalMeterRaw);
    if (!Number.isFinite(interval_meter) || interval_meter <= 0) {
      return { error: "Enter a valid meter interval greater than 0." };
    }
  }

  if (interval_days === null && interval_meter === null) {
    return { error: "Set an interval in days, meter units, or both." };
  }

  const { error } = await supabase.from("maintenance_schedules").insert({
    asset_id: assetId,
    maintenance_type,
    interval_days,
    interval_meter,
    notes: notes || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `"${maintenance_type}" is already tracked for this asset.` };
    }
    return { error: error.message };
  }

  revalidatePath(`/fleet/assets/${assetId}`);
  revalidatePath("/fleet/assets");
  return { error: null, success: true };
}

export async function deleteMaintenanceSchedule(id: string, assetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("maintenance_schedules").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/fleet/assets/${assetId}`);
  revalidatePath("/fleet/assets");
}

export interface MaintenanceRecordFormState {
  error: string | null;
  success?: boolean;
}

// Any signed-in user can log that service was performed — the person who
// actually did the oil change is often not an admin. See
// maintenance_records_insert_authenticated in schema.sql.
export async function addMaintenanceRecord(
  _prevState: MaintenanceRecordFormState,
  formData: FormData
): Promise<MaintenanceRecordFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const schedule_id = String(formData.get("schedule_id") || "");
  const asset_id = String(formData.get("asset_id") || "");
  const performed_date = String(formData.get("performed_date") || "");
  const performedMeterRaw = String(formData.get("performed_meter") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!schedule_id) return { error: "Missing schedule." };
  if (!performed_date) return { error: "Enter the date service was performed." };

  let performed_meter: number | null = null;
  if (performedMeterRaw) {
    performed_meter = Number(performedMeterRaw);
    if (!Number.isFinite(performed_meter) || performed_meter < 0) {
      return { error: "Enter a valid, non-negative meter reading." };
    }
  }

  const { error } = await supabase.from("maintenance_records").insert({
    schedule_id,
    performed_date,
    performed_meter,
    performed_by_id: user.id,
    performed_by_name: profile?.full_name ?? user.email ?? "Unknown",
    notes: notes || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/fleet/assets/${asset_id}`);
  revalidatePath("/fleet/assets");
  return { error: null, success: true };
}
