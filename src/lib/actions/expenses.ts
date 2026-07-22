"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseStatus } from "@/lib/types";

export interface ExpenseFormState {
  error: string | null;
  success?: boolean;
}

// Creates a new expense entry. The receipt (if any) must already have been
// uploaded client-side to Supabase Storage before calling this — we only
// persist the resulting storage path here (see ReceiptUpload in ExpenseForm).
export async function createExpense(
  _prevState: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to submit an expense." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const expense_date = String(formData.get("expense_date") || "");
  const amountRaw = String(formData.get("amount") || "");
  const job_name = String(formData.get("job_name") || "").trim();
  const category = String(formData.get("category") || "") as ExpenseCategory;
  const notes = String(formData.get("notes") || "").trim();
  const receipt_path = String(formData.get("receipt_path") || "") || null;

  const amount = Number(amountRaw);

  if (!expense_date) return { error: "Date is required." };
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    return { error: "Enter a valid amount greater than 0." };
  }
  if (!job_name) return { error: "Job/project name is required." };
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return { error: "Choose a valid category." };
  }

  const { error } = await supabase.from("expenses").insert({
    user_id: user.id,
    employee_name: profile?.full_name ?? user.email ?? "Unknown",
    expense_date,
    amount,
    job_name,
    category,
    notes: notes || null,
    receipt_path,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/my-entries");
  revalidatePath("/admin/entries");
  revalidatePath("/admin/reports");
  return { error: null, success: true };
}

// Admin-only: approve or flag an entry. RLS also enforces this server-side,
// this check just gives a clean error message instead of a silent no-op.
export async function updateExpenseStatus(id: string, status: ExpenseStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("expenses").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/entries");
  revalidatePath("/admin/reports");
}

// Delete an entry. RLS allows this for the owner while status is 'pending',
// or for an admin at any time.
export async function deleteExpense(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/my-entries");
  revalidatePath("/admin/entries");
  revalidatePath("/admin/reports");
}
