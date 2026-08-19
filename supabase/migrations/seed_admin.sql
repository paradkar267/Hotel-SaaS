-- Create the auth.users record for the Admin
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'd76ec1df-8588-4f81-a957-c81bc6bda3df',
    'authenticated',
    'authenticated',
    'bizleap1@gmail.com',
    crypt('bizleap@123', gen_salt('bf')),
    current_timestamp,
    current_timestamp,
    current_timestamp,
    '{"provider":"email","providers":["email"]}',
    '{}',
    current_timestamp,
    current_timestamp,
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Create the auth.identities record
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'd76ec1df-8588-4f81-a957-c81bc6bda3df',
    'd76ec1df-8588-4f81-a957-c81bc6bda3df',
    format('{"sub":"%s","email":"%s"}', 'd76ec1df-8588-4f81-a957-c81bc6bda3df', 'bizleap1@gmail.com')::jsonb,
    'email',
    current_timestamp,
    current_timestamp,
    current_timestamp
) ON CONFLICT DO NOTHING;

-- Insert Tenant
INSERT INTO public.tenants (id, name, created_at)
VALUES ('tnt_admin123', 'Bizleap Admin', current_timestamp)
ON CONFLICT (id) DO NOTHING;

-- Insert Property
INSERT INTO public.properties (id, tenant_id, name, address, city, state, postal_code, gstin, currency, default_gst_bps, created_at, updated_at)
VALUES ('prp_admin123', 'tnt_admin123', 'Bizleap Hotel', '123 Admin St', 'Mumbai', 'Maharashtra', '400001', '27ABCDE1234F1Z5', 'INR', 1200, current_timestamp, current_timestamp)
ON CONFLICT (id) DO NOTHING;

-- Insert the public.users record linked to the auth user
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
