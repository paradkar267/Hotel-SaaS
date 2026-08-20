// lib/server/types.ts
// Core domain types for HotelOS Backend

export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER";

export type RoomStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "HOUSEKEEPING"
  | "MAINTENANCE";

export type BillingType = "GST" | "NON_GST";

export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "VOID";

export type PaymentMethod =
  | "CASH"
  | "CARD_TERMINAL"
  | "UPI_MANUAL"
  | "BANK_TRANSFER";

export type IdType =
  | "AADHAAR"
  | "PASSPORT"
  | "DRIVING_LICENCE"
  | "VOTER_ID"
  | "OTHER";

export type Session = {
  userId: string;
  tenantId: string;
  propertyId: string;
  email: string;
  name: string;
  role: Role;
};

export type Identity = {
  email: string;
  displayName: string;
};

export interface GstInvoiceCalculationInput {
  roomRatePaise: number;
  nights: number;
  extrasPaise: number;
  extrasDescription?: string;
  gstRateBps: number;
  propertyState: string;
  guestState: string;
}

export interface GstInvoiceCalculationResult {
  nights: number;
  roomAmountPaise: number;
  subtotalPaise: number;
  gstRateBps: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  intraState: boolean;
}

export interface NonGstBillCalculationInput {
  roomRatePaise: number;
  nights: number;
  extrasPaise: number;
  extrasDescription?: string;
  discountPaise?: number;
}

export interface NonGstBillCalculationResult {
  nights: number;
  roomAmountPaise: number;
  extrasPaise: number;
  discountPaise: number;
  subtotalPaise: number;
  totalPaise: number;
}
