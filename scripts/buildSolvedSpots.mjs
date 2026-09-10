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
// Poids en dessous duquel un combo n'est plus livré : il ne peut pas sortir au tirage pondéré
// et n'apporte rien à l'élève.
const COMBO_WEIGHT_FLOOR = 0.001;
// Taille minimale d'une range, en combos pondérés, pour qu'un spot soit entraînable. En dessous,
// les quintiles ne veulent rien dire : à 20 combos chaque tranche en contient 4, à 1 combo la
// question n'a pas de sens. Mesuré sur les 4 premières textures : 10% des nœuds de l'arbre ont
// moins de 0.5 combo pondéré, et certains exactement 0 — des branches que personne n'atteint.
const MIN_RANGE_WEIGHT = 20;

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

// Agresseur préflop : le dernier à avoir relancé avant le flop. C'est lui qui définit le
// vocabulaire — on ne parle de cbet et de barrel que pour lui.
function preflopAggressor(seq) {
  let pfa = null;
  for (const a of seq) if (a.street === 0 && a.type === "R") pfa = a.player;
  return pfa;
}

// Nom de la ligne, à partir du MOTIF de mise du vilain street par street.
//
// La première version comptait seulement sur combien de streets il avait misé : une ligne
// « flop check-check, turn bet, river bet » sortait en « 2e barrel » alors que c'est un delay
// cbet suivi d'une mise river. Un barrel suppose d'avoir cbet le flop ; sans ça le vocabulaire
// est faux, et c'est justement sur ces noms que se fait le choix de ce qu'on entraîne.
function lineArchetype(seq, street, heroIdx) {
  const post = seq.filter((a) => a.street >= 1);
  const pfa = preflopAggressor(seq);

  // Hero a misé sur cette street et se retrouve à parler : c'est qu'on l'a relancé.
  if (post.some((a) => a.street === street && a.player === heroIdx && a.type === "R")) {
    return "Face à un raise";
  }

  const streetsMisees = [...new Set(post.filter((a) => a.player !== heroIdx && a.type === "R").map((a) => a.street))].sort();
  const motif = streetsMisees.join("");
  const villainEstPfa = heroIdx !== pfa;

  if (villainEstPfa) {
    // Vocabulaire de l'agresseur préflop.
    return {
      "1": "Cbet flop",
      "12": "2e barrel",
      "123": "3e barrel",
      "13": "Cbet flop, check turn, bet river",
      "2": "Delay cbet turn",
      "23": "Delay cbet + bet river",
      "3": "Bet river après deux checks",
    }[motif] || "Face à une mise";
  }
  // Le vilain n'est pas l'agresseur : il mise dans la range de celui qui a relancé.
  return {
    "1": "Donk flop",
    "12": "Donk flop + bet turn",
    "123": "Donk sur les trois streets",
    "2": "Probe turn",
    "23": "Probe turn + bet river",
    "3": "Probe river",
    "13": "Donk flop, check turn, bet river",
  }[motif] || "Face à une mise";
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
const startWeight = {};
for (const p of players) {
  if (!startRanges[p]) throw new Error(`Pas de nœud de street ${root.street} pour le joueur ${p} : range de départ introuvable.`);
  startWeight[p] = Object.values(startRanges[p]).reduce((a, b) => a + b, 0);
  console.log(`  range de départ J${p} (${POS(p)}) : ${Object.keys(startRanges[p]).length} combos, poids ${startWeight[p].toFixed(1)}`);
}

const out = [];
const seen = new Set();
const stack = [[0, startRanges]];
let visited = 0;
let skippedEmpty = 0;
let skippedThin = 0;

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

  // Un nœud trop étroit n'est pas entraînable, mais ses ENFANTS peuvent l'être : sortir de
  // l'itération ici (avec `continue`) amputerait tout le sous-arbre. On se contente donc de ne
  // pas le publier, et le parcours se poursuit normalement.
  const ranked = playable && facingBet && (d.street === 2 || d.street === 3)
    ? rankRangeOnBoard({ heroWeights: heroW, villainWeights: vilW, board })
    : null;
  if (ranked && ranked.totalWeight < MIN_RANGE_WEIGHT) skippedThin++;

  if (ranked && ranked.totalWeight >= MIN_RANGE_WEIGHT) {
    const { pot, commit, maxCommit } = potAndToCall(d.sequence);
    const toCall = maxCommit - (commit[hero] || 0);

    const played = {};
    for (const [c, h] of Object.entries(d.hands)) played[normKey(c)] = h.played;

    // MDF : part de la range qu'il faut défendre pour qu'un bluff adverse ne soit pas rentable.
    // `pot` inclut déjà la mise à payer, donc le pot AVANT cette mise vaut pot − toCall.
    const mdfPct = pot > 0 ? +(((pot - toCall) / pot) * 100).toFixed(1) : 0;
    // Ce que la range défend réellement, d'après le solveur : 1 − fréquence de fold, pondérée.
    // Comparer les deux répond à « est-ce que mes bluffs passent ».
    const foldAt = d.actions.findIndex((a) => a.type === "F");
    let wSum = 0, wDefend = 0;
    for (const [c, h] of Object.entries(d.hands)) {
      const k = normKey(c);
      if (heroW[k] === undefined) continue;
      wSum += heroW[k];
      wDefend += heroW[k] * (1 - (foldAt >= 0 ? h.played[foldAt] || 0 : 0));
    }
    const defendPct = wSum > 0 ? +((wDefend / wSum) * 100).toFixed(1) : null;

    // Fréquence d'atteinte du nœud : poids de la range de hero ici, rapporté à sa range de
    // départ. Elle mesure combien d'échantillons le solveur a consacrés à cette branche, donc
    // à quel point sa stratégie y est fiable. Mesuré sur ce jeu de données : les nœuds atteints
    // plus de 25% du temps n'ont AUCUNE stratégie aberrante (call à 100% avec une équité 15
    // points sous la cote), les branches rares en ont 0.2 à 0.8% en poids. L'export est en CI5 :
    // HRC converge les lignes principales, pas les feuilles.
    const reachPct = +((Object.values(heroW).reduce((a, b) => a + b, 0) / startWeight[hero]) * 100).toFixed(1);

    out.push({
      id,
      street: d.street,
      streetName: STREETS[d.street],
      board,
      reachPct,
      heroPos: POS(hero),
      villainPos: POS(villain),
      line: describeLine(d.sequence),
      archetype: lineArchetype(d.sequence, d.street, hero),
      potBB: +(pot / BB).toFixed(2),
      toCallBB: +(toCall / BB).toFixed(2),
      potOddsPct: +((toCall / (pot + toCall)) * 100).toFixed(1),
      mdfPct,
      defendPct,
      actions: d.actions.map((a) => ({ type: a.type, amountBB: +(a.amount / BB).toFixed(2) })),
      // Déroulé structuré, PRÉFLOP COMPRIS — `line` ne garde que le postflop, sous forme de
      // texte. Le replayer a besoin de chaque action avec son montant et sa street pour
      // reconstituer stacks, pot et mises à chaque étape.
      // Attention aux conventions HRC : pour une relance `amount` est le TOTAL engagé sur la
      // street, pour un call c'est le montant ADDITIONNEL.
      sequence: d.sequence.map((a) => ({
        pos: POS(a.player), type: a.type,
        amountBB: +(a.amount / BB).toFixed(2), street: a.street,
      })),
      // Taille réelle de la range, en combos pondérés. C'est la mesure honnête : annoncer
      // « 1033 combos » quand un tiers d'entre eux arrivent 0.05% du temps surestime la range.
      weightTotal: +ranked.totalWeight.toFixed(1),
      combosListed: ranked.combos.length,
      // [clé, poids, équité %, percentile, fréquences jouées]
      // Les combos sous COMBO_WEIGHT_FLOOR sont écartés du fichier : mesuré, ils représentent
      // 38% des combos pour 0.00% du poids, ne peuvent jamais sortir au tirage pondéré, et
      // pèsent un tiers de la taille livrée. Les percentiles des combos gardés sont calculés
      // AVANT ce filtre, donc restent ceux de la range complète.
      combos: ranked.combos
        .filter((c) => c.weight >= COMBO_WEIGHT_FLOOR)
        .map((c) => [
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
    heroPos: s.heroPos, villainPos: s.villainPos, board: s.board, reachPct: s.reachPct,
    line: s.line, potBB: s.potBB, toCallBB: s.toCallBB, combos: s.combos.length,
    weightTotal: s.weightTotal, mdfPct: s.mdfPct, defendPct: s.defendPct,
  })),
};
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index));

