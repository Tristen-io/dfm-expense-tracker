"use client";

import { useState, useTransition } from "react";
import { deleteExpense, updateExpenseStatus } from "@/lib/actions/expenses";
import { getReceiptSignedUrl } from "@/lib/actions/receipts";
import StatusBadge from "@/components/StatusBadge";
import type { Expense, ExpenseStatus } from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(isoDate: string) {
  return dateFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

export default function EntriesTable({
  expenses,
  mode,
}: {
  expenses: Expense[];
  mode: "employee" | "admin";
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [receiptErrors, setReceiptErrors] = useState<Record<string, string>>({});

  function handleStatus(id: string, status: ExpenseStatus) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await updateExpenseStatus(id, status);
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this expense entry? This can't be undone.")) return;
    setPendingId(id);
    startTransition(async () => {
      try {
        await deleteExpense(id);
      } finally {
        setPendingId(null);
      }
    });
  }

  async function handleViewReceipt(path: string) {
    setReceiptErrors((prev) => ({ ...prev, [path]: "" }));
    const url = await getReceiptSignedUrl(path);
    if (!url) {
      setReceiptErrors((prev) => ({ ...prev, [path]: "Couldn't load receipt." }));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (expenses.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No entries yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {expenses.map((expense) => {
        const busy = isPending && pendingId === expense.id;
        const canEmployeeManage = mode === "employee" && expense.status === "pending";

        return (
          <li
            key={expense.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-slate-900">{expense.job_name}</p>
                <p className="text-sm text-slate-500">
                  {formatDate(expense.expense_date)} · {expense.category}
                  {mode === "admin" && <> · {expense.employee_name}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-slate-900">
                  {currency.format(expense.amount)}
                </span>
                <StatusBadge status={expense.status} />
              </div>
            </div>

            {expense.notes && <p className="mt-2 text-sm text-slate-600">{expense.notes}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {expense.receipt_path && (
                <button
                  type="button"
                  onClick={() => handleViewReceipt(expense.receipt_path!)}
                  className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
                >
                  View receipt
                </button>
              )}
              {expense.receipt_path && receiptErrors[expense.receipt_path] && (
                <span className="text-red-600">{receiptErrors[expense.receipt_path]}</span>
              )}

              {mode === "admin" && expense.status !== "approved" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatus(expense.id, "approved")}
                  className="rounded-md bg-green-600 px-2.5 py-1 font-medium text-white hover:bg-green-500 disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              {mode === "admin" && expense.status !== "flagged" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatus(expense.id, "flagged")}
                  className="rounded-md bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Flag
                </button>
              )}
              {mode === "admin" && expense.status !== "pending" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatus(expense.id, "pending")}
                  className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Reset to pending
                </button>
              )}
              {(mode === "admin" || canEmployeeManage) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(expense.id)}
                  className="ml-auto text-slate-400 underline underline-offset-2 hover:text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
