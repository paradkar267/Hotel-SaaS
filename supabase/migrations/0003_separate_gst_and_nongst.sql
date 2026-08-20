-- Migration: 0003_separate_gst_and_nongst.sql
-- Description: Complete separation of GST Tax Invoices and Non-GST Hospitality Bills

-- 1. Create GST Invoices Table
CREATE TABLE IF NOT EXISTS gst_invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  invoice_number TEXT NOT NULL UNIQUE,          -- Format: INV-GST-YYYY-XXXX
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  hotel_gstin TEXT NOT NULL DEFAULT '',
  hotel_state_code TEXT NOT NULL DEFAULT '27',
  company_name TEXT NOT NULL DEFAULT '',
  guest_gstin TEXT NOT NULL DEFAULT '',
  place_of_supply TEXT NOT NULL DEFAULT '',
  hsn_sac_code TEXT NOT NULL DEFAULT '996311',   -- Hotel Accommodation Services
  gst_rate_bps INTEGER NOT NULL DEFAULT 1200,    -- Basis points: 0, 500, 1200, 1800
  taxable_amount_paise BIGINT NOT NULL DEFAULT 0,
  cgst_paise BIGINT NOT NULL DEFAULT 0,
  sgst_paise BIGINT NOT NULL DEFAULT 0,
  igst_paise BIGINT NOT NULL DEFAULT 0,
  total_paise BIGINT NOT NULL DEFAULT 0,
  balance_paise BIGINT NOT NULL DEFAULT 0,
  is_rcm_applicable BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'UNPAID',         -- UNPAID | PARTIAL | PAID | VOID
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gst_invoices_tenant_prop ON gst_invoices(tenant_id, property_id, status);
CREATE INDEX IF NOT EXISTS idx_gst_invoices_booking ON gst_invoices(booking_id);

-- 2. Create GST Invoice Items Table
CREATE TABLE IF NOT EXISTS gst_invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES gst_invoices(id) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  hsn_sac_code TEXT NOT NULL DEFAULT '996311',
  nights_or_qty INTEGER NOT NULL DEFAULT 1,
  unit_rate_paise BIGINT NOT NULL,
  taxable_amount_paise BIGINT NOT NULL,
  gst_rate_bps INTEGER NOT NULL DEFAULT 1200,
  tax_amount_paise BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gst_invoice_items_invoice ON gst_invoice_items(invoice_id);

-- 3. Create GST Payments Table
CREATE TABLE IF NOT EXISTS gst_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  invoice_id TEXT NOT NULL REFERENCES gst_invoices(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL,
  method TEXT NOT NULL,                          -- CASH | CARD_TERMINAL | UPI_MANUAL | BANK_TRANSFER
  reference_no TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  received_by TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gst_payments_invoice ON gst_payments(invoice_id);

-- 4. Create Non-GST Bills Table
CREATE TABLE IF NOT EXISTS non_gst_bills (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  bill_number TEXT NOT NULL UNIQUE,             -- Format: BILL-NON-YYYY-XXXX
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL DEFAULT '',
  room_number TEXT NOT NULL DEFAULT '',
  check_in_at TIMESTAMPTZ NOT NULL,
  check_out_at TIMESTAMPTZ NOT NULL,
  room_charges_paise BIGINT NOT NULL DEFAULT 0,
  amenities_charges_paise BIGINT NOT NULL DEFAULT 0,
  discount_paise BIGINT NOT NULL DEFAULT 0,
  total_paise BIGINT NOT NULL DEFAULT 0,
  balance_paise BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'UNPAID',         -- UNPAID | PARTIAL | PAID | VOID
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_non_gst_bills_tenant_prop ON non_gst_bills(tenant_id, property_id, status);
CREATE INDEX IF NOT EXISTS idx_non_gst_bills_booking ON non_gst_bills(booking_id);

-- 5. Create Non-GST Bill Items Table
CREATE TABLE IF NOT EXISTS non_gst_bill_items (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL REFERENCES non_gst_bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  rate_paise BIGINT NOT NULL,
  total_paise BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_non_gst_bill_items_bill ON non_gst_bill_items(bill_id);

-- 6. Create Non-GST Payments Table
CREATE TABLE IF NOT EXISTS non_gst_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  bill_id TEXT NOT NULL REFERENCES non_gst_bills(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL,
  method TEXT NOT NULL,                          -- CASH | CARD_TERMINAL | UPI_MANUAL | BANK_TRANSFER
  reference_no TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  received_by TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_non_gst_payments_bill ON non_gst_payments(bill_id);