// Catalogue des simulations disponibles, mis à jour à chaque exécution. C'est lui que la page
// lit pour proposer les textures : sans ce fichier il faudrait modifier le code à chaque
// nouvelle sim, et « relancer une sim » ne suffirait pas à la voir apparaître.
const catalogPath = path.join("public", "solved", "sims.json");
const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, "utf8")) : [];
const entry = {
  name: simName,
  board: parseBoardCards(root.board || ""),
  // Board final atteint par la sim : c'est ce qui distingue deux textures à l'œil.
  fullBoard: [...new Set(out.map((s) => s.board.join(" ")))].sort((a, b) => b.length - a.length)[0] || "",
  effectiveBB: START_STACK / BB,
  heroPositions: [...new Set(out.map((s) => s.heroPos))].sort(),
  spots: out.length,
  turn: out.filter((s) => s.street === 2).length,
  river: out.filter((s) => s.street === 3).length,
  builtAt: new Date().toISOString().slice(0, 10),
};
const at = catalog.findIndex((c) => c.name === simName);
if (at >= 0) catalog[at] = entry; else catalog.push(entry);
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 1));
console.log(`  catalogue : ${catalog.length} simulation(s) dans ${catalogPath}`);

console.log(`${visited} nœuds parcourus, ${skippedEmpty} sans range vivante, ${skippedThin} trop etroits, ${out.length} spots entraînables écrits dans ${outDir}`);
console.log(`  poids total : ${(bytes / 1e6).toFixed(1)} Mo · moyenne ${(bytes / out.length / 1024).toFixed(0)} Ko par spot`);
const byArch = {};
for (const s of out) byArch[s.archetype] = (byArch[s.archetype] || 0) + 1;
console.log("  par archétype :", byArch);
const byStreet = {};
for (const s of out) byStreet[s.streetName] = (byStreet[s.streetName] || 0) + 1;
console.log("  par street    :", byStreet);
