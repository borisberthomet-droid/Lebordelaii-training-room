import { NextResponse } from 'next/server';

// Extrait la structure d'un tournoi Winamax (stack de départ, split du buy-in, grille de
// payout par rang...) depuis un ou plusieurs screenshots du client (panneaux INFO + PAYOUT).
// Alimente le calcul RP exact (ICM + bounty) sans passer par un export HRC — voir la
// conversation où cette approche a été choisie après avoir capturé 5 tournois réels.
const EXTRACTION_TOOL = {
  name: 'extract_tournament_info',
  description: "Extrait les informations structurées visibles sur un ou plusieurs screenshots du client Winamax (panneau INFO et/ou panneau PAYOUT d'un tournoi).",
  input_schema: {
    type: 'object',
    properties: {
      tournamentName: { type: 'string', description: 'Nom du tournoi tel qu\'affiché' },
      startingStackChips: { type: 'number', description: 'Starting stack en jetons' },
      buyInStaking: { type: 'number', description: 'Première partie du buy-in (prizepool), en euros' },
      buyInBounty: { type: 'number', description: 'Deuxième partie du buy-in (bounty/KO), en euros' },
      buyInRake: { type: 'number', description: 'Troisième partie du buy-in (rake), en euros' },
      tableSize: { type: 'number', description: 'Nombre de joueurs par table' },
      finalTableSize: { type: 'number', description: 'Nombre de joueurs à la table finale' },
      payoutPlacesText: { type: 'string', description: 'Texte "Pay-out" tel quel, ex: "Top 50 paid"' },
      knockoutType: { type: 'string', description: 'Type de knockout affiché, ex: "Random bounties"' },
      playersRegistered: { type: 'number', description: 'Nombre de joueurs actuellement inscrits/en jeu' },
      playersMax: { type: 'number', description: 'Nombre max de joueurs (ou total du field si visible)' },
      currentLevel: { type: 'string', description: 'Niveau de blindes actuel affiché, ex: "500-1k +120"' },
      estimatedPrizepool: { type: 'number', description: 'Prizepool estimé annoncé, en euros' },
      currentPrizepool: { type: 'number', description: 'Prizepool actuel affiché (le gros chiffre en euros), en euros' },
      payoutTable: {
        type: 'array',
        description: "Chaque ligne de l'onglet PAYOUT, dans l'ordre affiché",
        items: {
          type: 'object',
          properties: {
            rankFrom: { type: 'number', description: 'Place de départ de la ligne (ex: 8 pour "8th to 9th")' },
            rankTo: { type: 'number', description: 'Place de fin (ex: 9 pour "8th to 9th", = rankFrom si place unique)' },
            prizeEuro: { type: 'number', description: 'Montant en euros si présent (null si uniquement un ticket)' },
            prizeLabel: { type: 'string', description: "Texte brut du gain, ex: '1,273.12€' ou 'Ticket 3 Million Event'" },
          },
          required: ['rankFrom', 'rankTo', 'prizeLabel'],
        },
      },
    },
    required: ['startingStackChips', 'payoutTable'],
  },
};

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY n'est pas configurée sur le serveur" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const images = body?.images; // [{ mediaType, base64 }]
  if (!Array.isArray(images) || !images.length) {
    return NextResponse.json({ error: 'Aucune image fournie' }, { status: 400 });
  }

  const content = [
    ...images.map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
    })),
    {
      type: 'text',
      text: "Voici un ou plusieurs screenshots du client Winamax (panneaux INFO et/ou PAYOUT d'un tournoi de poker). Extrais toutes les informations disponibles avec l'outil fourni. Si une image ne montre pas certains champs, laisse-les absents plutôt que de deviner.",
    },
  ];

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: 'extract_tournament_info' },
        messages: [{ role: 'user', content }],
      }),
    });
  } catch {
    return NextResponse.json({ error: "Impossible de joindre l'API Anthropic" }, { status: 502 });
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return NextResponse.json({ error: `Anthropic a répondu ${res.status}: ${errText.slice(0, 300)}` }, { status: 502 });
  }

  const data = await res.json();
  const toolUse = data?.content?.find((b) => b.type === 'tool_use');
  if (!toolUse) {
    return NextResponse.json({ error: "Réponse inattendue de l'extraction (pas d'appel d'outil)" }, { status: 502 });
  }

  return NextResponse.json({ extracted: toolUse.input });
}
