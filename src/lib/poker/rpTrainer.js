// Module de training RP — génère des questions à partir d'un tournoi réel (bibliothèque
// SharkScope) et calcule le Risk Premium de référence via ICM+bounty réel, pas une formule
// heuristique. Voir la conversation où Boris a confirmé (2026-08-25) : "c'est un calcul de risk
// premium, avec le modèle ICM. C'est la différence entre la valeur des jetons gagnés vs jetons
// perdus" — et corrigé le système de tables précédent qui ne pouvait jamais donner de RP positif
// pour un joueur couvert (la table ChipLead advantage de son propre Excel n'a que le côté
// "avantage", jamais le côté "couvert").

import { icmKOEquity } from "./solver/icm";
import { tournamentPoolSplit } from "./sharkscopeJson";

// Stade du tournoi à partir du nombre de joueurs restants — mêmes seuils que discutés, plus une
// zone "mid" explicite pour la portion du tournoi entre "early" et "bubble" que le brief laissait
// sans nom (>30% restant = early, ITM+1..ITM*1.1 = bubble, <=ITM = itm, <=9 = finalTable).
export function determineStage(playersRemaining, totalEntries, itmPlaces) {
  if (playersRemaining <= 9) return "finalTable";
  if (playersRemaining <= itmPlaces) return "itm";
  if (playersRemaining <= itmPlaces * 1.1) return "bubble";
  if (playersRemaining > totalEntries * 0.3) return "early";
  return "mid";
}

// Simule une confrontation "héros pousse tout son stack, vilain peut caller" en ICM+bounty et
// retourne le Risk Premium du héros : l'équité EN PLUS de la cote du pot qu'il lui faut à cause de
// la concavité ICM (perdre coûte plus cher, en $, que gagner ne rapporte). RP > 0 = prudence
// nécessaire (typiquement le joueur couvert, sans bounty compensatoire) ; RP < 0 = le bounty rend
// l'action plus profitable que la cote seule ne l'indique.
//
// `otherStacksBB` = stacks des AUTRES joueurs encore en lice (héros/vilain exclus), pour un
// contexte ICM réaliste — volontairement limité à une poignée de joueurs représentatifs (l'ICM
// récursif est en O(n!), pas utilisable sur un field de centaines de joueurs ; c'est la même
// simplification qu'un export HRC avec otherstacks/otheravgbounty).
// `remainingPrizes` = tableau des prix RÉGULIERS (hors bounty) restants, indexé par place (index
// 0 = 1ère place), déjà tronqué au nombre de joueurs restants dans le field réel.
export function computeConfrontationRP({
  heroStackBB, villainStackBB, heroBountyBB = 0, villainBountyBB = 0,
  otherStacksBB = [], remainingPrizes, progressiveFactor = 0.5,
}) {
  const atRisk = Math.min(heroStackBB, villainStackBB);
  const heroIdx = 0, villIdx = 1;
  const baseStacks = [heroStackBB, villainStackBB, ...otherStacksBB];
  const baseBounties = [heroBountyBB, villainBountyBB, ...otherStacksBB.map(() => 0)];

  function equityFor(stacksAfter, bustedIdx, collectorIdx) {
    const n = stacksAfter.length;
    const live = [];
    for (let i = 0; i < n; i++) if (i !== bustedIdx) live.push(i);
    const liveStacks = live.map((i) => stacksAfter[i]);
    const bountiesWonLive = live.map((i) =>
      i === collectorIdx && bustedIdx != null ? baseBounties[bustedIdx] * progressiveFactor : 0
    );
    const eq = icmKOEquity(liveStacks, remainingPrizes, bountiesWonLive);
    const result = new Array(n).fill(0);
    live.forEach((i, k) => { result[i] = eq[k]; });
    if (bustedIdx != null) {
      // Éliminé maintenant, avec `n` joueurs encore en lice avant cette élimination -> termine
      // exactement à la Nème place, un prix déterministe (pas d'ICM pour un joueur déjà sorti).
      result[bustedIdx] = remainingPrizes[n - 1] || 0;
    }
    return result;
  }

  const eqNow = equityFor(baseStacks, null, null)[heroIdx];

  const winStacks = [...baseStacks];
  winStacks[heroIdx] += atRisk;
  winStacks[villIdx] -= atRisk;
  const villainBusts = atRisk === baseStacks[villIdx];
  const eqWin = equityFor(winStacks, villainBusts ? villIdx : null, villainBusts ? heroIdx : null)[heroIdx];

  const loseStacks = [...baseStacks];
  loseStacks[heroIdx] -= atRisk;
  loseStacks[villIdx] += atRisk;
  const heroBusts = atRisk === baseStacks[heroIdx];
  const eqLose = equityFor(loseStacks, heroBusts ? heroIdx : null, heroBusts ? villIdx : null)[heroIdx];

  const gainPerChip = (eqWin - eqNow) / atRisk;
  const lossPerChip = (eqNow - eqLose) / atRisk;
  const rp = lossPerChip > 0 ? 1 - gainPerChip / lossPerChip : null;

  return { atRisk, eqNow, eqWin, eqLose, gainPerChip, lossPerChip, rp };
}

