// Parseur d'export HRC (HoldemResources Calculator) — format JSON très différent d'une hand
// history Winamax : contient la structure de payout restante complète (eqmodel.structure.prizes),
// le progressiveFactor (part du bounty encaissée en cash, 0.5 en PKO classique 50/50, 1 en Mystery
// KO), et la liste (individuelle, pas un agrégat) des stacks du reste du champ (eqmodel.otherstacks)
// avec un bounty moyen pour ce reste (otheravgbounty). Formule et logique portées à l'identique de
// ko_converter_11.html (outil du coach) — vérifiées programmatiquement contre sa sortie réelle sur
// deux fichiers distincts (une TF à 6 joueurs sans otherstacks, un 75%FL à 2400 joueurs avec
// otherstacks peuplé) : correspondance exacte sur tous les totaux et toutes les valeurs par joueur.
// Voir [[project_pko_rp_system]] pour le détail de cette vérification.

export function isHRCExport(json) {
  return !!(json && json.handdata && json.eqmodel);
}

export function computeHRCStats(json) {
  const { stacks, bounties, blinds } = json.handdata;
  const otherstacks = json.eqmodel?.otherstacks || [];
  const otheravgbounty = json.eqmodel?.otheravgbounty || 0;
  const structure = json.eqmodel?.structure || {};
  const prizes = structure.prizes || {};
  const bountyType = structure.bountyType || 'PKO';
  const fixedBounty = structure.bounty || 0;
  const bb = blinds?.[0] || 100;
  const bbFactor = bb / 100;

  const nbTable = stacks.length;
  const nbOthers = otherstacks.length;
  const nbTotal = nbTable + nbOthers;

  const stacksTableNorm = stacks.reduce((a, b) => a + b, 0) / bb;
  const otherstacksSum = otherstacks.reduce((a, b) => a + b, 0) / bbFactor;
  const totalChips = stacksTableNorm + otherstacksSum;
  const avgStackBB = totalChips / nbTotal;

  const sortedKeys = Object.keys(prizes).map((k) => parseInt(k, 10)).sort((a, b) => a - b);
  const lastPaidPlace = sortedKeys[sortedKeys.length - 1];
  let remainingRegular = 0;
  for (let i = 0; i < sortedKeys.length; i++) {
    const startPlace = sortedKeys[i];
    if (startPlace > nbTotal) break;
    const endPlace = i + 1 < sortedKeys.length
      ? Math.min(sortedKeys[i + 1] - 1, nbTotal, lastPaidPlace)
      : Math.min(lastPaidPlace, nbTotal);
    if (endPlace < startPlace) continue;
    remainingRegular += prizes[startPlace] * (endPlace - startPlace + 1);
  }

  let remainingBountyPool, progressiveFactor;
  if (bountyType === 'KO') {
    remainingBountyPool = fixedBounty * nbTotal;
    progressiveFactor = 1;
  } else {
    remainingBountyPool = otheravgbounty * nbOthers + bounties.reduce((a, b) => a + b, 0);
    progressiveFactor = structure.progressiveFactor || 0.5;
  }
  const remainingTotalPrizes = remainingRegular + remainingBountyPool;

  const players = stacks.map((stack, i) => {
    const bounty = bounties[i];
    const bountyToWin = bounty * progressiveFactor;
    const koBB = remainingTotalPrizes > 0 ? (bountyToWin * totalChips) / remainingTotalPrizes : null;
    const stackBB = stack / bb;
    const ratio = koBB != null && stackBB > 0 ? koBB / stackBB : null;
    return { stackChips: stack, stackBB, bountyEuro: bounty, koBB, ratio };
  });

  return { bb, nbTotal, totalChips, avgStackBB, remainingRegular, remainingBountyPool, remainingTotalPrizes, bountyType, progressiveFactor, players };
}
