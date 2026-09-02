// Port JS de icm_bounty_engine.py (Boris) — ICM exact Malmuth-Weitzman + composante bounty.
// La suite de tests d'origine est portée telle quelle dans icmBounty.test.mjs : elle DOIT
// passer avant tout usage.
//
// Le bug que ce moteur corrige, et qu'il ne faut pas réintroduire : un joueur éliminé touche
// le prix de la place où il sort, PAS une equity nulle. La v1 buguée gonflait le RP de plus de
// 5 points. Le test qui l'attrape : en winner-take-all, le RP doit être exactement 0 (pas de
// structure de paiement → pas de pression ICM).

// Equity $ ICM de chaque joueur — énumération exacte des ordres d'arrivée.
export function icmEquities(stacks, payouts) {
  const n = stacks.length;
  const pay = [...payouts, ...new Array(Math.max(0, n - payouts.length)).fill(0)];
  const eq = new Array(n).fill(0);

  function rec(remaining, prob, place) {
    if (place >= n || prob < 1e-15) return;
    const sRem = remaining.reduce((acc, i) => acc + stacks[i], 0);
    if (sRem <= 0) return;
    for (const i of remaining) {
      const pI = (prob * stacks[i]) / sRem;
      eq[i] += pI * pay[place];
      if (place + 1 < n) rec(remaining.filter((j) => j !== i), pI, place + 1);
    }
  }

  rec([...stacks.keys()], 1, 0);
  return eq;
}

// Equity totale de chaque joueur dans un état donné :
//   - composante ICM sur le prizepool régulier
//   - composante bounty proportionnelle aux jetons, sur le pool KO ENCORE EN CIRCULATION
// Les joueurs à 0 jeton sont considérés éliminés (ils ont déjà touché le prix de leur place).
export function totalEquity(stacks, payoutsFull, nStart, bountyPoolStart, share = 0.5) {
  const alive = stacks.map((s, i) => [s, i]).filter(([s]) => s > 1e-9);
  const sub = alive.map(([s]) => s);
  const nAlive = alive.length;
  const nOut = nStart - nAlive;

  const pay = payoutsFull.slice(0, nAlive);
  const e = icmEquities(sub, pay);

  // Pool KO encore sur les têtes : chaque élimination en retire la moitié.
  const bHead = bountyPoolStart / nStart;
  const poolCirc = bountyPoolStart - nOut * bHead * share;

  const S = sub.reduce((a, b) => a + b, 0);
  const out = new Array(stacks.length).fill(0);
  alive.forEach(([s, i], k) => {
    out[i] = e[k] + (sub[k] / S) * poolCirc;
  });
  return out;
}

// RP = seuil d'équité requis en $ − seuil chipEV (0.5 pour un all-in symétrique).
// Positif = l'ICM serre. Négatif = le bounty pousse à élargir.
export function riskPremium(stacks, payoutsFull, hero, villain, bountyPool = 0, share = 0.5) {
  const n = stacks.length;
  const bHead = bountyPool ? bountyPool / n : 0;
  const eff = Math.min(stacks[hero], stacks[villain]);

  const eqNow = totalEquity(stacks, payoutsFull, n, bountyPool, share)[hero];

  // Hero gagne : villain éliminé s'il ne couvrait pas.
  const win = [...stacks];
  win[hero] += eff;
  win[villain] -= eff;
  let eqWin = totalEquity(win, payoutsFull, n, bountyPool, share)[hero];
  if (bountyPool && stacks[villain] <= stacks[hero] + 1e-9) {
    eqWin += bHead * share; // moitié encaissée en cash, uniquement si hero le couvre
  }

  // Hero perd.
  const lose = [...stacks];
  lose[hero] -= eff;
  lose[villain] += eff;
  let eqLose;
  if (lose[hero] <= 1e-9) {
    // Hero éliminé : il touche le prix de la dernière place occupée.
    const nAliveAfter = lose.filter((s) => s > 1e-9).length;
    eqLose = payoutsFull[nAliveAfter];
  } else {
    eqLose = totalEquity(lose, payoutsFull, n, bountyPool, share)[hero];
  }

  const den = eqWin - eqLose;
  if (den <= 1e-12) return null;
  return ((eqNow - eqLose) / den - 0.5) * 100;
}

