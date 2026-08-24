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
