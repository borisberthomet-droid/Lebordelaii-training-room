"use client";

import { useEffect, useState } from "react";
import { getGeneralRanking, getSpotLeaderboard, listSpots } from "@/lib/supabase/spots";
import { ACCENT, selectStyle } from "@/lib/poker/constants";
import PageHeader from "@/components/PageHeader";
import Section from "@/components/Section";

export default function RankingPage() {
  const [generalRanking, setGeneralRanking] = useState([]);
  const [loadingGeneral, setLoadingGeneral] = useState(true);

  const [spots, setSpots] = useState([]);
  const [selectedSpotId, setSelectedSpotId] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setGeneralRanking(await getGeneralRanking(5));
      } finally {
        setLoadingGeneral(false);
      }
    })();
    (async () => {
      setSpots(await listSpots());
    })();
  }, []);

  const handleSelectSpot = async (spotId) => {
    setSelectedSpotId(spotId);
    if (!spotId) { setLeaderboard([]); return; }
    setLoadingLeaderboard(true);
    try {
      setLeaderboard(await getSpotLeaderboard(spotId));
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 520, margin: "0 auto" }}>
      <PageHeader subtitle="Classements" />

      <Section title="Classement général" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
          Ratio, minimum 5 spots joués
        </div>
        {loadingGeneral ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Chargement…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {generalRanking.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun joueur qualifié pour l&apos;instant.</div>
            )}
            {generalRanking.map((p, i) => (
              <div
                key={p.pseudo}
                style={{ display: "flex", justifyContent: "space-between", background: "var(--panel-2)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}
              >
                <span>#{i + 1} {p.pseudo}</span>
                <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", color: ACCENT }}>
                  {Number(p.ratio).toFixed(1)} pts/spot · {p.total_spots} joués
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Top 10 par spot">
        <select
          value={selectedSpotId}
          onChange={(e) => handleSelectSpot(e.target.value)}
          style={{ ...selectStyle, width: "100%", marginBottom: 10, background: "var(--panel-2)" }}
        >
          <option value="">— choisir un spot —</option>
          {spots.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>
        {loadingLeaderboard ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Chargement…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {selectedSpotId && leaderboard.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucune tentative sur ce spot pour l&apos;instant.</div>
            )}
            {leaderboard.map((e, i) => (
              <div
                key={e.pseudo + i}
                style={{ display: "flex", justifyContent: "space-between", background: "var(--panel-2)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}
              >
                <span>#{i + 1} {e.pseudo}</span>
                <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", color: ACCENT }}>{e.score} pts</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
