"use client";

import { useRef, useState, useTransition } from "react";
import { createExpense } from "@/lib/actions/expenses";
import { createClient } from "@/lib/supabase/client";
import {
  EXPENSE_CATEGORIES,
  MATERIAL_TYPES,
  MATERIAL_UNITS,
  type ExpenseCategory,
  type Job,
  type MaterialType,
  type Vendor,
} from "@/lib/types";

function todayLocalISODate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

// Keeps a phone camera's full-resolution photo from eating into Supabase's
// free-tier storage faster than expected, and stops an obviously-wrong file
// (a PDF renamed to .jpg, a video) from being attached as a "receipt photo."
const MAX_RECEIPT_MB = 8;

export default function ExpenseForm({ vendors, jobs }: { vendors: Vendor[]; jobs: Job[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [receiptPath, setReceiptPath] = useState<string>("");
  const [receiptFileName, setReceiptFileName] = useState<string>("");
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [materialType, setMaterialType] = useState<MaterialType | "">("");
  const [customUnit, setCustomUnit] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMaterial = category === "Material";
  const fixedUnit = materialType && materialType !== "Other" ? MATERIAL_UNITS[materialType] : "";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Receipts must be a photo (JPG, PNG, HEIC, etc).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_RECEIPT_MB * 1024 * 1024) {
      setUploadError(`That photo is too large — please attach one under ${MAX_RECEIPT_MB}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

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
      setCategory("");
      setMaterialType("");
      setCustomUnit("");
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
            placeholder="Leave blank if not known yet"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Ordering material and don&apos;t know the price yet? Leave this blank — you (or an
            admin) can add it once the invoice or ticket comes in.
          </p>
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
          list="job-suggestions"
          placeholder="e.g. 4th & Main driveway pour"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <datalist id="job-suggestions">
          {jobs.map((j) => (
            <option key={j.id} value={j.name} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="vendor" className="block text-sm font-medium text-slate-700">
          Vendor
        </label>
        <input
          id="vendor"
          name="vendor"
          type="text"
          list="vendor-suggestions"
          placeholder="e.g. ABC Concrete Supply"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <datalist id="vendor-suggestions">
          {vendors.map((v) => (
            <option key={v.id} value={v.name} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-slate-700">
          Category
        </label>
        <select
          id="category"
          name="category"
          required
          value={category}
          onChange={(e) => {
            const next = e.target.value as ExpenseCategory | "";
            setCategory(next);
            if (next !== "Material") {
              setMaterialType("");
              setCustomUnit("");
            }
          }}
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

      {isMaterial && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <label htmlFor="material_type" className="block text-sm font-medium text-slate-700">
              Material type
            </label>
            <select
              id="material_type"
              name="material_type"
              required={isMaterial}
              value={materialType}
              onChange={(e) => {
                const next = e.target.value as MaterialType | "";
                setMaterialType(next);
                setCustomUnit("");
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="" disabled>
                Select material…
              </option>
              {MATERIAL_TYPES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {materialType && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">
                  Quantity
                </label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <div>
                <label htmlFor="quantity_unit" className="block text-sm font-medium text-slate-700">
                  Unit
                </label>
                {materialType === "Other" ? (
                  <input
                    id="quantity_unit"
                    name="quantity_unit"
                    type="text"
                    required
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="e.g. loads, bags"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                ) : (
                  <input
                    id="quantity_unit"
                    name="quantity_unit"
                    type="text"
                    readOnly
                    value={fixedUnit}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2.5 text-base text-slate-600"
                  />
                )}
              </div>
            </div>
          )}

          {materialType === "Concrete" && (
            <div>
              <label htmlFor="mix_design" className="block text-sm font-medium text-slate-700">
                Mix design
              </label>
              <input
                id="mix_design"
                name="mix_design"
                type="text"
                placeholder="e.g. 4000 PSI, air-entrained"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Optional details — purpose, PO number, etc."
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