// Profils de payout par nombre de joueurs restants, normalisés sur le prizepool régulier.
const PAYOUT_PROFILES = {
  9: [0.30, 0.20, 0.145, 0.11, 0.085, 0.065, 0.05, 0.028, 0.017],
  8: [0.315, 0.21, 0.152, 0.115, 0.088, 0.067, 0.032, 0.021],
  7: [0.33, 0.22, 0.158, 0.12, 0.091, 0.05, 0.031],
  6: [0.35, 0.23, 0.165, 0.125, 0.081, 0.049],
  5: [0.375, 0.245, 0.175, 0.126, 0.079],
  4: [0.41, 0.265, 0.19, 0.135],
  3: [0.45, 0.31, 0.24],
  2: [0.60, 0.40],
};

export function payoutStructure(nLeft, totalRegular) {
  const p = PAYOUT_PROFILES[nLeft];
  if (!p) throw new Error(`Pas de profil de payout pour ${nLeft} joueurs`);
  const s = p.reduce((a, b) => a + b, 0);
  return p.map((x) => (totalRegular * x) / s);
}

export const SUPPORTED_TABLE_SIZES = Object.keys(PAYOUT_PROFILES).map(Number).sort((a, b) => a - b);

// --- Génération de spots de table finale pour l'entraînement ---------------------------------
// L'ICM exact est en O(n!) : au-delà d'une dizaine de joueurs le calcul explose ET ne
// représenterait de toute façon plus le vrai field. On reste donc en table finale (2 à 9).

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// `withBounty` : false = RP ICM « vanilla » (aucune prime), true = ICM + pool KO.
// `coverage` : 'covered' (le vilain couvre hero), 'covers' (hero couvre), 'random'.
export function generateIcmSpot({ withBounty = true, coverage = "random" } = {}) {
  const nPlayers = 4 + Math.floor(Math.random() * 5); // 4 à 8 joueurs
  const stacks = Array.from({ length: nPlayers }, () => Math.round(rand(8, 120)));

  let hero = Math.floor(Math.random() * nPlayers);
  let villain = Math.floor(Math.random() * nPlayers);
  while (villain === hero) villain = Math.floor(Math.random() * nPlayers);

  // Force la relation de couverture demandée, en échangeant les rôles si besoin.
  if (coverage === "covered" && stacks[hero] > stacks[villain]) [hero, villain] = [villain, hero];
  if (coverage === "covers" && stacks[hero] < stacks[villain]) [hero, villain] = [villain, hero];
  // À stacks strictement égaux personne ne couvre : l'échange ne suffit pas, il faut écarter
  // les deux stacks, sinon un spot demandé « hero couvre » sort avec une couverture neutre.
  if (coverage !== "random" && stacks[hero] === stacks[villain]) {
    if (coverage === "covers") stacks[hero] += 1;
    else stacks[villain] += 1;
  }

  const totalRegular = Math.round(rand(5, 40)) * 1000;
  const payouts = payoutStructure(nPlayers, totalRegular);
  // Ratio pool KO / prizepool régulier : en TF d'un PKO 50/50 il tombe typiquement à 27-50%,
  // pas 100% — le pool KO fond plus vite que le régulier (cf. HANDOFF §3.3).
  const bountyPool = withBounty ? Math.round(totalRegular * rand(0.25, 0.55)) : 0;

  return { nPlayers, stacks, hero, villain, payouts, totalRegular, bountyPool, withBounty };
}

export function solveIcmSpot(spot) {
  const rp = riskPremium(spot.stacks, spot.payouts, spot.hero, spot.villain, spot.bountyPool);
  const heroStack = spot.stacks[spot.hero];
  const villainStack = spot.stacks[spot.villain];
  return {
    rp,
    heroStack,
    villainStack,
    heroCovers: heroStack > villainStack,
    effective: Math.min(heroStack, villainStack),
    koRatio: spot.totalRegular ? (spot.bountyPool / spot.totalRegular) * 100 : 0,
  };
}
