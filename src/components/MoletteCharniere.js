"use client";

import { useMemo, useState } from "react";
import MiniCard from "@/components/MiniCard";
import { CATEGORIES, categoryLabel, handClass } from "@/lib/poker/handCategory";
import { cranLePlusProche, ordonnerParPercentile, tronconsParCategorie } from "@/lib/poker/ordreRange";

// Molette de la main charnière, version « ma propre range ».
//
// Deux usages, une seule mécanique — la range est rangée de la plus forte à la plus faible (par
// équité contre la range adverse, comme le percentile de l'exercice), et un curseur la coupe :
//
//   defense — je fais face à une mise. La MDF dit quelle part je dois continuer : P / (P + B).
//             La charnière est la main la plus faible que je défends encore.
//   bluff   — je mise. La fréquence de bluff théorique vaut B / (P + 2B) : c'est la part de ma
//             range qui peut partir en bluff, prise par le BAS. La charnière est la main la plus
//             forte que je m'autorise à bluffer ; au-dessus, c'est un overbluff.
//
// Les deux curseurs sont liés : bouger la taille déplace le percentile, bouger le percentile
// affiche la taille qui lui correspond. Demandé par Boris, qui veut lire la relation dans les
// deux sens.

const STOPS = [10, 15, 20, 25, 33, 40, 50, 60, 66, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300];
const MONO = "var(--font-ibm-plex-mono), monospace";

// Part de la range concernée, pour une mise exprimée en % du pot AVANT la mise.
function partPourTaille(mode, pct) {
  const b = pct / 100;
  return mode === "bluff" ? b / (1 + 2 * b) : 1 / (1 + b);
}
// Taille de mise qui produit cette part. Au-delà d'une part de 50% en bluff, aucune taille ne
// convient (la formule n'a plus de solution) : on plafonne l'affichage.
function taillePourPart(mode, part) {
  if (mode === "bluff") return part >= 0.499 ? null : (part / (1 - 2 * part)) * 100;
  return part <= 0 ? null : ((1 - part) / part) * 100;
}

// Position du curseur dans la range : la défense se compte depuis le haut, le bluff depuis le bas.
const seuilDepuisPart = (mode, part) => (mode === "bluff" ? 1 - part : part);
const partDepuisSeuil = (mode, seuil) => (mode === "bluff" ? 1 - seuil : seuil);

