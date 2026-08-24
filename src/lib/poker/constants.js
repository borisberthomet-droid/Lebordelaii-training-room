export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS = ['s', 'h', 'd', 'c'];
export const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_COLOR = { s: '#ECEEF1', c: '#6FCF97', h: '#E0645A', d: '#4FA8E0' };

export const MOMENT_OPTIONS = [
  '100% restants', '75% restants', '50% restants', '25% restants',
  '18% restants', '16% restants', 'Proche bulle', '10% restants',
  '5% restants', '3 tables', '2 tables', 'Table finale',
];

export const ACCENT = '#34D399';
export const ACCENT_RGB = '52,211,153';
export const ACCENT_GRADIENT = 'linear-gradient(135deg, #4ADE80 0%, #059669 100%)';
export const ACCENT_DARK = '#059669';

export const BG = '#121413';
export const PANEL = '#1A1D1B';
export const BORDER = '#272B28';
export const TEXT_MUTED = '#8E968F';

export const selectStyle = {
  background: PANEL, borderWidth: 1, borderStyle: 'solid', borderColor: BORDER, color: '#ECEEF1',
  borderRadius: 6, padding: '5px 6px', fontSize: 12,
};

// Positions dans l'ordre horaire en partant du bouton (offset 0 = BTN)
export const POSITIONS_BY_COUNT = {
  2: ['BTN/SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO'],
};

export const PROFILE_OPTIONS = ['ELITE', 'REG AGGRO', 'AVG REG', 'REG TIGHT', 'RECREA', 'BALEINE', 'GTO'];
export const PROFILE_COLORS = {
  'ELITE': '#E0645A', 'REG AGGRO': '#E8C547', 'AVG REG': '#9C9691', 'REG TIGHT': '#4FA8E0',
  'RECREA': '#2F6B4F', 'BALEINE': '#39FF6A', 'GTO': '#FFFFFF',
};

export function generateSeats(n) {
  const labels = POSITIONS_BY_COUNT[n] || POSITIONS_BY_COUNT[6];
  return labels.map((position, i) => ({ position, stackBB: '', action: '', bounty: '', role: null, profile: '', dealer: i === 0 }));
}

function seatCoords(i, n) {
  const angle = Math.PI / 2 + (i * 2 * Math.PI / n);
  const rx = 48, ry = 47;
  return { left: 50 + rx * Math.cos(angle), top: 50 + ry * Math.sin(angle) };
}

export function getSeatPos(i, n) {
  const c = seatCoords(i, n);
  return { left: `${c.left}%`, top: `${c.top}%` };
}

// Position d'un jeton de mise, interpolée entre le siège et le centre de la table.
// Anneau à rayon FIXE (indépendant de la distance du siège) : garantit que le jeton
// reste toujours hors de la zone du board (max 5 cartes), quel que soit le nombre de joueurs.
export function getChipPos(i, n) {
  const angle = Math.PI / 2 + (i * 2 * Math.PI / n);
  const rx = 30, ry = 28;
  return { left: `${50 + rx * Math.cos(angle)}%`, top: `${50 + ry * Math.sin(angle)}%` };
}
