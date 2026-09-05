// Transforme une sim HRC résolue (archive dézippée : settings.json + nodes/*.json) en jeux de
// données prêts pour l'exercice « Où suis-je dans ma range ? ».
//
// Pourquoi un script hors ligne plutôt qu'un calcul dans le navigateur :
//   - l'archive fait 29 Mo décompressés, impossible à embarquer dans le bundle ;
//   - le classement par équité coûte ~900 ms sur un nœud de turn. Le faire une fois ici plutôt
//     qu'à chaque question rend la page instantanée.
//
// Usage : node scripts/buildSolvedSpots.mjs <dossier_extrait> <nom_de_la_sim>

import fs from "node:fs";
import path from "node:path";
import { rankRangeOnBoard } from "../src/lib/poker/relativeStrength.js";
import { comboKey } from "../src/lib/poker/combos.js";
import { parseBoardCards } from "../src/lib/poker/scoring.js";

const [srcDir, simName] = process.argv.slice(2);
if (!srcDir || !simName) {
  console.error("usage : node scripts/buildSolvedSpots.mjs <dossier_extrait> <nom_de_la_sim>");
  process.exit(1);
}

const settings = JSON.parse(fs.readFileSync(path.join(srcDir, "settings.json"), "utf8"));
const nodesDir = path.join(srcDir, "nodes");
const nodes = new Map();
for (const f of fs.readdirSync(nodesDir)) {
  if (!f.endsWith(".json")) continue;
  nodes.set(Number(f.slice(0, -5)), JSON.parse(fs.readFileSync(path.join(nodesDir, f), "utf8")));
}

const BB = settings.handdata.blinds[0];
const SB = settings.handdata.blinds[1];
const ANTE = settings.handdata.blinds[2];
const N_PLAYERS = settings.handdata.stacks.length;
const START_STACK = settings.handdata.stacks[0];
const POSITION_ORDER = ["UTG", "HJ", "CO", "BU", "SB", "BB"];
const POS = (i) => POSITION_ORDER[i] ?? `P${i}`;
const STREETS = { 1: "flop", 2: "turn", 3: "river" };

// --- Pot et mise à payer ----------------------------------------------------------------------
// HRC écrit, pour une relance, le TOTAL engagé sur la street ; pour un call, le montant ADDITIONNEL
// à mettre. Confondre les deux fausse le pot, donc les cotes affichées à l'élève.
function potAndToCall(sequence) {
  const commit = {};           // engagement total par joueur, sur la street courante
  let closedPot = ANTE * N_PLAYERS;
  let street = 0;
  const blindOf = (p) => (POS(p) === "SB" ? SB : POS(p) === "BB" ? BB : 0);
  for (let i = 0; i < N_PLAYERS; i++) commit[i] = blindOf(i);

  for (const a of sequence) {
    if (a.street !== street) {
      closedPot += Object.values(commit).reduce((x, y) => x + y, 0);
      for (const k of Object.keys(commit)) commit[k] = 0;
      street = a.street;
    }
    if (a.type === "R") commit[a.player] = a.amount;
    else if (a.type === "C") commit[a.player] = (commit[a.player] || 0) + a.amount;
  }
  const onStreet = Object.values(commit).reduce((x, y) => x + y, 0);
  const maxCommit = Math.max(0, ...Object.values(commit));
  return { pot: closedPot + onStreet, commit, maxCommit };
}

// --- Propagation des ranges -------------------------------------------------------------------
// Un nœud ne stocke que la range du joueur qui parle. Celle de l'adversaire se reconstitue en
// multipliant sa range au nœud précédent par la fréquence de l'action qu'il a prise.
// Vérifié contre les poids stockés par HRC sur les 553 transitions : écart max 0.00013.
function normKey(c) { return comboKey([c.slice(0, 2), c.slice(2, 4)]); }

function clashes(key, board) {
  return board.includes(key.slice(0, 2)) || board.includes(key.slice(2, 4));
}

