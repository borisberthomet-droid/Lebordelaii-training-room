import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Point d'atterrissage des liens email Supabase (reset password, confirmation
// d'inscription...). Avec @supabase/ssr le lien renvoie un `?code=` PKCE à échanger
// côté serveur (pas une session auto-détectée côté client) — c'est cet échange qui
// pose le cookie de session avant de rediriger vers la page finale (`next`).
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Lien invalide ou expiré`);
}
