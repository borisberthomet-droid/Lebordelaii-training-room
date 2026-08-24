"use client";

import { useState } from "react";
import RangeGrid from "@/components/RangeGrid";
import MiniCard from "@/components/MiniCard";
import { ACCENT } from "@/lib/poker/constants";
import { parsePastedRange } from "@/lib/poker/rangeParser";
import { drawRandomHand, drawWeightedCombo, scoreAttempt } from "@/lib/poker/scoring";

export default function PracticePage() {
  const [referenceWeights, setReferenceWeights] = useState({});
  const [pasteText, setPasteText] = useState("QQ+, AKs: 1, AKo: 0.5, 76s: 0.3");

  const [heroCards, setHeroCards] = useState([]);
  const [villainKey, setVillainKey] = useState(null);
  const [playWeights, setPlayWeights] = useState({});
  const [reveal, setReveal] = useState(null);

  const hasReference = Object.values(referenceWeights).some((w) => w > 0);

  const handleImport = () => {
    setReferenceWeights(parsePastedRange(pasteText));
  };

  const drawSpot = () => {
    const hero = drawRandomHand();
    setHeroCards(hero);
    setVillainKey(drawWeightedCombo(referenceWeights, hero));
    setPlayWeights({});
    setReveal(null);
  };

  const submit = () => {
    if (!villainKey) return;
    const selected = Object.entries(playWeights).filter(([, v]) => v > 0).map(([k]) => k);
    const { found, score } = scoreAttempt(selected, referenceWeights, villainKey);
    setReveal({ found, score, villainKey, selectedCount: selected.length });
  };

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 560 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        Find It! — test du moteur (Phase 2)
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        Page de vérification, pas l&apos;UI finale. Range de référence collée
        directement au lieu d&apos;être chargée depuis un spot en base.
      </div>

      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
        Range de référence (classes ou combos, ex &quot;QQ+, AKs: 1, 76s: 0.3&quot;)
      </div>
      <textarea
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        rows={2}
        style={{
          width: "100%", background: "var(--panel)", border: "1px solid var(--border)",
          color: "var(--text)", borderRadius: 6, padding: 8, fontSize: 12,
          fontFamily: "var(--font-ibm-plex-mono), monospace", marginBottom: 8,
        }}
      />
      <button
        onClick={handleImport}
        style={{ padding: "6px 12px", background: "var(--border)", color: "var(--text)", border: "none", borderRadius: 6, fontSize: 12, marginRight: 8 }}
      >
        Importer la range
      </button>
      <button
        onClick={drawSpot}
        disabled={!hasReference}
        style={{ padding: "6px 12px", background: ACCENT, color: "#1A1918", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, opacity: hasReference ? 1 : 0.4 }}
      >
        Nouveau tirage
      </button>

      {heroCards.length === 2 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ta main (Hero) :</span>
            <MiniCard card={heroCards[0]} />
            <MiniCard card={heroCards[1]} />
          </div>

          {!reveal ? (
            <>
              <RangeGrid comboWeights={playWeights} setComboWeights={setPlayWeights} mode="play" excludedCards={heroCards} />
              <button
                onClick={submit}
                style={{ marginTop: 14, padding: "10px 18px", background: ACCENT, color: "#1A1918", border: "none", borderRadius: 6, fontWeight: 700 }}
              >
                Valider
              </button>
            </>
          ) : (
            <>
              <RangeGrid comboWeights={playWeights} setComboWeights={() => {}} mode="reveal"
                resultReveal={{ villainKey: reveal.villainKey, found: reveal.found }} excludedCards={heroCards} />
              <div style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: reveal.found ? "#6FCF97" : "#C4544A", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                  {reveal.score} pts
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  Combo vilain :
                  <MiniCard card={reveal.villainKey.slice(0, 2)} />
                  <MiniCard card={reveal.villainKey.slice(2, 4)} />
                </div>
              </div>
              <button
                onClick={drawSpot}
                style={{ marginTop: 12, padding: "8px 16px", background: "var(--border)", color: "var(--text)", border: "none", borderRadius: 6, fontSize: 13 }}
              >
                Rejouer (nouveau tirage)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
