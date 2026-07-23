import type { TicketStatus } from "@/lib/types";

const styles: Record<TicketStatus, string> = {
  open: "bg-amber-50 text-amber-700 ring-amber-600/20",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-600/20",
  on_hold: "bg-slate-100 text-slate-600 ring-slate-500/20",
  completed: "bg-green-50 text-green-700 ring-green-600/20",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-400/20",
};

const labels: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
