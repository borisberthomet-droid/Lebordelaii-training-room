import { POSITIONS_BY_COUNT } from './constants';
import { applyCutoff } from './hhParser';

const STREET_LABEL = { 'pre-flop': 'PRE-FLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER' };

// Reconstruit la séquence de replay (mêmes conventions de step/label que buildHHReplay dans
// hhParser.js, pour rester compatible avec applyCutoff/Replayer/TableView) à partir des ROUNDS
// du JSON Winamax. Point clé (vérifié empiriquement sur de vraies mains, voir le plan) : AMOUNT
// est toujours l'incrément de jetons ajouté par CETTE action, jamais un total cumulé — contrairement
// au format "raises X to Y" du texte HH classique.
function buildReplayFromRounds(rounds, startStacks) {
  const stacks = { ...startStacks };
  let pot = 0;
  const steps = [];
  let board = [];

  const anteRound = rounds.find(r => r.ROUND === 'ANTE/BLINDS');
  const streetCommitInit = {};
  (anteRound?.ACTIONS || []).forEach(a => {
    const amt = Number(a.AMOUNT) || 0;
    stacks[a.LOGIN] = (stacks[a.LOGIN] || 0) - amt;
    pot += amt;
    streetCommitInit[a.LOGIN] = (streetCommitInit[a.LOGIN] || 0) + amt;
  });
  const initialStacks = { ...stacks };
  const initialPot = pot;
  const initialStreetCommit = { ...streetCommitInit };

  for (const round of rounds) {
    if (round.ROUND === 'ANTE/BLINDS') continue;
    const streetName = STREET_LABEL[round.ROUND] || String(round.ROUND).toUpperCase();
    if (round.BOARD?.length) board = round.BOARD.slice();
    const localCommit = streetName === 'PRE-FLOP' ? { ...streetCommitInit } : {};

    if (streetName !== 'PRE-FLOP') {
      steps.push({ street: streetName, player: null, label: null, chipsIn: 0, potBeforeChips: pot, potChips: pot, stacksChips: { ...stacks }, streetCommit: { ...localCommit }, board: [...board] });
    }

    for (const a of round.ACTIONS || []) {
      const player = a.LOGIN;
      const chipsIn = Number(a.AMOUNT) || 0;
      if (chipsIn) localCommit[player] = (localCommit[player] || 0) + chipsIn;
      const remainingAfter = (stacks[player] || 0) - chipsIn;
      const isAllIn = chipsIn > 0 && remainingAfter <= 0;

      let label;
      if (a.ACTION === 'fold' || a.ACTION === 'autofold') label = 'Fold';
      else if (a.ACTION === 'check') label = 'Check';
      else if (a.ACTION === 'raise') label = isAllIn ? `All-in ${localCommit[player]}` : `Raise to ${localCommit[player]}`;
      else if (a.ACTION === 'bet') label = isAllIn ? `All-in ${chipsIn}` : `Bet ${chipsIn}`;
      else if (a.ACTION === 'call') label = isAllIn ? `All-in ${chipsIn}` : `Call ${chipsIn}`;
      else label = a.ACTION;

      stacks[player] = remainingAfter;
      const potBeforeChips = pot;
      pot += chipsIn;
      steps.push({ street: streetName, player, label, chipsIn, potBeforeChips, potChips: pot, stacksChips: { ...stacks }, streetCommit: { ...localCommit }, board: [...board] });
    }
  }
  return { initialStacks, initialPot, initialStreetCommit, bb: null, steps };
}

