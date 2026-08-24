"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPotOddsRanking } from "@/lib/supabase/potOddsAttempts";
import { ACCENT } from "@/lib/poker/constants";
import { PotOddsIcon } from "@/components/ToolIcons";

const MIN_QUESTIONS = 10;

export default function PotOddsRankingPage() {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setRanking(await getPotOddsRanking(MIN_QUESTIONS));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 520, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PotOddsIcon size={22} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>Pot Odds</span>
          <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Classement</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/pot-odds" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Pot Odds</Link>
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 3, height: 14, borderRadius: 2, background: "var(--accent-gradient)", display: "inline-block" }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Classement par précision</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
          % de bonnes réponses, minimum {MIN_QUESTIONS} questions répondues
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Chargement…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {ranking.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun joueur qualifié pour l&apos;instant.</div>
            )}
            {ranking.map((p, i) => (
              <div
                key={p.pseudo}
                style={{ display: "flex", justifyContent: "space-between", background: "var(--panel-2)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}
              >
                <span>#{i + 1} {p.pseudo}</span>
                <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", color: ACCENT }}>
                  {(Number(p.accuracy) * 100).toFixed(0)}% · {p.score >= 0 ? "+" : ""}{p.score} pts · {p.total_questions} jouées
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
