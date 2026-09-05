// Lecture d'un nœud postflop HRC (fichier .json exporté depuis l'arbre).
//
// ATTENTION à ce que ce format contient et ne contient PAS. Un fichier de ce type est la
// CONFIGURATION d'une simulation, pas son résultat : on y trouve les stacks, les blinds, la
// structure de prix, les sizings autorisés, le board, la séquence préflop et — c'est ce qui nous
// intéresse — la range pondérée de chaque joueur au nœud. On n'y trouve NI stratégie, NI EV, NI
// équité par combo. Vérifié en balayant toutes les clés du fichier.
//
// Conséquence directe : on peut classer les mains d'une range nous-mêmes (c'est ce que fait
// relativeStrength.js), mais on ne peut pas restituer « ce que le solveur joue » à ce nœud.

import { comboKey } from "./combos";
import { parseBoardCards } from "./scoring";

// Ordre de parole préflop chez HRC : le dernier indice est la BB, l'avant-dernier la SB, puis on
// remonte le bouton et les positions précédentes. Vérifié sur ce fichier : les joueurs 0-1-2
// se couchent, le 3 relance et le 5 paie — soit exactement BU qui ouvre et BB qui défend.
const POSITION_ORDER = ["BB", "SB", "BU", "CO", "HJ", "UTG", "UTG+1", "UTG+2"];

export function positionsFor(nPlayers) {
  const out = new Array(nPlayers);
  for (let i = 0; i < nPlayers; i++) out[nPlayers - 1 - i] = POSITION_ORDER[i] || `P${nPlayers - 1 - i}`;
  return out;
}

export function isHrcPostflopExport(json) {
  return !!(json && json.subtree && typeof json.subtree.board === "string" && json.subtree.players);
}

// Range HRC : "2d2c, 2h2c:0.16, 3c2c" — combo de 4 caractères, poids optionnel après ':',
// 1 par défaut. On normalise vers la clé triée utilisée partout ailleurs dans l'app.
export function parseHrcRange(text) {
  const weights = {};
  if (!text) return weights;
  for (const tok of text.split(",")) {
    const t = tok.trim();
    if (!t) continue;
    const [combo, w] = t.split(":");
    if (combo.length !== 4) continue;
    const weight = w === undefined ? 1 : parseFloat(w);
    if (!(weight > 0)) continue;
    weights[comboKey([combo.slice(0, 2), combo.slice(2, 4)])] = weight;
  }
  return weights;
}

const STREET_NAMES = { 0: "préflop", 1: "flop", 2: "turn", 3: "river" };

export function parseHrcPostflopNode(json) {
  if (!isHrcPostflopExport(json)) throw new Error("Ce fichier n'est pas un nœud postflop HRC.");
  const st = json.subtree;
  const stacks = json.handdata?.stacks || [];
  const bb = json.handdata?.blinds?.[0] || 1;
  const positions = positionsFor(Object.keys(st.players).length);

  const players = Object.entries(st.players).map(([id, p]) => {
    const index = Number(id);
    return {
      index,
      position: positions[index],
      active: !!p.active,
      weights: p.active ? parseHrcRange(p.range) : {},
    };
  }).sort((a, b) => a.index - b.index);

  const actives = players.filter((p) => p.active);
  const sequence = (st.sequence || []).map((a) => ({
    ...a, position: positions[a.player], amountBB: a.amount / bb,
  }));

  return {
    board: parseBoardCards(st.board),
    street: st.street,
    streetName: STREET_NAMES[st.street] || `street ${st.street}`,
    effectiveBB: stacks.length ? Math.min(...stacks) / bb : null,
    bb,
    players,
    actives,
    sequence,
    // Résumé lisible de l'action préflop, pour l'afficher à l'élève.
    preflopLine: sequence
      .filter((a) => a.type !== "F")
      .map((a) => `${a.position} ${a.type === "R" ? `raise ${a.amountBB.toFixed(1)}bb` : a.type === "C" ? "call" : a.type}`)
      .join(" · "),
    prizes: json.eqmodel?.structure?.prizes || null,
    // Ce que le fichier ne porte pas : sert à empêcher toute page d'affirmer le contraire.
    hasStrategy: false,
  };
}
