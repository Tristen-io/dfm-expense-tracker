"use client";

import { useRef, useState, useTransition } from "react";
import { createExpense } from "@/lib/actions/expenses";
import { createClient } from "@/lib/supabase/client";
import { EXPENSE_CATEGORIES } from "@/lib/types";

function todayLocalISODate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function ExpenseForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [receiptPath, setReceiptPath] = useState<string>("");
  const [receiptFileName, setReceiptFileName] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUploadError("You must be signed in to attach a receipt.");
        return;
      }

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage.from("receipts").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadErr) {
        setUploadError(uploadErr.message);
        return;
      }

      setReceiptPath(path);
      setReceiptFileName(file.name);
    } finally {
      setUploading(false);
    }
  }

  function clearReceipt() {
    setReceiptPath("");
    setReceiptFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await createExpense({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      clearReceipt();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="expense_date" className="block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="expense_date"
            name="expense_date"
            type="date"
            required
            defaultValue={todayLocalISODate()}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-slate-700">
            Amount ($)
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="job_name" className="block text-sm font-medium text-slate-700">
          Job / project name
        </label>
        <input
          id="job_name"
          name="job_name"
          type="text"
          required
          placeholder="e.g. 4th & Main driveway pour"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-slate-700">
          Category
        </label>
        <select
          id="category"
          name="category"
          required
          defaultValue=""
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="" disabled>
            Select a category…
          </option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Optional details — vendor, purpose, etc."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="receipt" className="block text-sm font-medium text-slate-700">
          Receipt photo (optional)
        </label>
        <input
          ref={fileInputRef}
          id="receipt"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        <input type="hidden" name="receipt_path" value={receiptPath} />
        {uploading && <p className="mt-1 text-sm text-slate-500">Uploading receipt…</p>}
        {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
        {receiptPath && !uploading && (
          <p className="mt-1 flex items-center gap-2 text-sm text-green-700">
            Attached: {receiptFileName}
            <button type="button" onClick={clearReceipt} className="text-slate-500 underline">
              remove
            </button>
          </p>
        )}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending || uploading}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white transition hover:bg-slate-700 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Submitting…" : "Submit expense"}
      </button>
    </form>
  );
}
