import type { ExpenseStatus, TimeOffStatus } from "@/lib/types";

// Shared by expenses (pending/approved/flagged) and time off requests
// (pending/approved/denied) — "flagged" and "denied" are both a negative
// outcome, so they share the same red styling.
const styles: Record<ExpenseStatus | TimeOffStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  approved: "bg-green-50 text-green-700 ring-green-600/20",
  flagged: "bg-red-50 text-red-700 ring-red-600/20",
  denied: "bg-red-50 text-red-700 ring-red-600/20",
};

export default function StatusBadge({ status }: { status: ExpenseStatus | TimeOffStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${styles[status]}`}
    >
      {status}
    </span>
  );
}