function weightsOf(node) {
  const out = {};
  for (const [c, h] of Object.entries(node.hands)) if (h.weight > 1e-9) out[normKey(c)] = h.weight;
  return out;
}

// --- Étiquette lisible de la ligne --------------------------------------------------------------
function describeLine(seq) {
  const parts = [];
  let street = 0;
  for (const a of seq) {
    if (a.street === 0) continue;
    if (a.street !== street) { if (parts.length) parts.push("—"); street = a.street; }
    const verb = a.type === "X" ? "check" : a.type === "C" ? "call" : a.type === "F" ? "fold"
      : `bet ${(a.amount / BB).toFixed(1)}bb`;
    parts.push(`${POS(a.player)} ${verb}`);
  }
  return parts.join(", ");
}

// Nom court, celui que Boris emploie : deux barrels, vs probe, etc.
function lineArchetype(seq, street, heroIdx) {
  const post = seq.filter((a) => a.street >= 1);
  const bets = post.filter((a) => a.type === "R");
  const byVillain = bets.filter((a) => a.player !== heroIdx).length;
  const byHero = bets.filter((a) => a.player === heroIdx).length;
  const streetsWithVillainBet = new Set(bets.filter((a) => a.player !== heroIdx).map((a) => a.street)).size;
  const flopChecked = !post.some((a) => a.street === 1 && a.type === "R");

  if (byHero > 0 && byVillain > byHero) return "Face à un raise";
  if (street === 2 && flopChecked) return "Face à une probe turn";
  if (street === 3 && streetsWithVillainBet === 1) return "Face à une probe river";
  if (streetsWithVillainBet >= 3) return "Face au 3e barrel";
  if (streetsWithVillainBet === 2) return "Face au 2e barrel";
  return "Face à une mise";
}

// --- Parcours de l'arbre -------------------------------------------------------------------------
const root = nodes.get(0);
const players = [...new Set([...nodes.values()].map((d) => d.player))];

// Range de départ de chaque joueur, à prendre au premier nœud DE LA STREET RACINE où il parle.
// Se contenter du premier nœud tout court donnait, pour le joueur qui parle en second, un nœud
// de turn : sa range de départ arrivait déjà amputée des combos contenant la carte du turn, et
// toute la propagation en héritait.
const startRanges = {};
for (const [, d] of [...nodes].sort((a, b) => a[0] - b[0])) {
  if (d.street === root.street && startRanges[d.player] === undefined) startRanges[d.player] = weightsOf(d);
}
for (const p of players) {
  if (!startRanges[p]) throw new Error(`Pas de nœud de street ${root.street} pour le joueur ${p} : range de départ introuvable.`);
  console.log(`  range de départ J${p} (${POS(p)}) : ${Object.keys(startRanges[p]).length} combos`);
}

const out = [];
const seen = new Set();
const stack = [[0, startRanges]];
let visited = 0;
let skippedEmpty = 0;

