// Parseur d'export SharkScope (ressource API "CompletedTournament") — donne la vraie grille
// de gains finale d'un tournoi terminé (position -> prix, dont la part bounty de chaque prix),
// le prizepool réel, la guarantee, le split stake/rake et le nombre total d'entrants+recaves.
// Complémentaire des exports HRC/screenshots client : contient le payout RÉEL (pas un modèle),
// mais pas le stack de départ ni la structure de blindes — à combiner avec une autre source pour
// la conversion €->jetons. Vérifié contre deux tournois réels distincts (schéma identique).

export function isSharkScopeExport(json) {
  return !!json?.CompletedTournament;
}

export function parseSharkScopeTournament(json) {
  const t = json.CompletedTournament;
  const entries = [].concat(t.TournamentEntry || []);

  const payoutTable = entries
    .filter((e) => e['@prize'] != null)
    .map((e) => ({
      position: Number(e['@position']),
      prizeEuro: parseFloat(e['@prize']),
      prizeBountyComponent: e['@prizeBountyComponent'] != null ? parseFloat(e['@prizeBountyComponent']) : 0,
      playerName: e['@playerName'],
    }))
    .sort((a, b) => a.position - b.position);

  return {
    id: t['@id'],
    name: t['@name'],
    currency: t['@currency'],
    totalEntrants: Number(t['@totalEntrants']),
    reEntries: Number(t['@reEntries'] || 0),
    tickets: Number(t['@tickets'] || 0),
    guarantee: parseFloat(t['@guarantee'] || 0),
    prizePool: parseFloat(t['@prizePool'] || 0),
    stake: parseFloat(t['@stake'] || 0),
    rake: parseFloat(t['@rake'] || 0),
    playersPerTable: Number(t['@playersPerTable'] || 0),
    payoutTable,
  };
}

// Prix (€) pour une place donnée — pour toute place au-delà de la dernière payée, retourne 0.
export function prizeForPosition(payoutTable, position) {
  const row = payoutTable.find((r) => r.position === position);
  return row ? row.prizeEuro : 0;
}

// Répartit le prizepool réel entre part "régulière" et part "bounty". On ancre sur
// tournament.prizePool (champ officiel SharkScope) plutôt que sur la somme des positions du
// payoutTable : cette somme peut être incomplète (ex: certaines places payées en ticket plutôt
// qu'en cash, non chiffrées par position) — vérifié sur Gravity, écart de ~5 500€ / 16%.
export function tournamentPoolSplit(tournament) {
  const totalBountyPool = tournament.payoutTable.reduce((s, p) => s + p.prizeBountyComponent, 0);
  const totalRegularPool = tournament.prizePool - totalBountyPool;
  return { totalBountyPool, totalRegularPool };
}

// Estime le nombre de joueurs encore en lice à partir du sélecteur "% Field Left" de l'UI
// (75/50/25 ou "TF" pour table finale).
export function estimatePlayersRemaining(tournament, fieldLeftPct) {
  const totalEntries = tournament.totalEntrants + tournament.reEntries;
  if (fieldLeftPct === "TF") return Math.min(tournament.playersPerTable || 9, totalEntries);
  return Math.max(1, Math.round(totalEntries * (fieldLeftPct / 100)));
}

// Valeur réelle d'un jeton (€) à un instant du tournoi (formule Feuil1 de Boris) : prizepool
// RESTANT (pas celui de départ) divisé par le total de jetons en jeu (constant sur tout le
// tournoi). Le prizepool restant diminue à mesure que des joueurs sont éliminés — la part
// bounty déjà collectée quitte pour moitié le pool en cash immédiat (voir progressiveFactor
// dans rpFromHH/hrcJson), la part régulière ne bouge qu'une fois les places payées atteintes.
// Nécessite tournament.startingStack (pas dans l'export SharkScope brut — ajouté à la main
// dans la bibliothèque, cf sharkscopeLibrary.json). Retourne null si absent.
export function chipValueAt(tournament, playersRemaining) {
  const totalEntries = tournament.totalEntrants + tournament.reEntries;
  const totalChips = (tournament.startingStack || 0) * totalEntries;
  if (!totalChips) return null;
  const { totalBountyPool, totalRegularPool } = tournamentPoolSplit(tournament);
  const remainingBountyPool = totalBountyPool * (playersRemaining / totalEntries);
  const alreadyPaidRegular = tournament.payoutTable
    .filter((p) => p.position > playersRemaining)
    .reduce((s, p) => s + (p.prizeEuro - p.prizeBountyComponent), 0);
  const remainingRegularPool = totalRegularPool - alreadyPaidRegular;
  const prizepoolRestant = remainingBountyPool + remainingRegularPool;
  return prizepoolRestant / totalChips;
}
