import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Define a type for the Supabase env binding if running in a Worker
type SupabaseEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

function getEnv(): SupabaseEnv {
  // If running in Cloudflare worker, access bindings from global env
  const env = (globalThis as any).__HOTELOS_ENV__ || process.env;
  return {
    SUPABASE_URL: env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  };
}

export async function createClient() {
  const env = getEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
