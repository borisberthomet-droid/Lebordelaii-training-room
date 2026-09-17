import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Tout le site est fermé derrière une clé d'activation. Règle par défaut : refuser. Seules les
// pages ci-dessous sont ouvertes — tout ce qui n'y figure pas (outils, /api, données des sims
// dans /solved) exige un compte ET un accès actif.
//
// L'accès est vérifié en base à chaque requête (has_access) : une clé révoquée coupe l'élève
// dès sa navigation suivante, sans attendre l'expiration de sa session.

// Ouvert à tous : se connecter, activer une clé, récupérer son mot de passe.
const OPEN = ['/login', '/signup', '/forgot-password', '/auth/confirm'];
// Session exigée, accès non : la page qui explique que l'accès n'est pas actif, et le
// changement de mot de passe après un lien de récupération.
const SESSION_ONLY = ['/acces', '/update-password'];

const inList = (pathname, list) => list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

// Les appels de données (API, fichiers .json des sims) reçoivent un code d'erreur plutôt
// qu'une redirection : une page qui attend du JSON planterait sur le HTML de /login.
const isData = (pathname) => pathname.startsWith('/api/') || /\.[a-z0-9]+$/i.test(pathname);

// Une redirection doit emporter les cookies de session rafraîchis, sinon l'élève serait
// déconnecté au prochain rechargement.
function withCookies(target, source) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export default async function proxy(request) {
  const { response, supabase, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (inList(pathname, OPEN)) return response;

  if (!user) {
    if (isData(pathname)) {
      return withCookies(NextResponse.json({ error: 'non connecté' }, { status: 401 }), response);
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${pathname}${search}`);
    return withCookies(NextResponse.redirect(url), response);
  }

  if (inList(pathname, SESSION_ONLY)) return response;

  // Échec de la requête = pas d'accès : on ferme plutôt que d'ouvrir par erreur.
  const { data: allowed, error } = await supabase.rpc('has_access');
  if (error || allowed !== true) {
    if (isData(pathname)) {
      return withCookies(NextResponse.json({ error: 'accès non actif' }, { status: 403 }), response);
    }
    const url = request.nextUrl.clone();
    url.pathname = '/acces';
    url.search = '';
    return withCookies(NextResponse.redirect(url), response);
  }

  return response;
}

// Exclus : tout /_next/ (code du site, rechargement à chaud — aucune donnée d'élève ni de sim)
// et les images publiques. Les fichiers .json de /solved, eux, passent bien par la vérification.
export const config = {
  matcher: ['/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