// Découpe le payoutTable réel d'un tournoi de la bibliothèque en tableau de prix RÉGULIERS (hors
// bounty) indexé par place, tronqué à `playersRemaining` — même logique que chipValueAt.
export function remainingRegularPrizes(tournament, playersRemaining) {
  const arr = new Array(playersRemaining).fill(0);
  for (const p of tournament.payoutTable) {
    if (p.position <= playersRemaining) arr[p.position - 1] = p.prizeEuro - p.prizeBountyComponent;
  }
  return arr;
}

export { tournamentPoolSplit };

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// Génère une question de training à une TABLE FINALE réelle (la seule situation où l'ICM exact
// est à la fois correct ET calculable — au-delà d'une dizaine de joueurs restants, le calcul
// récursif explose et ne représenterait de toute façon pas correctement le champ réel). Stacks
// synthétiques 5-35 BB, bounty du vilain tiré d'un ratio bounty/stack 5%-50% — plage observée sur
// les vraies mains collectées cette session (Gravity/Explorer : ratios réels entre 0.07 et 0.41).
export function generateFinalTableQuestion(tournament, seatCount = 9) {
  const n = Math.min(seatCount, tournament.payoutTable.length || seatCount);
  const stacks = Array.from({ length: n }, () => Math.round(randomBetween(5, 35) * 10) / 10);

  const heroIdx = Math.floor(Math.random() * n);
  let villIdx = Math.floor(Math.random() * n);
  while (villIdx === heroIdx) villIdx = Math.floor(Math.random() * n);

  const villainBountyBB = Math.round(randomBetween(0.05, 0.5) * stacks[villIdx] * 10) / 10;
  const otherStacksBB = stacks.filter((_, i) => i !== heroIdx && i !== villIdx);
  const remainingPrizes = remainingRegularPrizes(tournament, n);

  const detail = computeConfrontationRP({
    heroStackBB: stacks[heroIdx], villainStackBB: stacks[villIdx],
    villainBountyBB, otherStacksBB, remainingPrizes,
  });

  return {
    tournamentName: tournament.name, seatCount: n, stacks, heroIdx, villIdx,
    heroStackBB: stacks[heroIdx], villainStackBB: stacks[villIdx], villainBountyBB,
    remainingPrizes, detail,
  };
}

// PKO/SKO standard 50/50 — voir PROGRESSIVE_FACTOR dans pko-rp/page.js pour le détail.
const PROGRESSIVE_FACTOR = 0.5;

