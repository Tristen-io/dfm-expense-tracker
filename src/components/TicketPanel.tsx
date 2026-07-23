"use client";

import { useState, useTransition } from "react";
import { acknowledgeTicket, addTicketComment, deleteServiceTicket, updateTicketStatus } from "@/lib/actions/tickets";
import { useRouter } from "next/navigation";
import TicketStatusBadge from "@/components/TicketStatusBadge";
import { TICKET_STATUSES, type ServiceTicket, type TicketComment, type TicketStatus } from "@/lib/types";

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function TicketPanel({
  ticket,
  comments,
  isFleetStaff,
  canManageAsReporter,
}: {
  ticket: ServiceTicket;
  comments: TicketComment[];
  isFleetStaff: boolean;
  canManageAsReporter: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const router = useRouter();

  function handleStatusChange(status: TicketStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await updateTicketStatus(ticket.id, status);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update status.");
      }
    });
  }

  function handleAcknowledge() {
    setError(null);
    startTransition(async () => {
      try {
        await acknowledgeTicket(ticket.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't acknowledge.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Delete this ticket? This can't be undone.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteServiceTicket(ticket.id);
        router.push("/fleet/tickets");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete ticket.");
      }
    });
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addTicketComment(ticket.id, commentBody);
        setCommentBody("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add comment.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Status</h2>
          {isFleetStaff ? (
            <select
              value={ticket.status}
              disabled={pending}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm capitalize disabled:opacity-60"
            >
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          ) : (
            <TicketStatusBadge status={ticket.status} />
          )}
        </div>

        {ticket.priority === "911" && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {ticket.acknowledged_at ? (
              <>
                Acknowledged by {ticket.acknowledged_by_name} on{" "}
                {dateTimeFmt.format(new Date(ticket.acknowledged_at))}.
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Not yet acknowledged.</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleAcknowledge}
                  className="rounded-md bg-red-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  I&apos;ve seen this
                </button>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {(isFleetStaff || canManageAsReporter) && (
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className="mt-3 text-sm text-slate-400 underline underline-offset-2 hover:text-red-600 disabled:opacity-50"
          >
            Delete ticket
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Comments</h2>
        {comments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No comments yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-900">
                  {c.author_name}{" "}
                  <span className="font-normal text-slate-400">
                    {dateTimeFmt.format(new Date(c.created_at))}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.body}</p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAddComment} className="mt-4 space-y-2">
          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={3}
            placeholder="Add an update…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending || !commentBody.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Add comment
          </button>
        </form>
      </div>
    </div>
  );
}
