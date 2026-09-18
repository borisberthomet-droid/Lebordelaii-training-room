"use client";

import { useMemo, useState } from "react";
import TableView from "./TableView";
import { ACCENT } from "@/lib/poker/constants";
import { POSITIONS, buildSteps, stateAtStep, visibleBoardCount } from "@/lib/poker/solvedReplay";

// Replayer pour les spots issus d'une sim résolue, sur le modèle de celui de Find It mais nourri
// par la séquence HRC plutôt que par une hand history. Il avance étape par étape — la carte qui
// tombe, puis chaque action l'une après l'autre — et recalcule à chaque étape les stacks, le pot,
// les mises posées et le board visible. La logique vit dans lib/poker/solvedReplay.js, vérifiée
// sur tous les spots publiés.

const STREETS = ["PRÉFLOP", "FLOP", "TURN", "RIVER"];

export default function SolvedReplayer({ spot, meta, heroCards }) {
  const sequence = useMemo(() => spot.sequence || [], [spot]);
  const steps = useMemo(() => buildSteps(sequence, spot.street), [sequence, spot.street]);
  const last = steps.length - 1;

  // L'étape est rattachée au spot : quand la page passe au spot suivant sans remonter le
  // composant, on repart sur la décision au lieu de garder une étape d'un autre coup — qui pouvait
  // tomber hors de la nouvelle séquence.
  const spotKey = `${spot.id}|${spot.board.join("")}|${sequence.length}`;
  const [nav, setNav] = useState({ spotKey, k: last });
  const k = nav.spotKey === spotKey ? Math.min(nav.k, last) : last; // ouvre sur la décision à prendre
  const goTo = (next) => setNav({ spotKey, k: Math.max(0, Math.min(last, next)) });

  const startBB = meta.effectiveBB;
  const state = stateAtStep(sequence, steps[k], {
    // meta.stacks existe quand les tapis different d'un siege a l'autre (ante de big blind).
    startBB: meta.stacks || startBB,
    bbBB: 1, sbBB: meta.blinds.sb / meta.blinds.bb, anteBB: meta.blinds.ante / meta.blinds.bb,
    anteType: meta.blinds.anteType,
  });
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

  const streetsPresent = [...new Set(steps.map((s) => s.street))];
  // Un bouton de street mène à la carte qui tombe, pas à la première action : même règle que
  // l'avance pas à pas. Préflop mène aux blinds postées.
  const jumpTo = (s) => {
    const i = steps.findIndex((st) => st.street === s);
    if (i >= 0) goTo(i);
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
        <button onClick={() => goTo(k - 1)} disabled={k <= 0} style={navBtn(k <= 0)}>←</button>
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
        <button onClick={() => goTo(k + 1)} disabled={k >= last} style={navBtn(k >= last)}>→</button>
        <button onClick={() => goTo(last)} disabled={k >= last}
          style={{ ...navBtn(k >= last), fontSize: 10, padding: "6px 10px" }}>
          à toi de jouer
        </button>
      </div>
    </>
  );
}
