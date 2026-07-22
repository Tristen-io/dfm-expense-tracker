"use server";

import { createClient } from "@/lib/supabase/server";

// Generates a short-lived signed URL for a receipt stored in the private
// "receipts" bucket. RLS on storage.objects still applies to the request
// that issues the signed URL, so a non-owner/non-admin gets an error here.
export async function getReceiptSignedUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 300);
  if (error || !data) return null;
  return data.signedUrl;
}
