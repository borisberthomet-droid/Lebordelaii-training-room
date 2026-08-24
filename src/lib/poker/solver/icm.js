// Port direct de icmEquity() depuis poker-mtt-tool/calculateur_deal_making.html (lignes 172-194) —
// même algorithme récursif de Malmuth-Weitzman, inchangé. `stacks` et `prizes` en unités cohérentes
// (jetons / €), retourne l'équité $ ICM de chaque joueur (même ordre que `stacks`).
export function icmEquity(stacks, prizes) {
  const n = stacks.length;
  const p = prizes.length;
  if (n === 0 || p === 0) return new Array(n).fill(0);
  const equities = new Array(n).fill(0);

  function recurse(remaining, prizeIdx, multiplier) {
    if (prizeIdx >= p || remaining.length === 0) return;
    const prize = prizes[prizeIdx];
    const totalRem = remaining.reduce((a, b) => a + b.chips, 0);
    remaining.forEach(player => {
      const prob = player.chips / totalRem;
      equities[player.idx] += multiplier * prob * prize;
      const newRemaining = remaining.filter(r => r.idx !== player.idx);
      recurse(newRemaining, prizeIdx + 1, multiplier * prob);
    });
  }

  const players = stacks.map((chips, idx) => ({ chips, idx }));
  recurse(players, 0, 1);
  return equities;
}

// Équité $ ICM-KO pour un tournoi PKO : équité ICM sur la cagnotte "places payées" (le prizepool
// hors bounties, distribué par ICM classique sur les stacks après la main) + bounty(s) empoché(s)
// pendant la main, ajouté(s) en cash brut par joueur. Ce n'est PAS une approximation par blend
// arbitraire chip-EV/bounty-EV : le bounty d'un adversaire éliminé est encaissé immédiatement, quel
// que soit le classement final, donc il n'est jamais soumis à l'ICM — seul le prizepool restant l'est.
// `bountiesWon[i]` = somme des bounties collectés par le joueur i dans cette issue de main (0 sinon).
export function icmKOEquity(stacks, prizes, bountiesWon) {
  const base = icmEquity(stacks, prizes);
  return base.map((eq, i) => eq + (bountiesWon?.[i] || 0));
}
