// Shared domain types for the expense tracker.
// Mirrors the Postgres schema in supabase/schema.sql — keep these in sync if you change the DB.
//
// NOTE: these are written as `type` aliases, not `interface`s. Supabase's
// generated Database types require every Row/Insert/Update shape to
// structurally satisfy `Record<string, unknown>` (checked via a conditional
// type). TypeScript only synthesizes that implicit index signature for
// object type literals — interfaces (which support declaration merging)
// don't qualify, so an interface here would silently make every table's
// Row/Insert/Update resolve to `never`.

export type Role = "employee" | "admin";

export type ExpenseCategory =
  | "General purchase"
  | "Material"
  | "Supplies"
  | "Fuel"
  | "Other";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "General purchase",
  "Material",
  "Supplies",
  "Fuel",
  "Other",
];

export type ExpenseStatus = "pending" | "approved" | "flagged";

// Only meaningful when category === "Material". Picking one of the first
// three auto-fills quantity_unit and, for Concrete, reveals the mix design
// field; "Other" leaves quantity_unit as free text.
export type MaterialType = "Concrete" | "Asphalt" | "Base Course" | "Other";

export const MATERIAL_TYPES: MaterialType[] = ["Concrete", "Asphalt", "Base Course", "Other"];

// Fixed unit per material type, used to auto-fill quantity_unit in the form.
// "Other" has no fixed unit — the user types their own.
export const MATERIAL_UNITS: Record<Exclude<MaterialType, "Other">, string> = {
  Concrete: "cubic yards",
  Asphalt: "tons",
  "Base Course": "tons",
};

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  employee_name: string;
  expense_date: string; // YYYY-MM-DD
  // Null while an order is placed but the price isn't known yet ("awaiting
  // price" — derived from amount === null, not a separate status value).
  // The DB forbids status = 'approved' while amount is null.
  amount: number | null;
  job_name: string;
  category: ExpenseCategory;
  material_type: MaterialType | null;
  quantity: number | null;
  quantity_unit: string | null;
  mix_design: string | null;
  notes: string | null;
  receipt_path: string | null;
  status: ExpenseStatus;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  full_name: string;
  role?: Role;
  created_at?: string;
};

export type ExpenseInsert = {
  user_id: string;
  employee_name: string;
  expense_date: string;
  amount?: number | null;
  job_name: string;
  category: ExpenseCategory;
  material_type?: MaterialType | null;
  quantity?: number | null;
  quantity_unit?: string | null;
  mix_design?: string | null;
  notes?: string | null;
  receipt_path?: string | null;
  status?: ExpenseStatus;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: Partial<Profile>;
        Relationships: [];
      };
      expenses: {
        Row: Expense;
        Insert: ExpenseInsert;
        Update: Partial<Expense>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
