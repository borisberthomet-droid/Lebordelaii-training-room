import { POSITIONS_BY_COUNT } from './constants';

// Isole la section d'en-tête (avant la première "*** ... ***") : c'est là, et seulement là,
// que se trouvent les vraies lignes "Seat N: nom (stack, bounty)". Le résumé final peut contenir
// des lignes "Seat N: nom (big blind) showed..." qui matchent le même motif par accident.
export function getSeatHeaderSection(text) {
  const idx = text.indexOf('***');
  return idx === -1 ? text : text.slice(0, idx);
}

export function parseSeatParenthetical(raw) {
  const commaIdx = raw.indexOf(',');
  const stackPart = commaIdx === -1 ? raw : raw.slice(0, commaIdx);
  const bountyPart = commaIdx === -1 ? '' : raw.slice(commaIdx + 1);
  const stack = parseInt(stackPart.replace(/[^\d]/g, ''), 10);
  const bountyMatch = bountyPart.match(/(\d+(?:[.,]\d+)?)\s*€/);
  const bounty = bountyMatch ? parseFloat(bountyMatch[1].replace(',', '.')) : null;
  return { stack, bounty };
}

// Construit la séquence complète de la main avec suivi précis des jetons : pour chaque action,
// combien chaque joueur a en stack, combien il y a dans le pot, et le board visible à ce moment.
export function buildHHReplay(text) {
  const result = { initialStacks: {}, initialPot: 0, initialStreetCommit: {}, bb: null, steps: [] };
  try {
    const mBlinds = text.match(/\((\d+)\/(\d+)\/(\d+)\)/) || text.match(/\((\d+)\/(\d+)\)/);
    let sb, bb;
    if (mBlinds) {
      if (mBlinds.length === 4) { sb = parseInt(mBlinds[2], 10); bb = parseInt(mBlinds[3], 10); }
      else { sb = parseInt(mBlinds[1], 10); bb = parseInt(mBlinds[2], 10); }
    }
    result.bb = bb || null;

    const seatLines = [...getSeatHeaderSection(text).matchAll(/Seat (\d+): (.+?) \(([^)]+)\)/g)];
    const stacks = {};
    seatLines.forEach(m => { stacks[m[2].trim()] = parseSeatParenthetical(m[3]).stack; });

    const anteSection = text.split('*** ANTE/BLINDS ***')[1] || '';
    const anteBlock = anteSection.split('*** PRE-FLOP ***')[0];
    let pot = 0;
    const streetCommit = {};
    anteBlock.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
      let m;
      if ((m = line.match(/^(.+?) posts ante (\d+)/))) { stacks[m[1]] -= +m[2]; pot += +m[2]; }
      else if ((m = line.match(/^(.+?) posts small blind (\d+)/))) { stacks[m[1]] -= +m[2]; pot += +m[2]; streetCommit[m[1]] = +m[2]; }
      else if ((m = line.match(/^(.+?) posts big blind (\d+)/))) { stacks[m[1]] -= +m[2]; pot += +m[2]; streetCommit[m[1]] = +m[2]; }
    });
    result.initialStacks = { ...stacks };
    result.initialPot = pot;
    result.initialStreetCommit = { ...streetCommit };

    let board = [];
    const streets = text.split(/\*\*\* (PRE-FLOP|FLOP|TURN|RIVER) \*\*\*/);
    for (let i = 1; i < streets.length; i += 2) {
      const streetName = streets[i];
      const content = streets[i + 1] || '';
      const localCommit = streetName === 'PRE-FLOP' ? { ...streetCommit } : {};
      // Comme à une vraie table : une mise/relance reste devant le joueur (pas encore "dans le
      // pot") tant qu'elle n'est pas suivie. Le croupier ne pousse les jetons au centre qu'au
      // moment d'un call — c'est ce qui déclenche l'ajout au pot ci-dessous, pas la mise elle-même.
      let streetPending = 0;

      if (streetName === 'FLOP') { const mb = content.match(/^\s*\[([^\]]+)\]/); if (mb) board = [...mb[1].split(' ')]; }
      if (streetName === 'TURN') { const mb = content.match(/^\s*\[[^\]]+\]\[([^\]]+)\]/); if (mb) board = [...board, mb[1]]; }
      if (streetName === 'RIVER') { const mb = content.match(/^\s*\[[^\]]+\]\[([^\]]+)\]/); if (mb) board = [...board, mb[1]]; }

      // Étape "carte(s) qui tombe(nt)" séparée de la première action : sans elle, avancer d'une
      // flèche sur le replayer affichait déjà le board ET l'action de OOP en même temps.
      if (streetName !== 'PRE-FLOP') {
        result.steps.push({ street: streetName, player: null, label: null, chipsIn: 0, potChips: pot, stacksChips: { ...stacks }, streetCommit: { ...localCommit }, board: [...board] });
      }

      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (/^\*\*\*/.test(line) || /^Dealt to/.test(line) || /^\[/.test(line)) continue;
        let m, chipsIn = 0, label = null, player = null, actionType = null;
        if ((m = line.match(/^(.+?) folds$/))) { player = m[1]; label = 'Fold'; actionType = 'fold'; }
        else if ((m = line.match(/^(.+?) checks$/))) { player = m[1]; label = 'Check'; actionType = 'check'; }
        else if ((m = line.match(/^(.+?) calls (\d+)(.*)$/))) { player = m[1]; chipsIn = +m[2]; localCommit[player] = (localCommit[player] || 0) + chipsIn; label = /all-in/.test(m[3]) ? `All-in ${chipsIn}` : `Call ${chipsIn}`; actionType = 'call'; }
        else if ((m = line.match(/^(.+?) bets (\d+)(.*)$/))) { player = m[1]; chipsIn = +m[2]; localCommit[player] = (localCommit[player] || 0) + chipsIn; label = /all-in/.test(m[3]) ? `All-in ${chipsIn}` : `Bet ${chipsIn}`; actionType = 'bet'; }
        else if ((m = line.match(/^(.+?) raises \d+ to (\d+)(.*)$/))) { player = m[1]; const total = +m[2]; chipsIn = total - (localCommit[player] || 0); localCommit[player] = total; label = /all-in/.test(m[3]) ? `All-in ${total}` : `Raise to ${total}`; actionType = 'raise'; }
        else continue;
        if (!player) continue;
        stacks[player] = (stacks[player] || 0) - chipsIn;
        if (actionType === 'call') { pot += streetPending + chipsIn; streetPending = 0; }
        else if (actionType === 'bet' || actionType === 'raise') { streetPending += chipsIn; }
        result.steps.push({ street: streetName, player, label, chipsIn, potChips: pot, stacksChips: { ...stacks }, streetCommit: { ...localCommit }, board: [...board] });
      }
    }
  } catch (e) { console.error('Erreur buildHHReplay', e); }
  return result;
}

