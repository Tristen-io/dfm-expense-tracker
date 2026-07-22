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
  amount: number;
  job_name: string;
  category: ExpenseCategory;
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
  amount: number;
  job_name: string;
  category: ExpenseCategory;
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
