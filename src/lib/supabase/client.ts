"use client";

// Browser-side Supabase client. Safe to use in Client Components — it only ever
// holds the public anon key, and all data access is still enforced by Postgres
// Row Level Security policies (see supabase/schema.sql).
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
