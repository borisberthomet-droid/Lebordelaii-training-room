import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Keeps the Supabase auth session cookie fresh on every request.
// Called from src/proxy.js (Next.js 16 renamed middleware.js to proxy.js).
export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove — this refreshes the session and must run before any
  // other logic that reads the user, or sessions will silently expire.
  await supabase.auth.getUser();

  return response;
}
