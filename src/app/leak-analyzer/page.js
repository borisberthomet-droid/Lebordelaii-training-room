"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Section from "@/components/Section";
import { LeakAnalyzerIcon } from "@/components/ToolIcons";
import { ACCENT, ACCENT_GRADIENT } from "@/lib/poker/constants";

const VERDICT_STYLE = {
  aligné: { label: "Aligné", color: "#34D399", bg: "rgba(52,211,153,0.12)" },
  leak_mineur: { label: "Leak mineur", color: "#E8C547", bg: "rgba(232,197,71,0.12)" },
  leak_majeur: { label: "Leak majeur", color: "#E0645A", bg: "rgba(224,100,90,0.14)" },
  non_couvert: { label: "Non couvert", color: "#8E968F", bg: "rgba(142,150,143,0.1)" },
};

function VerdictBadge({ verdict }) {
  const s = VERDICT_STYLE[verdict] || VERDICT_STYLE.non_couvert;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 999, padding: "2px 9px" }}>
      {s.label}
    </span>
  );
}

function DecisionRow({ dec }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12 }}>
          {dec.heroClass && <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", color: ACCENT, marginRight: 8 }}>{dec.heroClass}</span>}
          <span style={{ color: "var(--text-muted)" }}>vs {dec.villain || "?"} — joué : </span>
          <span>{dec.action}</span>
        </div>
        <VerdictBadge verdict={dec.verdict} />
      </div>
      {dec.verdict === "non_couvert" && (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{dec.reason}</div>
      )}
      {dec.strategy && (
        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--text-muted)" }}>
          {Object.entries(dec.strategy).map(([action, freq]) => (
            <span key={action}>
              {action} : <span style={{ color: "var(--text)" }}>{(freq * 100).toFixed(1)}%</span>
            </span>
          ))}
          <span style={{ marginLeft: "auto" }}>
            {dec.mode === "hu-icm" ? "solve exact (ICM)" : "solve exact (chip-EV)"}
          </span>
        </div>
      )}
    </div>
  );
}

export default function LeakAnalyzerPage() {
  const [heroLogin, setHeroLogin] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("winamax_pseudo");
    if (saved) setHeroLogin(saved);
  }, []);

  const handleAnalyze = async () => {
    setError(null);
    setResult(null);
    if (!heroLogin.trim()) { setError("Indique ton pseudo Winamax."); return; }
    if (!link.trim()) { setError("Colle un lien replayer Winamax."); return; }
    localStorage.setItem("winamax_pseudo", heroLogin.trim());

    setLoading(true);
    try {
      const res = await fetch("/api/analyze-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link, heroLogin: heroLogin.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur inconnue"); return; }
      setResult(data);
    } catch (e) {
      setError("Impossible de contacter le serveur : " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handsWithDecisions = result?.hands?.filter(h => h.decisions?.length) || [];

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 780, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LeakAnalyzerIcon size={22} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>Leak Analyzer</span>
          <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Analyseur de leaks (préflop)</span>
        </div>
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
      </div>

      <Section title="Nouvelle analyse">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Pseudo Winamax (configuré une fois)
            </label>
            <input
              value={heroLogin}
              onChange={(e) => setHeroLogin(e.target.value)}
              placeholder="ton pseudo Winamax"
              style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Lien replayer Winamax
            </label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://www.winamax.fr/replayer/replayer.html?..."
              style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-ibm-plex-mono), monospace" }}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              alignSelf: "flex-start", padding: "8px 16px",
              background: loading ? "var(--border)" : ACCENT_GRADIENT,
              color: loading ? "var(--text-muted)" : "#0B1210",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Analyse en cours (peut prendre 1-2 min)…" : "Analyser la session"}
          </button>
          {error && <div style={{ fontSize: 12, color: "#E0645A" }}>{error}</div>}
        </div>
      </Section>

      {result && (
        <>
          <Section title="Résumé de session">
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
              <span>{result.totalHands} mains dans la session</span>
              <span>{result.analyzedHands} avec une décision préflop de {result.heroLogin}</span>
              <span style={{ color: VERDICT_STYLE.aligné.color }}>{result.counts.aligné || 0} alignées</span>
              <span style={{ color: VERDICT_STYLE.leak_mineur.color }}>{result.counts.leak_mineur || 0} leaks mineurs</span>
              <span style={{ color: VERDICT_STYLE.leak_majeur.color }}>{result.counts.leak_majeur || 0} leaks majeurs</span>
              <span style={{ color: VERDICT_STYLE.non_couvert.color }}>{result.counts.non_couvert || 0} non couvertes (multiway)</span>
            </div>
          </Section>

          <Section title={`Détail (${handsWithDecisions.length} mains)`}>
            {handsWithDecisions.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucune décision préflop détectée pour ce pseudo dans cette session.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {handsWithDecisions.map((h) => (
                <div key={h.handId}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                    {h.ligne}
                  </div>
                  {h.decisions.map((dec, i) => <DecisionRow key={i} dec={dec} />)}
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
