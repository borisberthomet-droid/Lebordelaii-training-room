"use client";

import { useState } from "react";
import TableView from "./TableView";
import { ACCENT } from "@/lib/poker/constants";
import { applyCutoff } from "@/lib/poker/hhParser";

const STREETS = ['PRE-FLOP', 'FLOP', 'TURN', 'RIVER'];

// Navigation action par action (flèches + onglets par street) sur un spot avec replay.
// Sans replay, affiche juste la table + la ligne de jeu en texte (spot manuel, sans HH importée).
export default function Replayer({ spot, heroCardsOverride }) {
  const steps = (spot.replay && spot.replay.steps) || [];
  const hasReplay = steps.length > 0;
  const [idx, setIdx] = useState(hasReplay ? -1 : null);

  if (!hasReplay) {
    return (
      <>
        <TableView spot={spot} heroCardsOverride={heroCardsOverride} />
        <div style={{ background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: '8px 10px', marginBottom: 14, fontSize: 12, color: '#ECEEF1', fontStyle: 'italic' }}>
          {spot.ligne || 'Ligne de jeu non renseignée.'}
        </div>
      </>
    );
  }

  const maxIdx = steps.length - 1;
  const bb = spot.replay.bb;
  const current = idx >= 0 ? steps[idx] : null;
  const stacksChips = current ? current.stacksChips : spot.replay.initialStacks;
  const potChips = current ? current.potChips : spot.replay.initialPot;
  const cutoff = idx >= 0 ? applyCutoff(steps, idx) : { board: [], ligne: '', actionByPlayer: {} };

  const liveSeats = (spot.seats || []).map(s => ({
    ...s,
    stackBB: bb ? Math.round(((stacksChips[s.name] ?? 0) / bb) * 10) / 10 : s.stackBB,
    stackChips: stacksChips[s.name] ?? null,
    action: cutoff.actionByPlayer[s.name] || '',
  }));
  const liveSpot = { ...spot, seats: liveSeats, board: cutoff.board.join(' '), potTotal: bb ? Math.round((potChips / bb) * 10) / 10 : spot.potTotal };

  const streetCommit = current ? current.streetCommit : spot.replay.initialStreetCommit;
  const betsBB = {};
  if (bb && streetCommit) {
    Object.entries(streetCommit).forEach(([name, amount]) => {
      if (amount > 0) betsBB[name] = Math.round((amount / bb) * 10) / 10;
    });
  }

  const streetsPresent = [...new Set(steps.map(s => s.street))];
  const jumpToStreet = (street) => { const i = steps.findIndex(s => s.street === street); if (i >= 0) setIdx(i); };

  return (
    <>
      <TableView spot={liveSpot} heroCardsOverride={heroCardsOverride} bets={betsBB} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
        <button onClick={() => setIdx(i => Math.max(-1, i - 1))} disabled={idx <= -1}
          style={{ padding: '6px 12px', background: idx <= -1 ? '#211F1D' : '#302D2A', color: '#ECEEF1', border: '1px solid #302D2A', borderRadius: 6, opacity: idx <= -1 ? 0.4 : 1 }}>←</button>
        {STREETS.map(s => (
          <button key={s} disabled={!streetsPresent.includes(s)} onClick={() => jumpToStreet(s)}
            style={{ padding: '5px 9px', fontSize: 10, background: current && current.street === s ? ACCENT : '#211F1D', color: current && current.street === s ? '#1A1918' : '#ECEEF1', border: '1px solid #302D2A', borderRadius: 6, opacity: streetsPresent.includes(s) ? 1 : 0.3 }}>
            {s}
          </button>
        ))}
        <button onClick={() => setIdx(i => Math.min(maxIdx, i + 1))} disabled={idx >= maxIdx}
          style={{ padding: '6px 12px', background: idx >= maxIdx ? '#211F1D' : '#302D2A', color: '#ECEEF1', border: '1px solid #302D2A', borderRadius: 6, opacity: idx >= maxIdx ? 0.4 : 1 }}>→</button>
      </div>
      {!current && (
        <div style={{ background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: '8px 10px', marginBottom: 14, fontSize: 12, color: '#9C9691', fontStyle: 'italic', textAlign: 'center' }}>
          Avant l&apos;action (mains distribuées)
        </div>
      )}
    </>
  );
}
