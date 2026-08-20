// lib/server/repositories/gst-invoice-repository.ts
// Data Access & Persistence for GST Tax Invoices

import { createClient } from "../../supabase";
import type { Session, PaymentMethod } from "../types";

export function generateGstInvoiceId(): string {
  return `inv_gst_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function generateGstPaymentId(): string {
  return `pay_gst_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export async function getNextGstInvoiceNumber(
  session: Session
): Promise<string> {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const nextYearShort = String(currentYear + 1).slice(2);
  const fyPrefix = `${currentYear}${nextYearShort}`;

  const { count } = await supabase
    .from("gst_invoices")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", session.tenantId)
    .eq("property_id", session.propertyId);

  const nextSeq = (count || 0) + 1;
  return `INV-GST-${fyPrefix}-${String(nextSeq).padStart(4, "0")}`;
}

export async function createGstInvoice(
  session: Session,
  input: {
    bookingId: string;
    hotelGstin: string;
    hotelStateCode: string;
    companyName: string;
    guestGstin: string;
    placeOfSupply: string;
    hsnSacCode: string;
    gstRateBps: number;
    taxableAmountPaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
    items: Array<{
      itemDescription: string;
      hsnSacCode: string;
      nightsOrQty: number;
      unitRatePaise: number;
      taxableAmountPaise: number;
      gstRateBps: number;
      taxAmountPaise: number;
    }>;
  }
) {
  const supabase = await createClient();
  const invoiceId = generateGstInvoiceId();
  const invoiceNumber = await getNextGstInvoiceNumber(session);
  const now = new Date().toISOString();

  // 1. Insert main GST invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("gst_invoices")
    .insert({
      id: invoiceId,
      tenant_id: session.tenantId,
      property_id: session.propertyId,
      invoice_number: invoiceNumber,
      booking_id: input.bookingId,
      hotel_gstin: input.hotelGstin,
      hotel_state_code: input.hotelStateCode,
      company_name: input.companyName,
      guest_gstin: input.guestGstin,
      place_of_supply: input.placeOfSupply,
      hsn_sac_code: input.hsnSacCode,
      gst_rate_bps: input.gstRateBps,
      taxable_amount_paise: input.taxableAmountPaise,
      cgst_paise: input.cgstPaise,
      sgst_paise: input.sgstPaise,
      igst_paise: input.igstPaise,
      total_paise: input.totalPaise,
      balance_paise: input.totalPaise,
      status: "UNPAID",
      issued_at: now,
      created_by: session.userId,
      updated_at: now,
    })
    .select()
    .single();

  if (invoiceError) throw new Error(`GST Invoice creation failed: ${invoiceError.message}`);

  // 2. Insert itemized tax rows
  if (input.items.length > 0) {
    const itemRows = input.items.map((item) => ({
      id: `item_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
      invoice_id: invoiceId,
      item_description: item.itemDescription,
      hsn_sac_code: item.hsnSacCode,
      nights_or_qty: item.nightsOrQty,
      unit_rate_paise: item.unitRatePaise,
      taxable_amount_paise: item.taxableAmountPaise,
      gst_rate_bps: item.gstRateBps,
      tax_amount_paise: item.taxAmountPaise,
    }));

    const { error: itemsError } = await supabase
      .from("gst_invoice_items")
      .insert(itemRows);

    if (itemsError) throw new Error(`GST items creation failed: ${itemsError.message}`);
  }

  return invoice;
}

export async function recordGstPayment(
  session: Session,
  input: {
    invoiceId: string;
    amountPaise: number;
    method: PaymentMethod;
    referenceNo?: string;
    note?: string;
  }
) {
  const supabase = await createClient();

  // 1. Fetch current invoice balance
  const { data: invoice, error: fetchErr } = await supabase
    .from("gst_invoices")
    .select("*")
    .eq("id", input.invoiceId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (fetchErr || !invoice) throw new Error("GST Invoice not found.");
  if (invoice.status === "VOID") throw new Error("Cannot pay a voided GST invoice.");

  const currentBalance = Number(invoice.balance_paise);
  if (input.amountPaise > currentBalance) {
    throw new Error(`Payment exceeds balance of ₹${(currentBalance / 100).toFixed(2)}.`);
  }

  const newBalance = currentBalance - input.amountPaise;
  const newStatus = newBalance === 0 ? "PAID" : "PARTIAL";
  const now = new Date().toISOString();

  // 2. Insert payment record
  const paymentId = generateGstPaymentId();
  const { error: payErr } = await supabase.from("gst_payments").insert({
    id: paymentId,
    tenant_id: session.tenantId,
    invoice_id: input.invoiceId,
    amount_paise: input.amountPaise,
    method: input.method,
    reference_no: input.referenceNo || "",
    note: input.note || "",
    received_by: session.userId,
    received_at: now,
  });

  if (payErr) throw new Error(`GST Payment insertion failed: ${payErr.message}`);

  // 3. Update invoice balance and status
  const { error: updateErr } = await supabase
    .from("gst_invoices")
    .update({
      balance_paise: newBalance,
      status: newStatus,
      updated_at: now,
    })
    .eq("id", input.invoiceId);

  if (updateErr) throw new Error(`Invoice update failed: ${updateErr.message}`);

  return { paymentId, newBalance, newStatus };
}

export async function voidGstInvoice(
  session: Session,
  invoiceId: string,
  reason: string
) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("gst_invoices")
    .update({
      status: "VOID",
      updated_at: now,
    })
    .eq("id", invoiceId)
    .eq("tenant_id", session.tenantId);

  if (error) throw new Error(`Failed to void GST invoice: ${error.message}`);
  return { invoiceId, status: "VOID" };
}
