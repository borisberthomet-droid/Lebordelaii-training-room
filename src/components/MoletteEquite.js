"use client";

import { useMemo, useState } from "react";
import MiniCard from "@/components/MiniCard";
import { CATEGORIES, categoryLabel, handClass } from "@/lib/poker/handCategory";
import { ordonnerParEquite, tronconsParCategorie } from "@/lib/poker/ordreRange";

// Molette d'équité : on glisse le long de l'équité et on lit quel combo de sa range correspond,
// où il se situe dans la range, et jusqu'à quelle taille il reste de la value.
//
// Demandée par Boris pour l'exercice de value : « je peux glisser entre 75% et 85% d'équité pour
// voir quels sont les combos charnières ». C'est le lien qui manque entre trois choses qu'on
// apprend séparément — l'équité d'une main, sa place dans la range, et la taille qu'elle supporte.

const MONO = "var(--font-ibm-plex-mono), monospace";

// Taille maximale qui reste de la value, en part du pot, pour une équité donnée contre la range
// globale : au-delà, la range de défense qui reste devant est meilleure que nous.
function tailleMaxValue(equite) {
  if (equite <= 0.5) return null;
  return 1 / (2 * (1 - equite)) - 1;
}

export default function MoletteEquite({ combos, board, heroKey }) {
  // Range rangée de la plus forte équité à la plus faible, chaque combo occupant sa tranche.
  const ordered = useMemo(() => ordonnerParEquite(combos, board), [combos, board]);

  const hero = heroKey ? ordered.find((c) => c.key === heroKey) : null;
  const [equite, setEquite] = useState(() => Math.round(hero ? hero.equity : 60));

  const runs = useMemo(() => tronconsParCategorie(ordered), [ordered]);

  if (!ordered.length) return null;

  // Charnière : la main la plus faible qui tient encore ce seuil d'équité. Au-dessus d'elle, la
  // range fait mieux ; en dessous, moins bien.
  const idx = ordered.findIndex((c) => c.equity < equite);
  const charniere = idx <= 0 ? ordered[0] : ordered[idx - 1];
  const part = idx < 0 ? 1 : charniere.end;   // part de la range au moins aussi forte
  const cat = CATEGORIES.find((c) => c.id === charniere.cat);
  const bMax = tailleMaxValue(equite / 100);

  return (
    <div style={{ marginTop: 18, background: "var(--panel-2)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Équité ↔ range</span>
        {hero && (
          <button onClick={() => setEquite(Math.round(hero.equity))} disabled={Math.round(hero.equity) === equite} style={{
            padding: "5px 10px", borderRadius: 999, fontSize: 11,
            border: "1px solid var(--border)", background: "var(--panel)",
            color: Math.round(hero.equity) === equite ? "var(--text-muted)" : "var(--text)",
            cursor: Math.round(hero.equity) === equite ? "default" : "pointer",
          }}>
            Ta main ({hero.equity.toFixed(0)}%)
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Équité</span>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: MONO, color: "var(--accent)" }}>{equite}%</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>→ value jusqu&apos;à</span>
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO }}>
          {bMax == null ? "aucune mise" : `${Math.round(bMax * 100)}% du pot`}
        </span>
      </div>
      <input
        type="range" min={20} max={99} step={1} value={equite}
        onChange={(e) => setEquite(Number(e.target.value))}
        aria-label="Seuil d'équité"
        style={{ width: "100%", accentColor: "var(--accent)", margin: "6px 0 14px" }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Main charnière</span>
        <span style={{ display: "flex", gap: 4 }}>
          <MiniCard card={charniere.key.slice(0, 2)} />
          <MiniCard card={charniere.key.slice(2, 4)} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO }}>
          {handClass([charniere.key.slice(0, 2), charniere.key.slice(2, 4)])}
        </span>
        {cat && (
          <span style={{
            fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 999,
            background: `color-mix(in srgb, ${cat.color} 22%, transparent)`, color: cat.color,
          }}>
            {categoryLabel(cat, board)}
          </span>
        )}
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: MONO }}>
          {charniere.equity.toFixed(1)}% · {(part * 100).toFixed(0)}% de ta range au-dessus
        </span>
      </div>

      {/* La range rangée par équité. La zone claire est celle qui tient le seuil. */}
      <div style={{ position: "relative", height: 22, borderRadius: 5, overflow: "hidden", display: "flex" }}>
        {runs.map((r, i) => {
          const c = CATEGORIES.find((x) => x.id === r.cat);
          return <div key={i} title={categoryLabel(c, board)} style={{ width: `${(r.end - r.start) * 100}%`, background: c.color }} />;
        })}
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `${part * 100}%`, right: 0,
          background: "rgba(11,18,16,0.62)",
        }} />
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `calc(${part * 100}% - 1px)`, width: 2, background: "var(--text)",
        }} />
        {hero && (
          <div title="Ta main" style={{
            position: "absolute", top: 0, bottom: 0,
            left: `calc(${((hero.start + hero.end) / 2) * 100}% - 1px)`, width: 2, background: "var(--sur-accent)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.85)",
          }} />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4, marginBottom: 10 }}>
        <span>plus d&apos;équité</span>
        <span>moins d&apos;équité</span>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.7 }}>
        {(part * 100).toFixed(0)}% de ta range tient {equite}% d&apos;équité ou mieux contre sa range
        globale. {bMax == null
          ? "En dessous de 50%, aucune taille ne se justifie en value : c'est un bluff ou un check."
          : `À cette équité, une mise garde de la value jusqu'à ${Math.round(bMax * 100)}% du pot — au-delà, la part de sa range qui continue passe devant toi.`}
        {hero && ` Ta main est à ${hero.percentile.toFixed(0)}% de ta range.`}
      </div>
    </div>
  );
}
