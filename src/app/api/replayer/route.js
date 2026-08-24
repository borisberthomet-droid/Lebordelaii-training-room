import { NextResponse } from 'next/server';
import { extractHandSessionId, handIdToAssetPath } from '@/lib/poker/winamaxReplayerLink';

const ASSET_BASE = 'https://poker-assets.winamax.fr/replayer/hand/';

// Récupère, côté serveur, la session complète de mains derrière un lien replayer Winamax.
// Le endpoint poker-assets.winamax.fr est public/non-authentifié (voir le plan pour le détail
// de la rétro-ingénierie) mais reste non documenté : on le fetch depuis le serveur pour ne pas
// exposer ce mécanisme côté client et éviter tout souci CORS.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const id = extractHandSessionId(body?.link);
  if (!id) {
    return NextResponse.json({ error: "Lien replayer Winamax non reconnu (ID introuvable)" }, { status: 400 });
  }

  const path = handIdToAssetPath(id);
  if (!path) {
    return NextResponse.json({ error: "Format d'ID de main invalide" }, { status: 400 });
  }

  let res;
  try {
    res = await fetch(ASSET_BASE + path);
  } catch {
    return NextResponse.json({ error: 'Impossible de joindre Winamax' }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Winamax a répondu ${res.status}` }, { status: 502 });
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: 'Réponse Winamax illisible' }, { status: 502 });
  }

  const hands = Object.keys(data)
    .filter(k => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))
    .map(k => data[k]);

  if (!hands.length) {
    return NextResponse.json({ error: 'Aucune main trouvée pour ce lien' }, { status: 404 });
  }

  return NextResponse.json({ handSessionId: id, hands });
}
