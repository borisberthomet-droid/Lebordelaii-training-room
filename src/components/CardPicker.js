import { RANKS, SUITS, SUIT_SYMBOL, selectStyle } from "@/lib/poker/constants";

export default function CardPicker({ card, onChange }) {
  const rank = card ? card[0] : 'A';
  const suit = card ? card[1] : 's';
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <select value={rank} onChange={e => onChange(e.target.value + suit)} style={selectStyle}>
        {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <select value={suit} onChange={e => onChange(rank + e.target.value)} style={selectStyle}>
        {SUITS.map(s => <option key={s} value={s}>{SUIT_SYMBOL[s]}</option>)}
      </select>
    </div>
  );
}
