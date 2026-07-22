import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Fetches the signed-in user's auth user + profile row together.
// Returns null if nobody is signed in (middleware normally prevents this
// from being hit on protected routes, but pages should still guard).
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile ?? null;
}
