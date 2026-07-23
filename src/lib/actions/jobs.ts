"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Admin-only. RLS also enforces this (jobs_insert_admin / _delete_admin
// policies), these checks just give a clean error message instead of a
// silent no-op. Same pattern as src/lib/actions/vendors.ts.
export async function addJob(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter a job/project name.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("jobs").insert({ name: trimmed });
  if (error) {
    if (error.code === "23505") {
      throw new Error(`"${trimmed}" is already on the list.`);
    }
    throw new Error(error.message);
  }

  revalidatePath("/admin/jobs");
  revalidatePath("/submit");
}

export async function deleteJob(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/jobs");
  revalidatePath("/submit");
}
