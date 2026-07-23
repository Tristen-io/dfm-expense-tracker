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

// "mechanic" has full parity with "admin" within Fleet & Equipment only —
// see is_fleet_staff() in supabase/schema.sql for the RLS side of this and
// Navbar.tsx/fleet/layout.tsx/proxy.ts for the routing side.
export type Role = "employee" | "admin" | "mechanic";

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

// ============================================================
// FLEET & EQUIPMENT — Phase 1 (asset registry, meter readings, service
// tickets, notifications). See supabase/schema.sql for the matching
// tables/constraints.
// ============================================================

export type AssetStatus = "active" | "out_of_service" | "retired";

export type MeterType = "mileage" | "hours" | "none";

export const METER_TYPES: MeterType[] = ["mileage", "hours", "none"];

export const METER_TYPE_LABELS: Record<MeterType, string> = {
  mileage: "Mileage",
  hours: "Engine hours",
  none: "Not tracked",
};

export type AssetCategory = {
  id: string;
  name: string;
  created_at: string;
};

export type Asset = {
  id: string;
  asset_number: string;
  name: string;
  category: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin_or_serial: string | null;
  status: AssetStatus;
  meter_type: MeterType;
  // Denormalized latest meter_readings value for this asset — kept in sync
  // by the apply_meter_reading() trigger, not recomputed on read.
  current_meter_value: number | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  location: string | null;
  purchase_date: string | null; // YYYY-MM-DD
  notes: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
};

export type MeterReadingType = "mileage" | "hours";

export type MeterReading = {
  id: string;
  asset_id: string;
  reading_type: MeterReadingType;
  value: number;
  recorded_by_id: string | null;
  recorded_by_name: string;
  is_override: boolean;
  override_reason: string | null;
  created_at: string;
};

export type TicketPriority = "low" | "medium" | "high" | "911";

export const TICKET_PRIORITIES: TicketPriority[] = ["low", "medium", "high", "911"];

export type TicketStatus = "open" | "in_progress" | "on_hold" | "completed" | "cancelled";

export const TICKET_STATUSES: TicketStatus[] = [
  "open",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
];

export type ServiceTicket = {
  id: string;
  asset_id: string;
  // Denormalized snapshot of the asset's number/name at creation time —
  // see supabase/schema.sql for why (avoids a join for ticket lists).
  asset_number: string;
  asset_name: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  reported_by_id: string | null;
  reported_by_name: string;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketStatusHistoryEntry = {
  id: string;
  ticket_id: string;
  status: TicketStatus;
  changed_by_name: string;
  note: string | null;
  created_at: string;
};

export type TicketComment = {
  id: string;
  ticket_id: string;
  user_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
};

export type NotificationType =
  | "ticket_created"
  | "ticket_911"
  | "ticket_status_changed"
  | "meter_override";

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
};

export type AssetCategoryInsert = {
  name: string;
  id?: string;
  created_at?: string;
};

export type AssetInsert = {
  asset_number: string;
  name: string;
  category?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  vin_or_serial?: string | null;
  status?: AssetStatus;
  meter_type?: MeterType;
  current_meter_value?: number | null;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  location?: string | null;
  purchase_date?: string | null;
  notes?: string | null;
  photo_path?: string | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type MeterReadingInsert = {
  asset_id: string;
  reading_type: MeterReadingType;
  value: number;
  recorded_by_id?: string | null;
  recorded_by_name: string;
  is_override?: boolean;
  override_reason?: string | null;
  id?: string;
  created_at?: string;
};

export type ServiceTicketInsert = {
  asset_id: string;
  asset_number: string;
  asset_name: string;
  title: string;
  description: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  reported_by_id?: string | null;
  reported_by_name: string;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  acknowledged_by_name?: string | null;
  acknowledged_at?: string | null;
  completed_at?: string | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type TicketCommentInsert = {
  ticket_id: string;
  user_id?: string | null;
  author_name: string;
  body: string;
  id?: string;
  created_at?: string;
};

// ============================================================
// MAINTENANCE — admin-configured per-asset service schedules (time and/or
// meter based, "whichever comes first") and the log of completed service
// against them. See supabase/schema.sql for the matching tables.
// Status (ok/due soon/overdue) is computed client-side from these rows,
// not stored — see src/lib/maintenanceUtils.ts.
// ============================================================

export type MaintenanceType = {
  id: string;
  name: string;
  created_at: string;
};

export type MaintenanceSchedule = {
  id: string;
  asset_id: string;
  maintenance_type: string;
  interval_days: number | null;
  interval_meter: number | null;
  // Denormalized from the most recent maintenance_records row — kept in
  // sync by the apply_maintenance_record() trigger, not recomputed on read.
  last_performed_date: string | null; // YYYY-MM-DD
  last_performed_meter: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceRecord = {
  id: string;
  schedule_id: string;
  performed_date: string; // YYYY-MM-DD
  performed_meter: number | null;
  performed_by_id: string | null;
  performed_by_name: string;
  notes: string | null;
  created_at: string;
};

export type MaintenanceTypeInsert = {
  name: string;
  id?: string;
  created_at?: string;
};

export type MaintenanceScheduleInsert = {
  asset_id: string;
  maintenance_type: string;
  interval_days?: number | null;
  interval_meter?: number | null;
  last_performed_date?: string | null;
  last_performed_meter?: number | null;
  notes?: string | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type MaintenanceRecordInsert = {
  schedule_id: string;
  performed_date: string;
  performed_meter?: number | null;
  performed_by_id?: string | null;
  performed_by_name: string;
  notes?: string | null;
  id?: string;
  created_at?: string;
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
      asset_categories: {
        Row: AssetCategory;
        Insert: AssetCategoryInsert;
        Update: Partial<AssetCategory>;
        Relationships: [];
      };
      assets: {
        Row: Asset;
        Insert: AssetInsert;
        Update: Partial<Asset>;
        Relationships: [];
      };
      meter_readings: {
        Row: MeterReading;
        Insert: MeterReadingInsert;
        Update: Partial<MeterReading>;
        Relationships: [];
      };
      service_tickets: {
        Row: ServiceTicket;
        Insert: ServiceTicketInsert;
        Update: Partial<ServiceTicket>;
        Relationships: [];
      };
      ticket_status_history: {
        Row: TicketStatusHistoryEntry;
        Insert: Omit<TicketStatusHistoryEntry, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<TicketStatusHistoryEntry>;
        Relationships: [];
      };
      ticket_comments: {
        Row: TicketComment;
        Insert: TicketCommentInsert;
        Update: Partial<TicketComment>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Notification>;
        Relationships: [];
      };
      maintenance_types: {
        Row: MaintenanceType;
        Insert: MaintenanceTypeInsert;
        Update: Partial<MaintenanceType>;
        Relationships: [];
      };
      maintenance_schedules: {
        Row: MaintenanceSchedule;
        Insert: MaintenanceScheduleInsert;
        Update: Partial<MaintenanceSchedule>;
        Relationships: [];
      };
      maintenance_records: {
        Row: MaintenanceRecord;
        Insert: MaintenanceRecordInsert;
        Update: Partial<MaintenanceRecord>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      acknowledge_write_up: {
        Args: { write_up_id: string };
        Returns: void;
      };
      acknowledge_ticket: {
        Args: { ticket_id: string };
        Returns: void;
      };
      mark_notifications_read: {
        Args: { notification_id?: string | null };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