export default function MoletteCharniere({ combos, board, mode = "defense", playedSizePct, heroKey }) {
  // Range rangée du plus fort au plus faible, chaque combo occupant sa tranche de poids.
  const ordered = useMemo(() => ordonnerParPercentile(combos, board), [combos, board]);

  const taillejouee = playedSizePct != null && playedSizePct > 0 ? playedSizePct : 75;
  const [seuil, setSeuil] = useState(() => seuilDepuisPart(mode, partPourTaille(mode, taillejouee)));

  const runs = useMemo(() => tronconsParCategorie(ordered), [ordered]);

  const part = partDepuisSeuil(mode, seuil);
  const taille = taillePourPart(mode, part);
  const stops = useMemo(
    () => [...STOPS.filter((s) => Math.abs(s - taillejouee) > 2), taillejouee].sort((a, b) => a - b),
    [taillejouee]
  );
  const idxTaille = cranLePlusProche(stops, taille);

  const charniere = ordered.find((c) => c.end >= seuil - 1e-12) || ordered[ordered.length - 1];
  const cat = charniere ? CATEGORIES.find((c) => c.id === charniere.cat) : null;
  const hero = heroKey ? ordered.find((c) => c.key === heroKey) : null;
  const seuilJoue = seuilDepuisPart(mode, partPourTaille(mode, taillejouee));
  if (!charniere) return null;

  const pct = (x) => `${Math.round(x * 100)}%`;
  const titre = mode === "bluff" ? "Jusqu'où puis-je bluffer ?" : "Ma charnière de défense";

  return (
    <div style={{ marginTop: 18, background: "var(--panel-2)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{titre}</span>
        <button onClick={() => setSeuil(seuilJoue)} disabled={Math.abs(seuil - seuilJoue) < 1e-9} style={{
          padding: "5px 10px", borderRadius: 999, fontSize: 11,
          border: "1px solid var(--border)", background: "var(--panel)",
          color: Math.abs(seuil - seuilJoue) < 1e-9 ? "var(--text-muted)" : "var(--text)",
          cursor: Math.abs(seuil - seuilJoue) < 1e-9 ? "default" : "pointer",
        }}>
          Taille jouée ({Math.round(taillejouee)}%)
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Mise</span>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: MONO }}>
          {taille == null ? "—" : `${Math.round(taille)}%`}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          du pot → {mode === "bluff" ? "bluffs" : "défense"}
        </span>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: MONO, color: "var(--accent)" }}>{pct(part)}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>de ta range</span>
      </div>
      <input
        type="range" min={0} max={stops.length - 1} step={1} value={idxTaille}
        onChange={(e) => setSeuil(seuilDepuisPart(mode, partPourTaille(mode, stops[Number(e.target.value)])))}
        aria-label="Taille de mise"
        style={{ width: "100%", accentColor: "var(--accent)", margin: "6px 0 12px" }}
      />

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Percentile de la charnière</span>
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO }}>{pct(seuil)}</span>
      </div>
      <input
        type="range" min={1} max={99} step={1} value={Math.round(seuil * 100)}
        onChange={(e) => setSeuil(Number(e.target.value) / 100)}
        aria-label="Percentile dans la range"
        style={{ width: "100%", accentColor: "#8AA0FF", margin: "6px 0 14px" }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {mode === "bluff" ? "Tu peux bluffer à partir de" : "Tu défends jusqu'à"}
        </span>
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
          {charniere.equity.toFixed(1)}% d&apos;équité
        </span>
      </div>

      {/* La range entière, de la plus forte à la plus faible. La zone grisée est celle que le
          curseur exclut : à droite ce qu'on couche en défense, à gauche ce qu'on ne bluffe pas. */}
      <div style={{ position: "relative", height: 22, borderRadius: 5, overflow: "hidden", display: "flex" }}>
        {runs.map((r, i) => {
          const c = CATEGORIES.find((x) => x.id === r.cat);
          return <div key={i} title={categoryLabel(c, board)} style={{ width: `${(r.end - r.start) * 100}%`, background: c.color }} />;
        })}
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: mode === "bluff" ? 0 : `${seuil * 100}%`,
          right: mode === "bluff" ? `${(1 - seuil) * 100}%` : 0,
          background: "rgba(11,18,16,0.62)",
        }} />
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `calc(${seuil * 100}% - 1px)`, width: 2,
          background: "var(--text)",
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
        <span>plus forte</span>
        <span>plus faible</span>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.7 }}>
        {mode === "bluff" ? (
          <>
            À {taille == null ? "cette taille" : `${Math.round(taille)}% du pot`}, un bluff doit gagner{" "}
            {pct(part)} du temps : ta range ne supporte que {pct(part)} de bluffs, pris par le bas.
            Une main au-dessus de la charnière part en overbluff — elle a trop de valeur pour ça.
            {hero && ` Ta main est à ${hero.percentile.toFixed(0)}% de ta range.`}
          </>
        ) : (
          <>
            À {taille == null ? "cette taille" : `${Math.round(taille)}% du pot`}, tu dois continuer avec{" "}
            {pct(part)} de ta range pour ne céder à aucun bluff. La MDF est un repère, pas une
            obligation : face à une range polarisée elle mord, face à une range de value elle sur-défend.
            {hero && ` Ta main est à ${hero.percentile.toFixed(0)}% de ta range.`}
          </>
        )}{" "}
        Range classée par équité contre la range adverse, comme le percentile de l&apos;exercice.
      </div>
    </div>
  );
}
