"use client";

import { useState } from "react";
import TableView from "./TableView";
import { ACCENT } from "@/lib/poker/constants";

// Replayer pour les spots issus d'une sim résolue, sur le modèle de celui de Find It mais nourri
// par la séquence HRC plutôt que par une hand history. Il rejoue l'action coup par coup et
// recalcule à chaque étape les stacks, le pot, les mises posées et le board visible.

const POSITIONS = ["UTG", "HJ", "CO", "BU", "SB", "BB"];
const STREETS = ["PRÉFLOP", "FLOP", "TURN", "RIVER"];

// Nombre de cartes du board visibles selon la street en cours.
function visibleBoardCount(street) {
  return street >= 3 ? 5 : street === 2 ? 4 : street === 1 ? 3 : 0;
}

// Rejoue la séquence jusqu'à `idx` inclus (−1 = avant toute action, blinds et antes déjà postées).
//
// Conventions HRC, à ne pas confondre : une relance donne le TOTAL engagé sur la street, un call
// donne le montant ADDITIONNEL. Prendre l'un pour l'autre fausse le pot et donc les cotes.
function replayTo(sequence, idx, { startBB, sbBB, bbBB, anteBB }) {
  const total = {}, street = {}, action = {};
  for (const p of POSITIONS) { total[p] = anteBB; street[p] = 0; }
  total.SB += sbBB; street.SB = sbBB;
  total.BB += bbBB; street.BB = bbBB;

  let currentStreet = 0;
  for (let i = 0; i <= idx && i < sequence.length; i++) {
    const a = sequence[i];
    if (a.street !== currentStreet) {
      for (const p of POSITIONS) street[p] = 0;
      for (const k of Object.keys(action)) delete action[k];
      currentStreet = a.street;
    }
    let delta = 0;
    if (a.type === "R") { delta = a.amountBB - street[a.pos]; street[a.pos] = a.amountBB; }
    else if (a.type === "C") { delta = a.amountBB; street[a.pos] += delta; }
    total[a.pos] += delta;
    action[a.pos] = a.type === "F" ? "fold"
      : a.type === "X" ? "check"
      : a.type === "C" ? "call"
      : `bet ${a.amountBB}`;
  }

  const pot = POSITIONS.reduce((sum, p) => sum + total[p], 0);
  return {
    stacks: Object.fromEntries(POSITIONS.map((p) => [p, +(startBB - total[p]).toFixed(1)])),
    bets: Object.fromEntries(POSITIONS.filter((p) => street[p] > 0).map((p) => [p, +street[p].toFixed(1)])),
    action, pot: +pot.toFixed(2), street: currentStreet,
  };
}

export default function SolvedReplayer({ spot, meta, heroCards }) {
  const sequence = spot.sequence || [];
  const [idx, setIdx] = useState(sequence.length - 1); // ouvre sur la décision à prendre
  const startBB = meta.effectiveBB;
  const bbBB = 1;
  const sbBB = meta.blinds.sb / meta.blinds.bb;
  const anteBB = meta.blinds.ante / meta.blinds.bb;

  const state = replayTo(sequence, idx, { startBB, sbBB, bbBB, anteBB });
  const shown = spot.board.slice(0, visibleBoardCount(state.street));

  const seats = POSITIONS.map((p) => ({
    name: p, position: p,
    stackBB: state.stacks[p],
    // Un stack retombé à zéro veut dire tapis : le dire explicitement évite de laisser croire
    // qu'il reste des jetons derrière, ce qui change la lecture du spot.
    action: state.stacks[p] <= 0.05 && state.action[p] ? `${state.action[p]} (tapis)` : (state.action[p] || ""),
    dealer: p === "BU",
    // Le défenseur est « hero » : c'est lui dont on situe la main, quel que soit le mode.
    role: p === spot.heroPos ? "hero" : p === spot.villainPos ? "villain" : undefined,
  }));

  const streetsPresent = [...new Set(sequence.map((a) => a.street))];
  const jumpTo = (s) => {
    const i = sequence.findIndex((a) => a.street === s);
    if (i >= 0) setIdx(i);
  };

  const navBtn = (disabled) => ({
    padding: "6px 12px", background: disabled ? "#211F1D" : "#302D2A", color: "#ECEEF1",
    border: "1px solid #302D2A", borderRadius: 6, opacity: disabled ? 0.4 : 1,
    cursor: disabled ? "default" : "pointer",
  });

  return (
    <>
      <TableView
        spot={{
          board: shown.join(" "),
          seats,
          potTotal: state.pot,
          blindLevel: `${meta.blinds.sb}/${meta.blinds.bb} (ante ${meta.blinds.ante})`,
          averageBB: startBB,
        }}
        heroCardsOverride={heroCards}
        bets={state.bets}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setIdx((i) => Math.max(-1, i - 1))} disabled={idx <= -1} style={navBtn(idx <= -1)}>←</button>
        {STREETS.map((label, s) => (
          <button key={label} disabled={!streetsPresent.includes(s)} onClick={() => jumpTo(s)}
            style={{
              padding: "5px 9px", fontSize: 10, borderRadius: 6, border: "1px solid #302D2A",
              background: state.street === s ? ACCENT : "#211F1D",
              color: state.street === s ? "#1A1918" : "#ECEEF1",
              opacity: streetsPresent.includes(s) ? 1 : 0.3,
              cursor: streetsPresent.includes(s) ? "pointer" : "default",
            }}>
            {label}
          </button>
        ))}
        <button onClick={() => setIdx((i) => Math.min(sequence.length - 1, i + 1))}
          disabled={idx >= sequence.length - 1} style={navBtn(idx >= sequence.length - 1)}>→</button>
        <button onClick={() => setIdx(sequence.length - 1)} disabled={idx >= sequence.length - 1}
          style={{ ...navBtn(idx >= sequence.length - 1), fontSize: 10, padding: "6px 10px" }}>
          à toi de jouer
        </button>
      </div>
    </>
  );
}
