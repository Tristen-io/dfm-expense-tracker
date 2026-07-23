"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export interface ProfileFormState {
  error: string | null;
  success?: boolean;
}

// Self-service: an employee updates their own phone/address. RLS
// (profiles_update_own_or_admin) permits this; the role-escalation trigger
// in schema.sql is what stops this same policy from being used to change
// role.
export async function updateOwnContactInfo(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();

  const { error } = await supabase
    .from("profiles")
    .update({ phone: phone || null, address: address || null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { error: null, success: true };
}

// Admin: correct another employee's contact info from /admin/employees/[id].
export async function updateEmployeeContactInfo(userId: string, phone: string, address: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Only an admin can edit another employee's info.");

  const { error } = await supabase
    .from("profiles")
    .update({ phone: phone.trim() || null, address: address.trim() || null })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/employees/${userId}`);
  revalidatePath("/admin/employees");
}

// Admin: promote/demote an employee's role — replaces having to do this by
// hand in the Supabase Table Editor. Blocks changing your own role so an
// admin can't accidentally lock themselves out.
export async function setEmployeeRole(userId: string, role: Role) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  if (userId === user.id) throw new Error("You can't change your own role.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Only an admin can change roles.");

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/employees/${userId}`);
  revalidatePath("/admin/employees");
}
