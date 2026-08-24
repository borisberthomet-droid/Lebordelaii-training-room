"use client";

import { useState } from "react";
import Replayer from "@/components/Replayer";
import { ACCENT } from "@/lib/poker/constants";
import { parseWinamaxHH } from "@/lib/poker/hhParser";

const SAMPLE_HH = `Winamax Poker - Tournament "Kill The Fish" buyIn: 4.50€ + 0.50€ level: 8 - HandId: #123456789-1234-1700000000 - Holdem no limit (400/800/800) - 2024/01/15 20:30:00 UTC
Table: 'Tournament(123456789)#1' 9-max (real money) Seat #3 is the button
Seat 1: PlayerA (25000, 1000 bounty)
Seat 2: PlayerB (18000, 500 bounty)
Seat 3: PlayerC (32000, 500 bounty)
Seat 4: Hero (20000)
Seat 5: PlayerE (15000)
Seat 6: PlayerF (22000)
*** ANTE/BLINDS ***
PlayerE posts small blind 400
PlayerF posts big blind 800
Dealt to Hero [Qc Qd]
*** PRE-FLOP ***
PlayerA folds
PlayerB raises 800 to 1600
PlayerC folds
Hero raises 1600 to 4800
PlayerE folds
PlayerF folds
PlayerB calls 3200
*** FLOP *** [7h 4s 2d]
PlayerB checks
Hero bets 4000
PlayerB calls 4000
*** TURN *** [7h 4s 2d][9c]
PlayerB checks
Hero bets 8000
PlayerB raises 8000 to 16000
Hero calls 3600 and is all-in
*** RIVER *** [7h 4s 2d 9c][2h]
*** SHOW DOWN ***
Hero shows [Qc Qd]
PlayerB shows [As Kd]
Hero collected 41800 with a pair of Queens
*** SUMMARY ***
Total pot 41800 | No rake
Board: [7h 4s 2d 9c 2h]
Seat 1: PlayerA folded before Flop
Seat 2: PlayerB (big blind) showed [As Kd] and lost
Seat 3: PlayerC folded before Flop
Seat 4: Hero showed [Qc Qd] and won 41800
Seat 5: PlayerE (small blind) folded before Flop
Seat 6: PlayerF folded before Flop`;

export default function HHTestPage() {
  const [hhText, setHhText] = useState(SAMPLE_HH);
  const [parsed, setParsed] = useState(null);

  const handleAnalyze = () => {
    setParsed(parseWinamaxHH(hhText));
  };

  const spot = parsed
    ? {
        board: parsed.board,
        ligne: parsed.ligne,
        blindLevel: parsed.blindLevel,
        potTotal: parsed.potTotal,
        seats: parsed.seats,
        replay: parsed.replay,
      }
    : null;

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 720 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        Find It! — test du parseur HH (Phase 3)
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        Page de vérification. Colle une hand history Winamax, ou utilise l&apos;exemple pré-rempli.
      </div>

      <textarea
        value={hhText}
        onChange={(e) => setHhText(e.target.value)}
        rows={8}
        style={{
          width: "100%", background: "var(--panel)", border: "1px solid var(--border)",
          color: "var(--text)", borderRadius: 6, padding: 8, fontSize: 11,
          fontFamily: "var(--font-ibm-plex-mono), monospace", marginBottom: 8,
        }}
      />
      <button
        onClick={handleAnalyze}
        style={{ padding: "6px 12px", background: ACCENT, color: "#1A1918", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600 }}
      >
        Analyser la Hand History
      </button>

      {parsed && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <span>Hero : <span style={{ color: "var(--text)" }}>{parsed.heroCard1} {parsed.heroCard2}</span></span>
            <span>Vilain détecté : <span style={{ color: "var(--text)" }}>{parsed.villainCard1} {parsed.villainCard2}</span></span>
            <span>Joueurs : <span style={{ color: "var(--text)" }}>{parsed.numPlayers}</span></span>
            <span>KO vilain : <span style={{ color: "var(--text)" }}>{parsed.koValue || "—"}</span></span>
            <span>Format : <span style={{ color: "var(--text)" }}>{parsed.format}</span></span>
            <span>Buy-in : <span style={{ color: "var(--text)" }}>{parsed.buyIn}</span></span>
          </div>

          <Replayer spot={spot} />
        </div>
      )}
    </div>
  );
}
