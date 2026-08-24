import { SUIT_COLOR, SUIT_SYMBOL } from "@/lib/poker/constants";

export default function MiniCard({ card }) {
  const rank = card[0], suit = card[1];
  return (
    <div style={{ background: '#0F1216', border: '1px solid #302D2A', borderRadius: 4, padding: '3px 6px', fontSize: 13, fontFamily: "var(--font-ibm-plex-mono), monospace", color: SUIT_COLOR[suit], fontWeight: 600 }}>
      {rank}{SUIT_SYMBOL[suit]}
    </div>
  );
}
