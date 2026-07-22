"use client";

import { useState, useTransition } from "react";
import { deleteExpense, updateExpenseAmount, updateExpenseStatus } from "@/lib/actions/expenses";
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
  const [amountEditId, setAmountEditId] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);

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

  function openAmountForm(id: string) {
    setAmountEditId(id);
    setAmountDraft("");
    setAmountError(null);
  }

  function handleSaveAmount(id: string) {
    const value = Number(amountDraft);
    if (!amountDraft || Number.isNaN(value) || value <= 0) {
      setAmountError("Enter a valid amount greater than 0.");
      return;
    }
    setPendingId(id);
    startTransition(async () => {
      try {
        await updateExpenseAmount(id, value);
        setAmountEditId(null);
        setAmountDraft("");
        setAmountError(null);
      } catch (err) {
        setAmountError(err instanceof Error ? err.message : "Couldn't save the amount.");
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
        const canManageAmount = mode === "admin" || canEmployeeManage;
        const awaitingPrice = expense.amount === null;

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
                  {expense.material_type && <> ({expense.material_type})</>}
                  {mode === "admin" && <> · {expense.employee_name}</>}
                </p>
                {expense.quantity !== null && (
                  <p className="text-sm text-slate-500">
                    {expense.quantity} {expense.quantity_unit}
                    {expense.mix_design && <> · Mix: {expense.mix_design}</>}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {awaitingPrice ? (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    Awaiting price
                  </span>
                ) : (
                  <span className="text-lg font-semibold text-slate-900">
                    {currency.format(expense.amount!)}
                  </span>
                )}
                <StatusBadge status={expense.status} />
              </div>
            </div>

            {expense.notes && <p className="mt-2 text-sm text-slate-600">{expense.notes}</p>}

            {awaitingPrice && canManageAmount && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3">
                {amountEditId === expense.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      autoFocus
                      placeholder="0.00"
                      value={amountDraft}
                      onChange={(e) => setAmountDraft(e.target.value)}
                      className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveAmount(expense.id)}
                      className="rounded-md bg-slate-900 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountEditId(null)}
                      className="text-sm text-slate-500 underline"
                    >
                      Cancel
                    </button>
                    {amountError && <span className="w-full text-sm text-red-600">{amountError}</span>}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAmountForm(expense.id)}
                    className="text-sm font-medium text-amber-800 underline underline-offset-2"
                  >
                    Add amount once known
                  </button>
                )}
              </div>
            )}

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
                  disabled={busy || awaitingPrice}
                  title={awaitingPrice ? "Add an amount before approving" : undefined}
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
