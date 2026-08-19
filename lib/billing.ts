import type { BillingType } from "./types";

const ALLOWED_GST_RATES = new Set([0, 500, 1200, 1800]);

export const HOTEL_ACCOMMODATION_SAC = "996311";

/**
 * Real-world Indian Hotel GST Slabs:
 * - Room Tariff up to ₹7,500 per night: 12% GST (1200 bps)
 * - Room Tariff above ₹7,500 per night: 18% GST (1800 bps)
 */
export function getAutoGstRateBps(nightlyRatePaise: number): number {
  const rateInr = nightlyRatePaise / 100;
  if (rateInr <= 0) return 0;
  if (rateInr <= 7500) return 1200; // 12% GST
  return 1800; // 18% GST
}

export function toPaise(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be a valid positive number.");
  }
  return Math.round(amount * 100);
}

export function calculateInvoice(input: {
  billingType: BillingType;
  roomRatePaise: number;
  nights: number;
  extrasPaise: number;
  gstRateBps: number;
  propertyState: string;
  guestState: string;
}) {
  const nights = Math.max(1, Math.min(365, Math.trunc(input.nights)));
  const roomAmountPaise = input.roomRatePaise * nights;
  const subtotalPaise = roomAmountPaise + input.extrasPaise;

  if (input.billingType === "NON_GST") {
    return {
      nights,
      roomAmountPaise,
      subtotalPaise,
      gstRateBps: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      totalPaise: subtotalPaise,
    };
  }

  const gstRateBps = ALLOWED_GST_RATES.has(input.gstRateBps)
    ? input.gstRateBps
    : 1200;
  const taxPaise = Math.round((subtotalPaise * gstRateBps) / 10_000);
  const intraState = normalizeState(input.propertyState) === normalizeState(input.guestState);
  const cgstPaise = intraState ? Math.floor(taxPaise / 2) : 0;
  const sgstPaise = intraState ? taxPaise - cgstPaise : 0;
  const igstPaise = intraState ? 0 : taxPaise;

  return {
    nights,
    roomAmountPaise,
    subtotalPaise,
    gstRateBps,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise: subtotalPaise + taxPaise,
  };
}

function normalizeState(value: string) {
  return value.trim().toLocaleLowerCase("en-IN");
}
