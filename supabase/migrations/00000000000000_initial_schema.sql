CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE properties (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'Maharashtra',
  postal_code TEXT NOT NULL DEFAULT '',
  gstin TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'INR',
  default_gst_bps INTEGER NOT NULL DEFAULT 1200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX properties_tenant_idx ON properties(tenant_id);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_tenant_idx ON users(tenant_id);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  room_number TEXT NOT NULL,
  floor TEXT NOT NULL,
  room_type TEXT NOT NULL,
  base_rate_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, room_number)
);

CREATE INDEX rooms_tenant_status_idx ON rooms(tenant_id, status);

CREATE TABLE guests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'India',
  postal_code TEXT NOT NULL DEFAULT '',
  nationality TEXT NOT NULL DEFAULT 'Indian',
  id_type TEXT NOT NULL DEFAULT '',
  id_last4 TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX guests_tenant_name_idx ON guests(tenant_id, full_name);
CREATE INDEX guests_tenant_phone_idx ON guests(tenant_id, phone);

CREATE TABLE guest_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  guest_id TEXT NOT NULL REFERENCES guests(id),
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX guest_documents_guest_idx ON guest_documents(guest_id);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  booking_number TEXT NOT NULL UNIQUE,
  guest_id TEXT NOT NULL REFERENCES guests(id),
  room_id TEXT NOT NULL REFERENCES rooms(id),
  check_in_at TIMESTAMPTZ NOT NULL,
  expected_check_out_at TIMESTAMPTZ NOT NULL,
  actual_check_out_at TIMESTAMPTZ,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'WALK_IN',
  status TEXT NOT NULL DEFAULT 'CHECKED_IN',
  billing_type TEXT NOT NULL DEFAULT 'NON_GST',
  company_name TEXT NOT NULL DEFAULT '',
  guest_gstin TEXT NOT NULL DEFAULT '',
  guest_state TEXT NOT NULL DEFAULT '',
  nightly_rate_paise INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  locked_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX bookings_tenant_status_idx ON bookings(tenant_id, status);
CREATE INDEX bookings_room_status_idx ON bookings(room_id, status);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  invoice_number TEXT NOT NULL UNIQUE,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  billing_type TEXT NOT NULL,
  gst_rate_bps INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'UNPAID',
  subtotal_paise INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0,
  sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  balance_paise INTEGER NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX invoices_tenant_status_idx ON invoices(tenant_id, status);

CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  rate_paise INTEGER NOT NULL,
  amount_paise INTEGER NOT NULL
);

CREATE INDEX invoice_items_invoice_idx ON invoice_items(invoice_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount_paise INTEGER NOT NULL,
  method TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  received_by TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX payments_invoice_idx ON payments(invoice_id);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  old_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_tenant_id_idx ON audit_logs(tenant_id, id);
CREATE INDEX audit_logs_record_idx ON audit_logs(module, record_id);