// Reconstruit board / ligne / action par siège tels qu'ils étaient au moment de l'étape cutoffIdx (incluse).
export function applyCutoff(steps, cutoffIdx) {
  const upTo = steps.slice(0, cutoffIdx + 1);
  const last = upTo[upTo.length - 1];
  const board = last ? last.board : [];
  const currentStreet = last ? last.street : 'PRE-FLOP';
  const byStreet = {};
  upTo.forEach(e => { if (e.player) (byStreet[e.street] = byStreet[e.street] || []).push(`${e.player} ${e.label}`); });
  const ligne = ['PRE-FLOP', 'FLOP', 'TURN', 'RIVER'].filter(s => byStreet[s]).map(s => `${s}: ${byStreet[s].join(', ')}`).join(' | ');
  // Le tag d'action par siège ne montre que la street en cours : il reste affiché tant que
  // l'action n'est pas revenue au joueur, et se réinitialise dès qu'une nouvelle street commence.
  const actionByPlayer = {};
  upTo.filter(e => e.street === currentStreet && e.player).forEach(e => { actionByPlayer[e.player] = e.label; });
  return { board, ligne, actionByPlayer };
}

// Extrait tous les montants € du buy-in Winamax (2 ou 3 parties selon le format), calcule le total,
// et enrichit avec le KO minimum vu à la table si seulement 2 montants sont donnés dans la HH.
export function decomposeBuyIn(buyIn, seats) {
  if (!buyIn) return null;
  const nums = [...buyIn.matchAll(/(\d+(?:[.,]\d+)?)\s*€/g)].map(m => parseFloat(m[1].replace(',', '.')));
  if (!nums.length) return null;
  const total = +nums.reduce((a, b) => a + b, 0).toFixed(2);
  if (nums.length === 2) {
    const bounties = (seats || []).map(s => s.bounty ? parseFloat(s.bounty) : null).filter(b => b != null && !isNaN(b));
    if (bounties.length) {
      const ko = Math.min(...bounties);
      const [staking, rake] = nums;
      if (ko > 0 && ko < staking) {
        const prizePool = +(staking - ko).toFixed(2);
        return { total, parts: [ko, prizePool, rake] };
      }
    }
  }
  return { total, parts: nums };
}