// Valeur d'un jeton (€) à un stade donné, en unité "BB de départ ASSUMÉE" plutôt qu'en jetons
// réels — même formule que chipValueAt (prizepool RESTANT / total en jeu), mais on ne connaît
// pas le vrai stack de départ en BB (dépend de la structure de blindes, pas dans les données
// SharkScope). `startingStackBB` est donc une convention pédagogique (100 BB par défaut, valeur
// ronde standard), pas une vraie donnée du tournoi — les questions early/mid restent réalistes
// en PROPORTION mais le stack de départ affiché est une hypothèse, pas un fait vérifié.
function bbChipValueAt(tournament, playersRemaining, startingStackBB) {
  const totalEntries = tournament.totalEntrants + tournament.reEntries;
  const totalChipsBB = startingStackBB * totalEntries;
  const { totalBountyPool, totalRegularPool } = tournamentPoolSplit(tournament);
  const remainingBountyPool = totalBountyPool * (playersRemaining / totalEntries);
  const alreadyPaidRegular = tournament.payoutTable
    .filter((p) => p.position > playersRemaining)
    .reduce((s, p) => s + (p.prizeEuro - p.prizeBountyComponent), 0);
  const remainingRegularPool = totalRegularPool - alreadyPaidRegular;
  return (remainingBountyPool + remainingRegularPool) / totalChipsBB;
}

// Plage de joueurs restants représentative d'un stade donné.
function stageRemainingRange(stage, totalEntries, itmPlaces) {
  const clampMax = (v) => Math.min(v, totalEntries);
  switch (stage) {
    case "finalTable": return [2, 9];
    case "itm": return [10, clampMax(itmPlaces)];
    case "bubble": return [itmPlaces + 1, clampMax(Math.round(itmPlaces * 1.1))];
    case "mid": return [Math.round(itmPlaces * 1.1) + 1, clampMax(Math.round(totalEntries * 0.3))];
    case "early":
    default: return [Math.round(totalEntries * 0.3) + 1, totalEntries];
  }
}

// Génère une question EARLY/MID (ou bubble/itm à grand field) : loin de la bulle, la pression
// ICM est négligeable (les stacks restent quasi proportionnels à leur valeur $) — le RP y est
// dominé presque entièrement par la valeur du bounty, pas par la concavité ICM. C'est pour ça
// qu'on ne fait PAS tourner la simulation de confrontation ICM ici : à ce stade, un petit groupe
// simulé de joueurs est de toute façon hors d'atteinte des places payées (le calcul donnerait une
// équité $ nulle des deux côtés, RP indéfini) — l'ICM exact n'est fiable qu'à l'approche de la
// table finale (voir generateFinalTableQuestion). RP ici = −(bounty en BB × 50%) / stack du
// vilain, avec la valeur du jeton calculée sur le VRAI prizepool restant à ce stade (comme dans
// l'outil d'analyse /pko-rp), donc pas un lookup arbitraire.
export function generateBountyValueQuestion(tournament, stage, startingStackBB = 100) {
  const totalEntries = tournament.totalEntrants + tournament.reEntries;
  const itmPlaces = tournament.payoutTable.length;
  const [lo, hi] = stageRemainingRange(stage, totalEntries, itmPlaces);
  const playersRemaining = Math.round(randomBetween(lo, Math.max(lo, hi)));

  const stackRange = stage === "early" ? [40, 150] : [20, 90];
  const villainStackBB = Math.round(randomBetween(stackRange[0], stackRange[1]) * 10) / 10;
  const heroStackBB = Math.round(randomBetween(stackRange[0], stackRange[1]) * 10) / 10;

  const { totalBountyPool } = tournamentPoolSplit(tournament);
  const avgBountyEuro = totalBountyPool / totalEntries;
  const villainBountyEuro = Math.round(avgBountyEuro * randomBetween(0.3, 4) * 100) / 100;

  const chipValueBB = bbChipValueAt(tournament, playersRemaining, startingStackBB);
  const villainBountyBB = Math.round((villainBountyEuro * PROGRESSIVE_FACTOR) / chipValueBB * 10) / 10;
  const rp = -(villainBountyBB / villainStackBB);

  return {
    tournamentName: tournament.name, stage, playersRemaining, totalEntries, itmPlaces,
    heroStackBB, villainStackBB, villainBountyEuro, villainBountyBB, chipValueBB,
    detail: { rp },
  };
}
