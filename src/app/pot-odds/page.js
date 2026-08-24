"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { generateSpot, computeAnswer, QUESTION_META } from "@/lib/poker/potOdds";
import { getMyPotOddsStats, insertPotOddsAttempt } from "@/lib/supabase/potOddsAttempts";
import { PotOddsIcon } from "@/components/ToolIcons";

const TOLERANCE = 2; // points de pourcentage

const inputStyle = {
  width: 120, background: "var(--panel-2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "9px 10px", fontSize: 15,
  fontFamily: "var(--font-ibm-plex-mono), monospace", textAlign: "center",
};

const primaryButtonStyle = {
  padding: "9px 18px", background: "var(--accent-gradient)", color: "#0B1210",
  border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
};

const ghostButtonStyle = {
  padding: "9px 18px", background: "var(--panel-2)", color: "var(--text)",
  border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, cursor: "pointer",
};

export default function PotOddsPage() {
  const [spot, setSpot] = useState(null);
  const [guess, setGuess] = useState("");
  const [reveal, setReveal] = useState(null); // { correct, answer }
  const [stats, setStats] = useState({ score: 0, total_questions: 0 });

  useEffect(() => {
    setSpot(generateSpot());
    getMyPotOddsStats().then(setStats).catch(() => {});
  }, []);

  const meta = spot && QUESTION_META[spot.questionType];
  const answer = spot && computeAnswer(spot);

  const handleValidate = () => {
    const g = parseFloat(guess.replace(",", "."));
    if (isNaN(g)) return;
    const correct = Math.abs(g - answer) <= TOLERANCE;
    setReveal({ correct, answer });
    setStats((s) => ({ ...s, score: s.score + (correct ? 1 : -1), total_questions: s.total_questions + 1 }));
    insertPotOddsAttempt({ questionType: spot.questionType, correct }).catch(() => {});
  };

  const handleNext = () => {
    setSpot(generateSpot());
    setGuess("");
    setReveal(null);
  };

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PotOddsIcon size={22} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>
            Pot Odds
          </span>
          <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Bet &amp; raise river</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 12, fontFamily: "var(--font-ibm-plex-mono), monospace", color: stats.score >= 0 ? "var(--accent)" : "#E0645A" }}>
            {stats.score >= 0 ? "+" : ""}{stats.score} pts
          </span>
          <Link href="/pot-odds/ranking" style={{ fontSize: 12, color: "var(--text-muted)" }}>Classement</Link>
          <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
        </div>
      </div>

      {!spot ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Génération d&apos;une situation…</div>
      ) : (
        <>
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 3, height: 14, borderRadius: 2, background: "var(--accent-gradient)", display: "inline-block" }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</span>
            </div>

            <div style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 8 }}>{meta.prompt(spot)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20 }}>{meta.hint}</div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                type="text" inputMode="decimal" placeholder="%" value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !reveal && handleValidate()}
                disabled={!!reveal}
                style={{ ...inputStyle, opacity: reveal ? 0.6 : 1 }}
              />
              {!reveal ? (
                <button onClick={handleValidate} style={primaryButtonStyle} disabled={!guess.trim()}>Valider</button>
              ) : (
                <button onClick={handleNext} style={primaryButtonStyle}>Situation suivante →</button>
              )}
            </div>

            {reveal && (
              <div style={{
                marginTop: 16, padding: "12px 14px", borderRadius: 10,
                background: reveal.correct ? "rgba(52,211,153,0.12)" : "rgba(224,100,90,0.12)",
                border: `1px solid ${reveal.correct ? "rgba(52,211,153,0.35)" : "rgba(224,100,90,0.35)"}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: reveal.correct ? "#34D399" : "#E0645A", marginBottom: 4 }}>
                  {reveal.correct ? "✓ Correct" : `✗ Réponse : ${reveal.answer.toFixed(1)}%`}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                  {meta.formula(spot, reveal.answer)}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleNext} style={{ ...ghostButtonStyle, width: "100%" }}>
            Passer cette situation
          </button>
        </>
      )}
    </div>
  );
}