while (stack.length) {
  const [id, ranges] = stack.pop();
  if (seen.has(id)) continue;
  seen.add(id);
  const d = nodes.get(id);
  if (!d) continue;
  visited++;

  const board = parseBoardCards(d.board || "");
  const hero = d.player;
  const villain = players.find((p) => p !== hero);
  const facingBet = d.actions.some((a) => a.type === "C");

  // Seuls les nœuds turn/river où hero fait face à une mise sont entraînables : le flop est
  // hors de portée du classement exact (990 runouts à échantillonner), et sans mise en face il
  // n'y a pas de décision « payer ou se coucher » à poser.
  const heroW = ranges[hero] || {}, vilW = ranges[villain] || {};
  // Une branche jouée à fréquence nulle vide la range : le nœud existe dans l'arbre mais aucune
  // main n'y arrive. On l'écarte au lieu de planter — il n'y a rien à y entraîner.
  const playable = Object.keys(heroW).length > 0 && Object.keys(vilW).length > 0;
  if (!playable) skippedEmpty++;

  if (playable && facingBet && (d.street === 2 || d.street === 3)) {
    const ranked = rankRangeOnBoard({ heroWeights: heroW, villainWeights: vilW, board });
    const { pot, commit, maxCommit } = potAndToCall(d.sequence);
    const toCall = maxCommit - (commit[hero] || 0);

    const played = {};
    for (const [c, h] of Object.entries(d.hands)) played[normKey(c)] = h.played;

    out.push({
      id,
      street: d.street,
      streetName: STREETS[d.street],
      board,
      heroPos: POS(hero),
      villainPos: POS(villain),
      line: describeLine(d.sequence),
      archetype: lineArchetype(d.sequence, d.street, hero),
      potBB: +(pot / BB).toFixed(2),
      toCallBB: +(toCall / BB).toFixed(2),
      potOddsPct: +((toCall / (pot + toCall)) * 100).toFixed(1),
      actions: d.actions.map((a) => ({ type: a.type, amountBB: +(a.amount / BB).toFixed(2) })),
      // [clé, poids, équité %, percentile, fréquences jouées]
      combos: ranked.combos.map((c) => [
        c.key,
        +c.weight.toFixed(3),
        +(c.equity * 100).toFixed(1),
        +c.percentile.toFixed(1),
        (played[c.key] || []).map((p) => +p.toFixed(3)),
      ]),
    });
  }

  // Enfants : on multiplie la range du joueur qui vient d'agir par la fréquence de son action,
  // puis on retire les combos bloqués par la nouvelle carte quand la street change.
  d.actions.forEach((a, ai) => {
    if (a.node === undefined) return;           // fold : terminal, pas d'enfant
    const child = nodes.get(a.node);
    if (!child) return;
    const childBoard = parseBoardCards(child.board || d.board || "");
    const next = {};
    for (const p of players) {
      const src = p === hero
        ? Object.fromEntries(Object.entries(d.hands)
            .map(([c, h]) => [normKey(c), h.weight * h.played[ai]]))
        : ranges[p];
      next[p] = Object.fromEntries(
        Object.entries(src).filter(([k, w]) => w > 1e-9 && !clashes(k, childBoard))
      );
    }
    stack.push([a.node, next]);
  });
}

// --- Écriture ---------------------------------------------------------------------------------
const outDir = path.join("public", "solved", simName);
fs.mkdirSync(outDir, { recursive: true });
let bytes = 0;
for (const spot of out) {
  const f = path.join(outDir, `${spot.id}.json`);
  const txt = JSON.stringify(spot);
  fs.writeFileSync(f, txt);
  bytes += txt.length;
}

const index = {
  sim: simName,
  boardFlop: parseBoardCards(root.board || ""),
  effectiveBB: START_STACK / BB,
  blinds: { sb: SB, bb: BB, ante: ANTE },
  nPlayers: N_PLAYERS,
  prizes: settings.eqmodel?.structure?.prizes || null,
  spots: out.map((s) => ({
    id: s.id, street: s.street, streetName: s.streetName, archetype: s.archetype,
    heroPos: s.heroPos, villainPos: s.villainPos, board: s.board,
    line: s.line, potBB: s.potBB, toCallBB: s.toCallBB, combos: s.combos.length,
  })),
};
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index));

console.log(`${visited} nœuds parcourus, ${skippedEmpty} sans range vivante, ${out.length} spots entraînables écrits dans ${outDir}`);
console.log(`  poids total : ${(bytes / 1e6).toFixed(1)} Mo · moyenne ${(bytes / out.length / 1024).toFixed(0)} Ko par spot`);
const byArch = {};
for (const s of out) byArch[s.archetype] = (byArch[s.archetype] || 0) + 1;
console.log("  par archétype :", byArch);
const byStreet = {};
for (const s of out) byStreet[s.streetName] = (byStreet[s.streetName] || 0) + 1;
console.log("  par street    :", byStreet);
