import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// A new client must be created for every request (Server Component, Server
// Action, Route Handler) because it reads/writes cookies tied to that request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
            // Called from a Server Component — a Proxy refreshing the
            // session handles cookie writes in that case, so this is safe to ignore.
          }
        },
      },
    }
  );
}
