// lib/server/repositories/non-gst-bill-repository.ts
// Data Access & Persistence for Non-GST Hospitality Bills / Folios

import { createClient } from "../../supabase";
import type { Session, PaymentMethod } from "../types";

export function generateNonGstBillId(): string {
  return `bill_non_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function generateNonGstPaymentId(): string {
  return `pay_non_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export async function getNextNonGstBillNumber(
  session: Session
): Promise<string> {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const nextYearShort = String(currentYear + 1).slice(2);
  const fyPrefix = `${currentYear}${nextYearShort}`;

  const { count } = await supabase
    .from("non_gst_bills")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", session.tenantId)
    .eq("property_id", session.propertyId);

  const nextSeq = (count || 0) + 1;
  return `BILL-NON-${fyPrefix}-${String(nextSeq).padStart(4, "0")}`;
}

export async function createNonGstBill(
  session: Session,
  input: {
    bookingId: string;
    guestName: string;
    guestPhone: string;
    roomNumber: string;
    checkInAt: string;
    checkOutAt: string;
    roomChargesPaise: number;
    amenitiesChargesPaise: number;
    discountPaise: number;
    totalPaise: number;
    items: Array<{
      description: string;
      quantity: number;
      ratePaise: number;
      totalPaise: number;
    }>;
  }
) {
  const supabase = await createClient();
  const billId = generateNonGstBillId();
  const billNumber = await getNextNonGstBillNumber(session);
  const now = new Date().toISOString();

  // 1. Insert main Non-GST bill
  const { data: bill, error: billError } = await supabase
    .from("non_gst_bills")
    .insert({
      id: billId,
      tenant_id: session.tenantId,
      property_id: session.propertyId,
      bill_number: billNumber,
      booking_id: input.bookingId,
      guest_name: input.guestName,
      guest_phone: input.guestPhone,
      room_number: input.roomNumber,
      check_in_at: input.checkInAt,
      check_out_at: input.checkOutAt,
      room_charges_paise: input.roomChargesPaise,
      amenities_charges_paise: input.amenitiesChargesPaise,
      discount_paise: input.discountPaise,
      total_paise: input.totalPaise,
      balance_paise: input.totalPaise,
      status: "UNPAID",
      issued_at: now,
      created_by: session.userId,
      updated_at: now,
    })
    .select()
    .single();

  if (billError) throw new Error(`Non-GST Bill creation failed: ${billError.message}`);

  // 2. Insert itemized folio rows
  if (input.items.length > 0) {
    const itemRows = input.items.map((item) => ({
      id: `item_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
      bill_id: billId,
      description: item.description,
      quantity: item.quantity,
      rate_paise: item.ratePaise,
      total_paise: item.totalPaise,
    }));

    const { error: itemsError } = await supabase
      .from("non_gst_bill_items")
      .insert(itemRows);

    if (itemsError) throw new Error(`Non-GST items creation failed: ${itemsError.message}`);
  }

  return bill;
}

export async function recordNonGstPayment(
  session: Session,
  input: {
    billId: string;
    amountPaise: number;
    method: PaymentMethod;
    referenceNo?: string;
    note?: string;
  }
) {
  const supabase = await createClient();

  // 1. Fetch current bill balance
  const { data: bill, error: fetchErr } = await supabase
    .from("non_gst_bills")
    .select("*")
    .eq("id", input.billId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (fetchErr || !bill) throw new Error("Non-GST Bill not found.");
  if (bill.status === "VOID") throw new Error("Cannot pay a voided bill.");

  const currentBalance = Number(bill.balance_paise);
  if (input.amountPaise > currentBalance) {
    throw new Error(`Payment exceeds balance of ₹${(currentBalance / 100).toFixed(2)}.`);
  }

  const newBalance = currentBalance - input.amountPaise;
  const newStatus = newBalance === 0 ? "PAID" : "PARTIAL";
  const now = new Date().toISOString();

  // 2. Insert payment record
  const paymentId = generateNonGstPaymentId();
  const { error: payErr } = await supabase.from("non_gst_payments").insert({
    id: paymentId,
    tenant_id: session.tenantId,
    bill_id: input.billId,
    amount_paise: input.amountPaise,
    method: input.method,
    reference_no: input.referenceNo || "",
    note: input.note || "",
    received_by: session.userId,
    received_at: now,
  });

  if (payErr) throw new Error(`Non-GST Payment insertion failed: ${payErr.message}`);

  // 3. Update bill balance and status
  const { error: updateErr } = await supabase
    .from("non_gst_bills")
    .update({
      balance_paise: newBalance,
      status: newStatus,
      updated_at: now,
    })
    .eq("id", input.billId);

  if (updateErr) throw new Error(`Bill update failed: ${updateErr.message}`);

  return { paymentId, newBalance, newStatus };
}

export async function voidNonGstBill(
  session: Session,
  billId: string,
  reason: string
) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("non_gst_bills")
    .update({
      status: "VOID",
      updated_at: now,
    })
    .eq("id", billId)
    .eq("tenant_id", session.tenantId);

  if (error) throw new Error(`Failed to void Non-GST bill: ${error.message}`);
  return { billId, status: "VOID" };
}
