import { NextResponse } from 'next/server';
import { extractHandSessionId, handIdToAssetPath } from '@/lib/poker/winamaxReplayerLink';
import { convertWinamaxSession } from '@/lib/poker/winamaxJson';
import { analyzeHandPreflop } from '@/lib/poker/solver/compareToSolve';

const ASSET_BASE = 'https://poker-assets.winamax.fr/replayer/hand/';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const heroLogin = (body?.heroLogin || '').trim();
  if (!heroLogin) {
    return NextResponse.json({ error: 'Pseudo Winamax manquant' }, { status: 400 });
  }

  const id = extractHandSessionId(body?.link);
  if (!id) {
    return NextResponse.json({ error: 'Lien replayer Winamax non reconnu (ID introuvable)' }, { status: 400 });
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

  const spots = convertWinamaxSession(hands, heroLogin);
  const heroPlayed = spots.some(s => s.seatsBase.some(seat => seat.name === heroLogin));
  if (!heroPlayed) {
    return NextResponse.json({ error: `Aucun siège trouvé pour "${heroLogin}" dans cette session — vérifie le pseudo` }, { status: 404 });
  }

  const hands_analyzed = [];
  let counts = { aligné: 0, leak_mineur: 0, leak_majeur: 0, non_couvert: 0 };

  for (const spot of spots) {
    let result;
    try {
      result = analyzeHandPreflop(spot, heroLogin, {});
    } catch (e) {
      hands_analyzed.push({ handId: spot.handId, ligne: spot.ligne, error: e.message, decisions: [] });
      continue;
    }
    if (!result.decisions.length) continue;
    result.decisions.forEach(d => { counts[d.verdict] = (counts[d.verdict] || 0) + 1; });
    hands_analyzed.push({ handId: spot.handId, ligne: spot.ligne, board: spot.board, decisions: result.decisions });
  }

  return NextResponse.json({
    handSessionId: id,
    heroLogin,
    totalHands: spots.length,
    analyzedHands: hands_analyzed.length,
    counts,
    hands: hands_analyzed,
  });
}
