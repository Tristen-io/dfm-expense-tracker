import type { TicketPriority } from "@/lib/types";

// "911" gets a visually distinct, higher-alarm treatment than the other
// three (solid red vs. the ring-only style everything else in the app
// uses) since it's meant to be impossible to scan past in a ticket list.
const styles: Record<TicketPriority, string> = {
  low: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  medium: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  high: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20",
  "911": "bg-red-600 text-white",
};

const labels: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  "911": "911",
};

export default function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles[priority]}`}
    >
      {labels[priority]}
    </span>
  );
}
