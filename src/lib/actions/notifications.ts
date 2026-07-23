"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Marks a single notification read, or every unread notification for the
// caller if id is omitted. Goes through the mark_notifications_read() RPC
// (see schema.sql) rather than a direct .update() so "mark all read" is one
// round trip instead of N.
export async function markNotificationsRead(id?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.rpc("mark_notifications_read", {
    notification_id: id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}
