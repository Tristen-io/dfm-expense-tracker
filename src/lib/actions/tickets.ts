"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TICKET_PRIORITIES, type TicketPriority, type TicketStatus } from "@/lib/types";

export interface TicketFormState {
  error: string | null;
  success?: boolean;
}

// Anyone signed in can file a ticket against any asset — reporting a
// problem shouldn't require fleet-staff access. 911-priority tickets fan
// out to every admin and mechanic via the notify_new_ticket() trigger in
// schema.sql; the app never contacts emergency services itself (see the
// disclaimer on the form) — this just gets the right people looking at it
// fast.
export async function createServiceTicket(
  _prevState: TicketFormState,
  formData: FormData
): Promise<TicketFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to report an issue." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const asset_id = String(formData.get("asset_id") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const priority = String(formData.get("priority") || "medium") as TicketPriority;

  if (!asset_id) return { error: "Choose an asset." };
  if (!title) return { error: "Enter a short title." };
  if (!description) return { error: "Describe the issue." };
  if (!TICKET_PRIORITIES.includes(priority)) return { error: "Choose a valid priority." };

  const { data: asset } = await supabase
    .from("assets")
    .select("asset_number, name")
    .eq("id", asset_id)
    .single();
  if (!asset) return { error: "That asset couldn't be found." };

  const { data, error } = await supabase
    .from("service_tickets")
    .insert({
      asset_id,
      asset_number: asset.asset_number,
      asset_name: asset.name,
      title,
      description,
      priority,
      reported_by_id: user.id,
      reported_by_name: profile?.full_name ?? user.email ?? "Unknown",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/fleet/tickets");
  revalidatePath("/fleet");
  revalidatePath(`/fleet/assets/${asset_id}`);
  revalidatePath("/my-tickets");

  // Fleet staff land on the ticket's full detail page (/fleet/tickets/*),
  // same as always. Employees can't reach that page (it's inside the
  // fleet-staff-only /fleet/* section) — send them to their own read-only
  // tickets list instead.
  const isFleetStaff = profile?.role === "admin" || profile?.role === "mechanic";
  redirect(isFleetStaff ? `/fleet/tickets/${data.id}` : "/my-tickets");
}

// Fleet-staff only (admin or mechanic — RLS also allows the reporter to
// edit their own ticket while still "open", but changing status
// specifically is kept fleet-staff-only here — same "role check for a
// clean error, RLS as the real gate" pattern as
// updateExpenseStatus/updateTimeOffStatus).
export async function updateTicketStatus(id: string, status: TicketStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "mechanic") {
    throw new Error("Only an admin or mechanic can change a ticket's status.");
  }

  const { data: ticket, error } = await supabase
    .from("service_tickets")
    .update({ status })
    .eq("id", id)
    .select("asset_id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/fleet/tickets");
  revalidatePath(`/fleet/tickets/${id}`);
  revalidatePath("/fleet");
  if (ticket) revalidatePath(`/fleet/assets/${ticket.asset_id}`);
}

// Any signed-in user — see acknowledge_ticket() in schema.sql for why this
// isn't admin-only (whoever notices a 911 ticket first should be able to
// flag it as seen, not wait for an admin).
export async function acknowledgeTicket(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.rpc("acknowledge_ticket", { ticket_id: id });
  if (error) throw new Error(error.message);

  revalidatePath("/fleet/tickets");
  revalidatePath(`/fleet/tickets/${id}`);
  revalidatePath("/fleet");
}

// Fleet-staff only — ticket comments are for admins/mechanics coordinating
// on a repair, not general employee visibility (RLS enforces the same
// restriction; see ticket_comments_insert_fleet_staff in schema.sql).
export async function addTicketComment(ticketId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment can't be empty.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "mechanic") {
    throw new Error("Only an admin or mechanic can comment on a ticket.");
  }

  const { error } = await supabase.from("ticket_comments").insert({
    ticket_id: ticketId,
    user_id: user.id,
    author_name: profile?.full_name ?? user.email ?? "Unknown",
    body: trimmed,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/fleet/tickets/${ticketId}`);
}

// Allowed for the reporter while still "open", or an admin at any time —
// same rule as expenses/time off.
export async function deleteServiceTicket(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("service_tickets").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/fleet/tickets");
  revalidatePath("/fleet");
}