// Convertit une entrée {CUR: {...}} du JSON replayer Winamax vers la même forme que produit
// parseWinamaxHH() dans hhParser.js, pour réutiliser TableView/Replayer sans modification.
// `heroLogin` = pseudo Winamax de l'utilisateur, pour marquer le siège "hero" (les cartes ne
// sont plus masquées dans ce format donc on ne peut plus détecter hero via "Dealt to").
export function convertWinamaxHand(hand, heroLogin) {
  const cur = hand.CUR;
  const datas = cur.DATAS;
  const game = datas.GAME;
  // Un siège vacant (joueur déjà éliminé du tournoi, fréquent en fin de MTT) a `PLAYER: []` (tableau
  // vide) au lieu d'un objet {LOGIN, MONEY} -- sans ce filtre, `.LOGIN` vaut undefined et produit un
  // joueur fantôme "undefined" compté comme vivant partout en aval (bug réel : une main heads-up
  // était comptée à 3 joueurs vivants à cause d'un siège vide à la table).
  const seatsRaw = (datas.SEATS || []).filter(s => s.PLAYER && typeof s.PLAYER.LOGIN === 'string');
  const n = seatsRaw.length;
  const buttonSeat = Number(game.DEALER);

  // GAME.BETTING ("ante-sb-bb-limite", ex "700000-3000000-6000000-no-limit") est la source fiable
  // pour ante/sb/bb -- sur les mains avec antes, Winamax combine ante+blinde dans une seule action
  // ("posts AN+SB"/"posts AN+BB", montant cumulé), donc parser les libellés d'action pour trouver
  // la bb échoue silencieusement sur ces mains (bug réel rencontré sur une vraie main de MTT).
  const bettingParts = String(game.BETTING || '').split('-');
  const ante = Number(bettingParts[0]) || 0;
  const sb = Number(bettingParts[1]) || 0;
  const bb = Number(bettingParts[2]) || null;

  const startStacks = {};
  seatsRaw.forEach(s => { startStacks[s.PLAYER.LOGIN] = Number(s.PLAYER.MONEY); });

  const replay = buildReplayFromRounds(datas.ROUNDS || [], startStacks);
  replay.bb = bb;

  const cardsByLogin = {};
  (datas.PLAYERS || []).forEach(p => { cardsByLogin[p.LOGIN] = p.CARDS; });

  const labels = POSITIONS_BY_COUNT[n] || POSITIONS_BY_COUNT[6];
  const seatsBase = seatsRaw.map(s => {
    const seatNum = Number(s.SEAT_ID);
    const name = s.PLAYER.LOGIN;
    const stack = Number(s.PLAYER.MONEY);
    const offset = ((seatNum - buttonSeat) % n + n) % n;
    const position = labels ? labels[offset] : '';
    const stackBB = bb ? Math.round((stack / bb) * 10) / 10 : '';
    // PLAYER.BOUNTY confirmé présent sur une vraie main PKO (échantillon SNG initial n'en avait pas
    // -- ce n'était pas un format PKO, pas une absence générale du champ).
    const bounty = s.PLAYER.BOUNTY ? Number(s.PLAYER.BOUNTY) : null;
    return {
      position, stackBB, stackChips: stack,
      bounty: bounty ? `${bounty}€` : '', bountyValue: bounty,
      role: heroLogin && name === heroLogin ? 'hero' : null, profile: '',
      dealer: seatNum === buttonSeat, name, cards: cardsByLogin[name] || null,
    };
  });

  const out = {
    handId: cur.HAND_ID, prevHandId: cur.PREV_HAND_ID,
    seatsBase, replay, numPlayers: n,
    blindLevel: bb ? `${sb}/${bb}${ante ? ` (ante ${ante})` : ''}` : '',
  };

  if (replay.steps.length) {
    const cutoff = applyCutoff(replay.steps, replay.steps.length - 1);
    out.board = cutoff.board.join(' ');
    out.ligne = cutoff.ligne;
    out.seats = seatsBase.map(s => ({ ...s, action: cutoff.actionByPlayer[s.name] || '' }));
  } else {
    out.seats = seatsBase.map(s => ({ ...s, action: '' }));
  }
  return out;
}

export function convertWinamaxSession(hands, heroLogin) {
  return hands.map(h => convertWinamaxHand(h, heroLogin));
}
