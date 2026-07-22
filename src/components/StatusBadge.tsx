import type { ExpenseStatus } from "@/lib/types";

const styles: Record<ExpenseStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  approved: "bg-green-50 text-green-700 ring-green-600/20",
  flagged: "bg-red-50 text-red-700 ring-red-600/20",
};

export default function StatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${styles[status]}`}
    >
      {status}
    </span>
  );
}
