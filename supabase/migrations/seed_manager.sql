DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- 1. Try to find if the user already exists in Supabase Auth
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'paradkaryash0@gmail.com';
  
  -- 2. If the user does not exist, create them
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', 'paradkaryash0@gmail.com',
        crypt('123456', gen_salt('bf')), current_timestamp, current_timestamp, current_timestamp,
        '{"provider":"email","providers":["email"]}', '{}', current_timestamp, current_timestamp, '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_user_id, v_user_id,
        format('{"sub":"%s","email":"%s"}', v_user_id, 'paradkaryash0@gmail.com')::jsonb,
        'email', current_timestamp, current_timestamp, current_timestamp
    );
  ELSE
    -- 3. If they DO exist, forcefully update password to 123456 and auto-confirm their email
    UPDATE auth.users 
    SET encrypted_password = crypt('123456', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, current_timestamp)
    WHERE id = v_user_id;
  END IF;

  -- 4. Insert or update the public.users record linked to the auth user
  INSERT INTO public.users (
      id, tenant_id, property_id, email, password_hash, name, role, is_active, last_seen_at, created_by, created_at, updated_at
  )
  VALUES (
    v_user_id,
    'tnt_admin123',
    'prp_admin123',
    'paradkaryash0@gmail.com',
    NULL,
    'Yash (Manager)',
    'MANAGER',
    true,
    current_timestamp,
    'system',
    current_timestamp,
    current_timestamp
  ) ON CONFLICT (id) DO UPDATE SET 
    role = 'MANAGER',
    is_active = true,
    tenant_id = 'tnt_admin123',
    property_id = 'prp_admin123';

END $$;
