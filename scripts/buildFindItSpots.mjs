// Génère des spots « Find It » à partir d'une sim HRC résolue : l'élève reconstruit la range du
// joueur qui vient de miser, et la référence est celle du solveur.
//
// Script séparé de buildSolvedSpots.mjs pour une raison de coût : ce dernier passe l'essentiel de
// son temps dans le classement par équité (~900 ms par nœud de turn). Ici on n'a besoin que de la
// propagation des ranges, qui prend quelques secondes pour tout un arbre. Relancer la chaîne
// complète pour ajouter une range aurait coûté vingt minutes pour rien.
//
// La propagation est donc écrite deux fois. Pour que les deux ne divergent pas en silence, ce
// script se contrôle lui-même : il vérifie ses poids contre ceux que HRC stocke, et il refuse de
// travailler sur un nœud absent de l'index déjà construit.
//
// Usage : node scripts/buildFindItSpots.mjs <dossier_extrait> <nom_de_la_sim> [nb_spots]

import fs from "node:fs";
import path from "node:path";
import { comboKey } from "../src/lib/poker/combos.js";
import { parseBoardCards } from "../src/lib/poker/scoring.js";

const [srcDir, simName, nStr] = process.argv.slice(2);
if (!srcDir || !simName) {
  console.error("usage : node scripts/buildFindItSpots.mjs <dossier_extrait> <nom_de_la_sim> [nb_spots]");
  process.exit(1);
}
const MAX_SPOTS = Number(nStr) || 40;
// En dessous, la range à deviner est trop maigre pour que l'exercice ait du sens.
const MIN_VILLAIN_WEIGHT = 30;
const COMBO_WEIGHT_FLOOR = 0.001;

const outDir = path.join("public", "solved", simName);
const indexPath = path.join(outDir, "index.json");
if (!fs.existsSync(indexPath)) {
  console.error(`index introuvable : ${indexPath} — lance d'abord buildSolvedSpots.mjs`);
  process.exit(1);
}
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const dejaConstruits = new Map(index.spots.map((s) => [s.id, s]));

const nodesDir = path.join(srcDir, "nodes");
const nodes = new Map();
for (const f of fs.readdirSync(nodesDir)) {
  if (f.endsWith(".json")) nodes.set(Number(f.slice(0, -5)), JSON.parse(fs.readFileSync(path.join(nodesDir, f), "utf8")));
}

const normKey = (c) => comboKey([c.slice(0, 2), c.slice(2, 4)]);
const clashes = (key, board) => board.includes(key.slice(0, 2)) || board.includes(key.slice(2, 4));

function weightsOf(node) {
  const out = {};
  for (const [c, h] of Object.entries(node.hands)) if (h.weight > 1e-9) out[normKey(c)] = h.weight;
  return out;
}

const root = nodes.get(0);
const players = [...new Set([...nodes.values()].map((d) => d.player))];
const startRanges = {};
for (const [, d] of [...nodes].sort((a, b) => a[0] - b[0])) {
  if (d.street === root.street && startRanges[d.player] === undefined) startRanges[d.player] = weightsOf(d);
}

// --- Parcours, avec auto-contrôle ---------------------------------------------------------------
const ranges = new Map();     // id du nœud -> { [joueur]: poids }
let ecartMax = 0;
const stack = [[0, startRanges]];
const seen = new Set();

while (stack.length) {
  const [id, r] = stack.pop();
  if (seen.has(id)) continue;
  seen.add(id);
  const d = nodes.get(id);
  if (!d) continue;
  ranges.set(id, r);

  // Contrôle : la range propagée pour le joueur qui parle doit retrouver celle que HRC stocke.
  const mienne = r[d.player] || {};
  for (const [c, h] of Object.entries(d.hands)) {
    if (h.weight <= 1e-9) continue;
    ecartMax = Math.max(ecartMax, Math.abs(h.weight - (mienne[normKey(c)] || 0)));
  }

  d.actions.forEach((a, ai) => {
    if (a.node === undefined || !nodes.has(a.node)) return;
    const boardEnfant = parseBoardCards(nodes.get(a.node).board || d.board || "");
    const suivant = {};
    for (const p of players) {
      const src = p === d.player
        ? Object.fromEntries(Object.entries(d.hands).map(([c, h]) => [normKey(c), h.weight * h.played[ai]]))
        : r[p];
      suivant[p] = Object.fromEntries(
        Object.entries(src).filter(([k, w]) => w > 1e-9 && !clashes(k, boardEnfant))
      );
    }
    stack.push([a.node, suivant]);
  });
}

if (ecartMax > 0.01) {
  console.error(`propagation incohérente avec HRC (écart ${ecartMax.toFixed(5)}) — script à revoir`);
  process.exit(1);
}

// --- Sélection ------------------------------------------------------------------------------------
// On garde les nœuds les plus souvent atteints : ce sont aussi les mieux convergés par le solveur,
// et les plus utiles à travailler. Un nœud joué 2% du temps n'apprend rien et sa range est bruitée.
const candidats = [];
for (const [id, meta] of dejaConstruits) {
  const d = nodes.get(id);
  const r = ranges.get(id);
  if (!d || !r) continue;
  const villain = players.find((p) => p !== d.player);
  const vil = r[villain] || {};
  const poids = Object.values(vil).reduce((a, b) => a + b, 0);
  if (poids < MIN_VILLAIN_WEIGHT) continue;
  candidats.push({ id, meta, vil, poids, reach: meta.reachPct ?? 0 });
}
candidats.sort((a, b) => b.reach - a.reach);
const retenus = candidats.slice(0, MAX_SPOTS);

let octets = 0;
for (const c of retenus) {
  const combos = Object.entries(c.vil)
    .filter(([, w]) => w >= COMBO_WEIGHT_FLOOR)
    .map(([k, w]) => [k, +w.toFixed(3)]);
  const txt = JSON.stringify({ id: c.id, villainCombos: combos, villainWeight: +c.poids.toFixed(1) });
  fs.writeFileSync(path.join(outDir, `r${c.id}.json`), txt);
  octets += txt.length;
}

index.findItSpots = retenus.map((c) => ({
  id: c.id, street: c.meta.street, streetName: c.meta.streetName, archetype: c.meta.archetype,
  heroPos: c.meta.heroPos, villainPos: c.meta.villainPos, board: c.meta.board, line: c.meta.line,
  potBB: c.meta.potBB, reachPct: c.meta.reachPct, villainWeight: +c.poids.toFixed(1),
}));
fs.writeFileSync(indexPath, JSON.stringify(index));

// Le catalogue porte le compte, pour que la page sache quelles textures proposer.
const catalogPath = path.join("public", "solved", "sims.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const entree = catalog.find((c) => c.name === simName);
if (entree) { entree.findIt = retenus.length; fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 1)); }

console.log(
  `${simName} : ${retenus.length} spots Find It sur ${candidats.length} candidats ` +
  `(${(octets / 1024).toFixed(0)} Ko) · contrôle de propagation ${ecartMax.toFixed(6)}`
);
