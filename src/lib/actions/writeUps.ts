"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { WRITE_UP_CATEGORIES, type WriteUpCategory } from "@/lib/types";

export interface WriteUpFormState {
  error: string | null;
  success?: boolean;
}

// Admin-only — creates a write-up for the given employee. RLS also enforces
// this (write_ups_insert_admin), this check just gives a clean error
// message instead of a silent no-op.
export async function createWriteUp(
  _prevState: WriteUpFormState,
  formData: FormData
): Promise<WriteUpFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Only an admin can create a write-up." };

  const target_user_id = String(formData.get("user_id") || "");
  const employee_name = String(formData.get("employee_name") || "");
  const incident_date = String(formData.get("incident_date") || "");
  const category = String(formData.get("category") || "") as WriteUpCategory;
  const description = String(formData.get("description") || "").trim();
  const corrective_action = String(formData.get("corrective_action") || "").trim();

  if (!target_user_id || !employee_name) return { error: "Missing employee." };
  if (!incident_date) return { error: "Incident date is required." };
  if (!WRITE_UP_CATEGORIES.includes(category)) return { error: "Choose a valid category." };
  if (!description) return { error: "Describe what happened." };

  const { error } = await supabase.from("write_ups").insert({
    user_id: target_user_id,
    employee_name,
    created_by_name: profile.full_name,
    incident_date,
    category,
    description,
    corrective_action: corrective_action || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/employees/${target_user_id}`);
  revalidatePath("/profile");
  return { error: null, success: true };
}

// Admin-only — for correcting a mistaken entry.
export async function deleteWriteUp(id: string, userId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Only an admin can remove a write-up.");

  const { error } = await supabase.from("write_ups").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/employees/${userId}`);
  revalidatePath("/profile");
}

// The employee it's about marks it read. Goes through the acknowledge_write_up
// security-definer function (see supabase/schema.sql) rather than a normal
// update — that function only ever sets acknowledged_at on the caller's own
// row, so there's no generic UPDATE policy that could be used to edit the
// write-up's actual content.
export async function acknowledgeWriteUp(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.rpc("acknowledge_write_up", { write_up_id: id });
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
}
