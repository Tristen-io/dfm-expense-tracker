import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { filteredExpensesQuery, parseFilters } from "@/lib/queries";

// GET /admin/export?[same filters as /admin/entries]
// Streams a CSV of APPROVED entries matching the given filters, for
// accounting/payroll. proxy.ts already restricts /admin/* to admins; we
// double-check here since Route Handlers should verify auth independently.
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = { ...parseFilters(searchParams), status: "approved" };

  const supabase = await createClient();
  const { data: expenses, error } = await filteredExpensesQuery(supabase, filters);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (expenses ?? []).map((e) => ({
    Date: e.expense_date,
    Employee: e.employee_name,
    "Job/Project": e.job_name,
    Category: e.category,
    Amount: e.amount.toFixed(2),
    Notes: e.notes ?? "",
    Status: e.status,
    "Has Receipt": e.receipt_path ? "Yes" : "No",
    "Submitted At": e.created_at,
  }));

  const csv = Papa.unparse(rows);
  const filename = `dfm-expenses-approved-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
