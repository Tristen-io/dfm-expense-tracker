"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { METER_TYPES, type AssetStatus, type MeterType } from "@/lib/types";

// Generates a short-lived signed URL for a photo in the private
// "asset-photos" bucket — same pattern as getReceiptSignedUrl in receipts.ts.
export async function getAssetPhotoSignedUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("asset-photos").createSignedUrl(path, 300);
  if (error || !data) return null;
  return data.signedUrl;
}

export interface AssetFormState {
  error: string | null;
  success?: boolean;
}

type ParsedAssetFields = {
  asset_number: string;
  name: string;
  category: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin_or_serial: string | null;
  status: AssetStatus;
  meter_type: MeterType;
  assigned_to_id: string | null;
  location: string | null;
  purchase_date: string | null;
  notes: string | null;
  photo_path: string | null;
};

// Shared by createAsset/updateAsset — pulls + validates the fields common to
// both. Fleet-staff only (admin or mechanic) in both cases — also enforced
// by RLS (assets_insert_admin / assets_update_admin, both now gated on
// is_fleet_staff()); checked explicitly here for a clean error message.
function parseAssetFields(
  formData: FormData
): { error: string } | { fields: ParsedAssetFields } {
  const asset_number = String(formData.get("asset_number") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const make = String(formData.get("make") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const yearRaw = String(formData.get("year") || "").trim();
  const vin_or_serial = String(formData.get("vin_or_serial") || "").trim();
  const status = String(formData.get("status") || "active") as AssetStatus;
  const meter_type = String(formData.get("meter_type") || "mileage") as MeterType;
  const assigned_to_id = String(formData.get("assigned_to_id") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const purchase_date = String(formData.get("purchase_date") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const photo_path = String(formData.get("photo_path") || "").trim();

  if (!asset_number) return { error: "Asset/unit number is required." };
  if (!name) return { error: "Name is required." };
  if (!METER_TYPES.includes(meter_type)) return { error: "Choose a valid meter type." };
  if (!["active", "out_of_service", "retired"].includes(status)) {
    return { error: "Choose a valid status." };
  }

  let year: number | null = null;
  if (yearRaw) {
    year = Number(yearRaw);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return { error: "Enter a valid year." };
    }
  }

  return {
    fields: {
      asset_number,
      name,
      category: category || null,
      make: make || null,
      model: model || null,
      year,
      vin_or_serial: vin_or_serial || null,
      status,
      meter_type,
      assigned_to_id: assigned_to_id || null,
      location: location || null,
      purchase_date: purchase_date || null,
      notes: notes || null,
      photo_path: photo_path || null,
    },
  };
}

export async function createAsset(
  _prevState: AssetFormState,
  formData: FormData
): Promise<AssetFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = parseAssetFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  let assigned_to_name: string | null = null;
  if (parsed.fields.assigned_to_id) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", parsed.fields.assigned_to_id)
      .single();
    assigned_to_name = assignee?.full_name ?? null;
  }

  const { data, error } = await supabase
    .from("assets")
    .insert({ ...parsed.fields, assigned_to_name })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: `Asset/unit number "${parsed.fields.asset_number}" is already in use.` };
    }
    return { error: error.message };
  }

  revalidatePath("/fleet/assets");
  revalidatePath("/fleet");
  redirect(`/fleet/assets/${data.id}`);
}

export async function updateAsset(
  id: string,
  _prevState: AssetFormState,
  formData: FormData
): Promise<AssetFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = parseAssetFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  let assigned_to_name: string | null = null;
  if (parsed.fields.assigned_to_id) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", parsed.fields.assigned_to_id)
      .single();
    assigned_to_name = assignee?.full_name ?? null;
  }

  const { error } = await supabase
    .from("assets")
    .update({ ...parsed.fields, assigned_to_name })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: `Asset/unit number "${parsed.fields.asset_number}" is already in use.` };
    }
    return { error: error.message };
  }

  revalidatePath("/fleet/assets");
  revalidatePath(`/fleet/assets/${id}`);
  revalidatePath("/fleet");
  return { error: null, success: true };
}

export async function deleteAsset(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/fleet/assets");
  revalidatePath("/fleet");
}

export interface MeterReadingFormState {
  error: string | null;
  success?: boolean;
}

// Fleet-staff only (admin or mechanic) — logging equipment meters is fleet
// info, same reasoning as asset writes. A backwards value additionally
// requires checking the "this is a correction" box and a reason —
// enforce_meter_reading_order() in schema.sql is the real gate for that
// part; the role checks here just give a clean error instead of a raw
// Postgres RLS/exception failure.
export async function addMeterReading(
  _prevState: MeterReadingFormState,
  formData: FormData
): Promise<MeterReadingFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "mechanic") {
    return { error: "Only an admin or mechanic can log a meter reading." };
  }

  const asset_id = String(formData.get("asset_id") || "");
  const reading_type = String(formData.get("reading_type") || "");
  const valueRaw = String(formData.get("value") || "").trim();
  const is_override = formData.get("is_override") === "on";
  const override_reason = String(formData.get("override_reason") || "").trim();

  if (!asset_id) return { error: "Missing asset." };
  if (reading_type !== "mileage" && reading_type !== "hours") {
    return { error: "Invalid reading type." };
  }
  if (!valueRaw) return { error: "Enter a reading." };
  const value = Number(valueRaw);
  if (Number.isNaN(value) || value < 0) return { error: "Enter a valid, non-negative reading." };

  if (is_override && !override_reason) {
    return { error: "Enter a reason for the override." };
  }

  const { error } = await supabase.from("meter_readings").insert({
    asset_id,
    reading_type,
    value,
    recorded_by_id: user.id,
    recorded_by_name: profile?.full_name ?? user.email ?? "Unknown",
    is_override,
    override_reason: is_override ? override_reason : null,
  });

  if (error) {
    // enforce_meter_reading_order() raises a plain exception (no error
    // code) for a rejected backwards reading — its message is already
    // written to be shown directly to the user.
    return { error: error.message };
  }

  revalidatePath(`/fleet/assets/${asset_id}`);
  revalidatePath("/fleet/assets");
  revalidatePath("/fleet");
  return { error: null, success: true };
}

// Fleet-staff only. The file itself is uploaded client-side straight to the
// "asset-photos" bucket (see AssetPhotoUpload) — this just persists the
// resulting storage path, same split as receipt uploads on expenses.
export async function setAssetPhoto(assetId: string, photoPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase
    .from("assets")
    .update({ photo_path: photoPath || null })
    .eq("id", assetId);
  if (error) throw new Error(error.message);

  revalidatePath(`/fleet/assets/${assetId}`);
  revalidatePath("/fleet/assets");
}

export async function addAssetCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter a category name.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("asset_categories").insert({ name: trimmed });
  if (error) {
    if (error.code === "23505") throw new Error(`"${trimmed}" is already on the list.`);
    throw new Error(error.message);
  }

  revalidatePath("/fleet/assets/new");
}
