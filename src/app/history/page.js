"use client";

import { useEffect, useState } from "react";
import { getMyAttempts } from "@/lib/supabase/spots";
import { ACCENT } from "@/lib/poker/constants";
import PageHeader from "@/components/PageHeader";

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setHistory(await getMyAttempts());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const total = history.length;
  const avg = total ? Math.round(history.reduce((a, h) => a + h.score, 0) / total) : 0;
  const best = total ? Math.max(...history.map((h) => h.score)) : 0;

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 560, margin: "0 auto" }}>
      <PageHeader subtitle="Mon historique" />

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chargement…</div>
      ) : total === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Aucune tentative enregistrée pour l&apos;instant — joue un spot pour commencer ton historique.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{total}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>spots joués</div>
            </div>
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{avg}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>score moyen</div>
            </div>
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#6FCF97", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{best}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>meilleur score</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {history.map((h) => (
              <div
                key={h.id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", fontSize: 12 }}
              >
                <div>
                  <div style={{ color: "var(--text)" }}>{h.spots?.nom || "Spot"}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {h.spots?.mode === "exploit" ? "Exploit" : "Théorique"} · {new Date(h.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontWeight: 700, color: h.found ? "#6FCF97" : "#C4544A" }}>
                  {h.score} pts
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
