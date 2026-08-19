-- Disable RLS on all tables since authorization is handled in the Next.js API routes
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

-- Re-run the insertion to ensure the admin user exists in the public schema
INSERT INTO public.tenants (id, name, created_at)
VALUES ('tnt_admin123', 'Bizleap Admin', current_timestamp)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.properties (id, tenant_id, name, address, city, state, postal_code, gstin, currency, default_gst_bps, created_at, updated_at)
VALUES ('prp_admin123', 'tnt_admin123', 'Bizleap Hotel', '123 Admin St', 'Mumbai', 'Maharashtra', '400001', '27ABCDE1234F1Z5', 'INR', 1200, current_timestamp, current_timestamp)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, tenant_id, property_id, email, password_hash, name, role, is_active, last_seen_at, created_by, created_at, updated_at)
VALUES (
  'd76ec1df-8588-4f81-a957-c81bc6bda3df',
  'tnt_admin123',
  'prp_admin123',
  'bizleap1@gmail.com',
  NULL,
  'Admin',
  'ADMIN',
  true,
  current_timestamp,
  'system',
  current_timestamp,
  current_timestamp
) ON CONFLICT (id) DO NOTHING;
