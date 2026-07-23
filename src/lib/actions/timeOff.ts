"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TIME_OFF_TYPES, type TimeOffStatus, type TimeOffType } from "@/lib/types";

// Requests submitted with less notice than this get flagged "short notice"
// so an admin can see it at a glance — it doesn't block submission, the
// admin still approves or denies either way. Change this single constant if
// the policy ever changes.
const MIN_NOTICE_DAYS = 7;

export interface TimeOffFormState {
  error: string | null;
  success?: boolean;
}

export async function createTimeOffRequest(
  _prevState: TimeOffFormState,
  formData: FormData
): Promise<TimeOffFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to request time off." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const type = String(formData.get("type") || "") as TimeOffType;
  const start_date = String(formData.get("start_date") || "");
  const end_date = String(formData.get("end_date") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!TIME_OFF_TYPES.includes(type)) {
    return { error: "Choose a valid time off type." };
  }
  if (!start_date || !end_date) {
    return { error: "Start and end date are required." };
  }
  if (end_date < start_date) {
    return { error: "End date can't be before the start date." };
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const noticeDays = Math.round(
    (new Date(`${start_date}T00:00:00Z`).getTime() - new Date(`${todayIso}T00:00:00Z`).getTime()) /
      86_400_000
  );
  const short_notice = noticeDays < MIN_NOTICE_DAYS;

  const { error } = await supabase.from("time_off_requests").insert({
    user_id: user.id,
    employee_name: profile?.full_name ?? user.email ?? "Unknown",
    type,
    start_date,
    end_date,
    reason: reason || null,
    short_notice,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/time-off");
  revalidatePath("/admin/time-off");
  return { error: null, success: true };
}

// Admin-only. Same reviewed_by_name/reviewed_at audit pattern as
// updateExpenseStatus in expenses.ts — cleared back to null on reset to
// "pending".
export async function updateTimeOffStatus(id: string, status: TimeOffStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Only an admin can review time off requests.");

  const reviewed = status !== "pending";
  const { error } = await supabase
    .from("time_off_requests")
    .update({
      status,
      reviewed_by_name: reviewed ? profile.full_name : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/time-off");
  revalidatePath("/admin/time-off");
}

// Allowed for the requesting employee while still "pending", or an admin at
// any time — same rule as expenses.
export async function deleteTimeOffRequest(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("time_off_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/time-off");
  revalidatePath("/admin/time-off");
}
