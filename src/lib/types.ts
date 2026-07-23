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
  // email is a denormalized copy of the auth.users email (see
  // handle_new_user in supabase/schema.sql) — the auth schema isn't
  // reachable through the anon-key REST API, so this is how the app shows
  // it. phone/address are optional, self-editable by the employee (or by
  // an admin) on /profile and /admin/employees.
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
};

export type TimeOffType = "Vacation" | "Sick" | "Personal" | "Unpaid" | "Other";

export const TIME_OFF_TYPES: TimeOffType[] = [
  "Vacation",
  "Sick",
  "Personal",
  "Unpaid",
  "Other",
];

export type TimeOffStatus = "pending" | "approved" | "denied";

export type TimeOffRequest = {
  id: string;
  user_id: string;
  employee_name: string;
  type: TimeOffType;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  reason: string | null;
  status: TimeOffStatus;
  // True if submitted with less than MIN_NOTICE_DAYS notice (see
  // src/lib/actions/timeOff.ts) — set once at submission, not recalculated.
  short_notice: boolean;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WriteUpCategory = "Attendance" | "Safety" | "Performance" | "Conduct" | "Other";

export const WRITE_UP_CATEGORIES: WriteUpCategory[] = [
  "Attendance",
  "Safety",
  "Performance",
  "Conduct",
  "Other",
];

export type WriteUp = {
  id: string;
  user_id: string;
  employee_name: string;
  created_by_name: string;
  incident_date: string; // YYYY-MM-DD
  category: WriteUpCategory;
  description: string;
  corrective_action: string | null;
  // Set via the acknowledge_write_up() RPC once the employee has seen it —
  // never set by a generic row update, see schema.sql for why.
  acknowledged_at: string | null;
  created_at: string;
};

// Admin-curated list, shown as autocomplete suggestions on the expense form
// and used to group "spend by vendor" in Reports. expenses.vendor is a free
// text column, NOT a foreign key to this table — an employee can still type
// a one-off vendor name that isn't on the curated list.
export type Vendor = {
  id: string;
  name: string;
  created_at: string;
};

// Same pattern as Vendor: admin-curated suggestions for the job/project
// field, not a foreign key — expenses.job_name is always free text.
export type Job = {
  id: string;
  name: string;
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
  vendor: string | null;
  notes: string | null;
  receipt_path: string | null;
  status: ExpenseStatus;
  // Who moved this entry to approved/flagged, and when — cleared back to
  // null on reset to "pending". Denormalized name, same as employee_name.
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  full_name: string;
  role?: Role;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  created_at?: string;
};

export type TimeOffRequestInsert = {
  user_id: string;
  employee_name: string;
  type: TimeOffType;
  start_date: string;
  end_date: string;
  reason?: string | null;
  status?: TimeOffStatus;
  short_notice?: boolean;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type WriteUpInsert = {
  user_id: string;
  employee_name: string;
  created_by_name: string;
  incident_date: string;
  category: WriteUpCategory;
  description: string;
  corrective_action?: string | null;
  acknowledged_at?: string | null;
  id?: string;
  created_at?: string;
};

export type VendorInsert = {
  name: string;
  id?: string;
  created_at?: string;
};

export type JobInsert = {
  name: string;
  id?: string;
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
  vendor?: string | null;
  notes?: string | null;
  receipt_path?: string | null;
  status?: ExpenseStatus;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
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
      vendors: {
        Row: Vendor;
        Insert: VendorInsert;
        Update: Partial<Vendor>;
        Relationships: [];
      };
      jobs: {
        Row: Job;
        Insert: JobInsert;
        Update: Partial<Job>;
        Relationships: [];
      };
      expenses: {
        Row: Expense;
        Insert: ExpenseInsert;
        Update: Partial<Expense>;
        Relationships: [];
      };
      time_off_requests: {
        Row: TimeOffRequest;
        Insert: TimeOffRequestInsert;
        Update: Partial<TimeOffRequest>;
        Relationships: [];
      };
      write_ups: {
        Row: WriteUp;
        Insert: WriteUpInsert;
        Update: Partial<WriteUp>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      acknowledge_write_up: {
        Args: { write_up_id: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
