"use client";

import { useMemo, useState } from "react";
import MiniCard from "@/components/MiniCard";
import { CATEGORIES, categorize, categoryLabel, handClass } from "@/lib/poker/handCategory";
import { mdfForSize, orderByStrength, pivotAt } from "@/lib/poker/pivot";

// Molette de la main charnière : on fait varier la taille de mise, la MDF suit, et la charnière se
// déplace dans la range du défenseur rangée par force de main. Demandée par Boris pour voir, en
// bluff, quelle main l'adversaire doit encore payer à chaque taille.

const STOPS = [10, 15, 20, 25, 33, 40, 50, 60, 66, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300];
const MONO = "var(--font-ibm-plex-mono), monospace";

export default function PivotDial({ combos, board, playedSizePct, pos }) {
  const ordered = useMemo(
    () => orderByStrength(combos, board).map((c) => ({
      ...c, cat: categorize([c.key.slice(0, 2), c.key.slice(2, 4)], board),
    })),
    [combos, board]
  );

  // La taille jouée devient un cran de la molette ; les crans standard trop proches d'elle sont
  // retirés, sinon deux positions voisines afficheraient presque la même chose.
  const stops = useMemo(
    () => [...STOPS.filter((s) => Math.abs(s - playedSizePct) > 2), playedSizePct].sort((a, b) => a - b),
    [playedSizePct]
  );
  const playedIdx = stops.indexOf(playedSizePct);
  const [idx, setIdx] = useState(playedIdx);

  // Tronçons consécutifs de même catégorie, pour dessiner la range sans un bloc par combo.
  const runs = useMemo(() => {
    const out = [];
    for (const c of ordered) {
      const last = out[out.length - 1];
      if (last && last.cat === c.cat) last.end = c.end;
      else out.push({ cat: c.cat, start: c.start, end: c.end });
    }
    return out;
  }, [ordered]);

  const size = stops[idx];
  const mdf = mdfForSize(size);
  const playedMdf = mdfForSize(playedSizePct);
  const pivot = pivotAt(ordered, mdf);
  const pivotCat = CATEGORIES.find((c) => c.id === pivot.cat);
  const fmt = (s) => `${Math.round(s)}%`;

  return (
    <div style={{ marginTop: 18, background: "var(--panel-2)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Main charnière de {pos}</span>
        <button onClick={() => setIdx(playedIdx)} disabled={idx === playedIdx} style={{
          padding: "5px 10px", borderRadius: 999, fontSize: 11,
          border: "1px solid var(--border)", background: "var(--panel)",
          color: idx === playedIdx ? "var(--text-muted)" : "var(--text)",
          cursor: idx === playedIdx ? "default" : "pointer",
        }}>
          Taille jouée ({fmt(playedSizePct)})
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ta mise</span>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: MONO }}>{fmt(size)}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>du pot → MDF</span>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: MONO, color: "var(--accent)" }}>
          {(mdf * 100).toFixed(0)}%
        </span>
      </div>
      <input
        type="range" min={0} max={stops.length - 1} step={1} value={idx}
        onChange={(e) => setIdx(Number(e.target.value))}
        aria-label="Taille de mise"
        style={{ width: "100%", accentColor: "#34D399", margin: "6px 0 14px" }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Il doit encore payer jusqu&apos;à</span>
        <span style={{ display: "flex", gap: 4 }}>
          <MiniCard card={pivot.key.slice(0, 2)} />
          <MiniCard card={pivot.key.slice(2, 4)} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO }}>{handClass([pivot.key.slice(0, 2), pivot.key.slice(2, 4)])}</span>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 999,
          background: `color-mix(in srgb, ${pivotCat.color} 22%, transparent)`, color: pivotCat.color,
        }}>
          {categoryLabel(pivotCat, board)}
        </span>
      </div>

      {/* La range entière, de la plus forte à la plus faible. Le curseur marque la MDF : à gauche
          ce qu'il doit continuer, à droite ce qu'il peut coucher. Le petit repère sous la barre
          garde la position de la taille jouée, pour voir de combien la charnière a bougé. */}
      <div style={{ position: "relative", height: 22, borderRadius: 5, overflow: "hidden", display: "flex" }}>
        {runs.map((r, i) => {
          const cat = CATEGORIES.find((c) => c.id === r.cat);
          return (
            <div key={i} title={categoryLabel(cat, board)}
              style={{ width: `${(r.end - r.start) * 100}%`, background: cat.color }} />
          );
        })}
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `${mdf * 100}%`, right: 0,
          background: "rgba(11,18,16,0.62)",
        }} />
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `calc(${mdf * 100}% - 1px)`, width: 2,
          background: "#ECEEF1",
        }} />
      </div>
      <div style={{ position: "relative", height: 10 }}>
        <div title="Taille jouée" style={{
          position: "absolute", top: 2, left: `calc(${playedMdf * 100}% - 4px)`,
          width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent",
          borderBottom: "6px solid var(--text-muted)",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 10 }}>
        <span>plus forte</span>
        <span>plus faible</span>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.7 }}>
        À {fmt(size)} du pot, {pos} doit continuer avec {(mdf * 100).toFixed(0)}% de sa range. Un bluff
        pur rapporte immédiatement, en jetons, s&apos;il se couche plus de {((1 - mdf) * 100).toFixed(0)}% du
        temps — c&apos;est-à-dire s&apos;il couche des mains au-dessus de la charnière. Range rangée par
        force de main sur le board, tirages non comptés.
      </div>
    </div>
  );
}