export function parseWinamaxHH(text) {
  const out = {};
  try {
    const mTourn = text.match(/Tournament\s+"([^"]+)"\s+buyIn:\s*([^\n]+?)\s+level:\s*(\d+)/);
    if (mTourn) { out.tournName = mTourn[1]; out.buyIn = mTourn[2].trim(); out.palier = `Niveau ${mTourn[3]}`; }

    const mBlinds = text.match(/\((\d+)\/(\d+)\/(\d+)\)/) || text.match(/\((\d+)\/(\d+)\)/);
    let ante = 0, sb, bb;
    if (mBlinds) {
      if (mBlinds.length === 4) { ante = parseInt(mBlinds[1], 10); sb = parseInt(mBlinds[2], 10); bb = parseInt(mBlinds[3], 10); }
      else { sb = parseInt(mBlinds[1], 10); bb = parseInt(mBlinds[2], 10); }
      out.blindLevel = ante ? `${sb}/${bb} (ante ${ante})` : `${sb}/${bb}`;
    }

    out.format = /bounty/i.test(text) ? 'PKO' : 'Classic';

    const mButton = text.match(/Seat #(\d+) is the button/);
    const buttonSeat = mButton ? parseInt(mButton[1], 10) : 1;

    const seatLines = [...getSeatHeaderSection(text).matchAll(/Seat (\d+): (.+?) \(([^)]+)\)/g)];
    const n = seatLines.length;

    const mDealt = text.match(/Dealt to (.+?) \[([^\]]+)\]/);
    const heroName = mDealt ? mDealt[1] : null;
    if (mDealt) { const cards = mDealt[2].split(' '); out.heroCard1 = cards[0]; out.heroCard2 = cards[1]; }

    const showdowns = [...text.matchAll(/(.+?) shows \[([^\]]+)\]/g)];
    let villainName = null;
    for (const sd of showdowns) { if (sd[1].trim() !== heroName) { villainName = sd[1].trim(); if (sd[2]) { const c = sd[2].split(' '); out.villainCard1 = c[0]; out.villainCard2 = c[1]; } break; } }

    let seatsBase = [];
    if (n > 0 && POSITIONS_BY_COUNT[n]) {
      const labels = POSITIONS_BY_COUNT[n];
      seatsBase = seatLines.map(m => {
        const seatNum = parseInt(m[1], 10), name = m[2].trim();
        const { stack, bounty } = parseSeatParenthetical(m[3]);
        const offset = ((seatNum - buttonSeat) % n + n) % n;
        const position = labels[offset];
        const stackBB = bb ? Math.round((stack / bb) * 10) / 10 : '';
        let role = null;
        if (heroName && name === heroName) role = 'hero';
        else if (villainName && name === villainName) role = 'villain';
        if (role === 'villain' && bounty) out.koValue = bounty + '€';
        return { position, stackBB, bounty: bounty ? bounty + '€' : '', role, profile: '', dealer: seatNum === buttonSeat, name };
      });
      out.numPlayers = n;
    }

    const mPot = text.match(/Total pot (\d+)/);
    if (mPot && bb) out.potTotal = Math.round((parseInt(mPot[1], 10) / bb) * 10) / 10;

    const replay = buildHHReplay(text);
    out.seatsBase = seatsBase;
    out.replay = replay;

    if (replay.steps.length) {
      const cutoff = applyCutoff(replay.steps, replay.steps.length - 1);
      out.board = cutoff.board.join(' ');
      out.ligne = cutoff.ligne;
      out.seats = seatsBase.map(s => ({ ...s, action: cutoff.actionByPlayer[s.name] || '' }));
    } else {
      out.seats = seatsBase.map(s => ({ ...s, action: '' }));
    }
  } catch (e) { console.error('Erreur parsing HH', e); }
  return out;
}
