// lib/server/services/billing-service.ts
// Core Integer Paise Arithmetic & Tax Engines

import type {
  GstInvoiceCalculationInput,
  GstInvoiceCalculationResult,
  NonGstBillCalculationInput,
  NonGstBillCalculationResult,
} from "../types";

const ALLOWED_GST_RATES = new Set([0, 500, 1200, 1800]);

/**
 * Converts standard currency units to integer paise (1 INR = 100 paise).
 * Eliminates floating-point calculation drift.
 */
export function toPaise(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be a valid positive number.");
  }
  return Math.round(amount * 100);
}

/**
 * Normalizes state name string for Place of Supply matching
 */
export function normalizeState(value: string): string {
  return (value || "").trim().toLocaleLowerCase("en-IN");
}

/**
 * Calculates GST Tax Invoice with Intra-State (CGST + SGST) vs Inter-State (IGST) split
 */
export function calculateGstInvoice(
  input: GstInvoiceCalculationInput
): GstInvoiceCalculationResult {
  const nights = Math.max(1, Math.min(365, Math.trunc(input.nights)));
  const roomAmountPaise = input.roomRatePaise * nights;
  const subtotalPaise = roomAmountPaise + Math.max(0, input.extrasPaise);

  const gstRateBps = ALLOWED_GST_RATES.has(input.gstRateBps)
    ? input.gstRateBps
    : 1200;

  // Tax calculation in integer paise
  const taxPaise = Math.round((subtotalPaise * gstRateBps) / 10_000);
  const intraState =
    normalizeState(input.propertyState) === normalizeState(input.guestState);

  // Equal 50/50 split for Intra-State CGST and SGST with zero remainder loss
  const cgstPaise = intraState ? Math.floor(taxPaise / 2) : 0;
  const sgstPaise = intraState ? taxPaise - cgstPaise : 0;
  const igstPaise = intraState ? 0 : taxPaise;

  return {
    nights,
    roomAmountPaise,
    subtotalPaise,
    gstRateBps,
    taxPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise: subtotalPaise + taxPaise,
    intraState,
  };
}

/**
 * Calculates Non-GST Hospitality Bill / Folio (Zero Tax Fields)
 */
export function calculateNonGstBill(
  input: NonGstBillCalculationInput
): NonGstBillCalculationResult {
  const nights = Math.max(1, Math.min(365, Math.trunc(input.nights)));
  const roomAmountPaise = input.roomRatePaise * nights;
  const extrasPaise = Math.max(0, input.extrasPaise);
  const discountPaise = Math.max(0, input.discountPaise || 0);

  const subtotalPaise = roomAmountPaise + extrasPaise;
  const totalPaise = Math.max(0, subtotalPaise - discountPaise);

  return {
    nights,
    roomAmountPaise,
    extrasPaise,
    discountPaise,
    subtotalPaise,
    totalPaise,
  };
}
