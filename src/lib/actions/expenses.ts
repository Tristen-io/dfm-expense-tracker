"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  EXPENSE_CATEGORIES,
  MATERIAL_TYPES,
  type ExpenseCategory,
  type ExpenseStatus,
  type MaterialType,
} from "@/lib/types";

export interface ExpenseFormState {
  error: string | null;
  success?: boolean;
}

// Creates a new expense entry. The receipt (if any) must already have been
// uploaded client-side to Supabase Storage before calling this — we only
// persist the resulting storage path here (see ReceiptUpload in ExpenseForm).
//
// `amount` is optional: a material order can be logged with quantity/mix
// design before the price is known, then confirmed later via
// updateExpenseAmount() once the invoice or delivery ticket comes in.
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
  const amountRaw = String(formData.get("amount") || "").trim();
  const job_name = String(formData.get("job_name") || "").trim();
  const category = String(formData.get("category") || "") as ExpenseCategory;
  const notes = String(formData.get("notes") || "").trim();
  const receipt_path = String(formData.get("receipt_path") || "") || null;
  const materialTypeRaw = String(formData.get("material_type") || "") as MaterialType | "";
  const quantityRaw = String(formData.get("quantity") || "").trim();
  const quantity_unit = String(formData.get("quantity_unit") || "").trim();
  const mix_design = String(formData.get("mix_design") || "").trim();

  if (!expense_date) return { error: "Date is required." };

  let amount: number | null = null;
  if (amountRaw) {
    amount = Number(amountRaw);
    if (Number.isNaN(amount) || amount <= 0) {
      return { error: "Enter a valid amount greater than 0, or leave it blank." };
    }
  }

  if (!job_name) return { error: "Job/project name is required." };
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return { error: "Choose a valid category." };
  }

  let material_type: MaterialType | null = null;
  let quantity: number | null = null;

  if (category === "Material") {
    if (!MATERIAL_TYPES.includes(materialTypeRaw as MaterialType)) {
      return { error: "Choose a material type." };
    }
    material_type = materialTypeRaw as MaterialType;

    if (!quantityRaw) {
      return { error: "Enter the quantity ordered." };
    }
    quantity = Number(quantityRaw);
    if (Number.isNaN(quantity) || quantity <= 0) {
      return { error: "Enter a valid quantity greater than 0." };
    }
    if (!quantity_unit) {
      return { error: "Enter a unit for the quantity." };
    }
  }

  const { error } = await supabase.from("expenses").insert({
    user_id: user.id,
    employee_name: profile?.full_name ?? user.email ?? "Unknown",
    expense_date,
    amount,
    job_name,
    category,
    material_type,
    quantity,
    quantity_unit: material_type ? quantity_unit : null,
    mix_design: material_type ? mix_design || null : null,
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
// The database itself rejects status = 'approved' while amount is null, so
// this can't be used to sneak a priceless order through.
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

// Fills in (or corrects) the dollar amount on an order placed before the
// price was known. Allowed for the submitting employee while the entry is
// still 'pending', or for an admin at any time (same RLS rule as edits).
export async function updateExpenseAmount(id: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid amount greater than 0.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("expenses").update({ amount }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/my-entries");
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
