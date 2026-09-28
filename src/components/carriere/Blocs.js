"use client";

import Link from "next/link";

// Briques d'affichage de la Gestion de carrière. Elles existent pour une raison simple : la page
// doit se lire en une seconde. Un chiffre, une jauge, une pastille — jamais un pavé de texte là
// où une forme suffit.

export const MONO = "var(--font-ibm-plex-mono), monospace";

export const carteStyle = {
  background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 16,
};

export function Carte({ titre, aide, action, children, style }) {
  return (
    <section style={{ ...carteStyle, ...style }}>
      {(titre || action) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>{titre}</div>
            {aide && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{aide}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Compteur({ valeur, libelle, couleur }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: MONO, color: couleur || "var(--text)", lineHeight: 1.1 }}>
        {valeur}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{libelle}</div>
    </div>
  );
}

export function Jauge({ pct, couleur, hauteur = 8 }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <div style={{ height: hauteur, borderRadius: 999, background: "var(--panel-2)", overflow: "hidden" }}>
      <div style={{ width: `${p}%`, height: "100%", background: couleur || "var(--accent-gradient)" }} />
    </div>
  );
}

export function Pastille({ children, couleur = "var(--text-muted)", fond }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap",
      background: fond || `color-mix(in srgb, ${couleur} 18%, transparent)`, color: couleur,
    }}>
      {children}
    </span>
  );
}

export function Vide({ children }) {
  return <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>{children}</div>;
}

export const btn = {
  padding: "8px 16px", background: "var(--accent-gradient)", color: "#0B1210",
  border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
};
export const btnFantome = {
  padding: "6px 12px", background: "var(--panel-2)", color: "var(--text)",
  border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, cursor: "pointer",
};
export const champ = {
  width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
};

// --- Vocabulaire commun ---------------------------------------------------------------------

export const STATUT_AXE = {
  a_travailler: { label: "à travailler", couleur: "#E8C547" },
  en_cours: { label: "en cours", couleur: "#4FA8E0" },
  maitrise: { label: "maîtrisé", couleur: "#34D399" },
};

export const HORIZONS = {
  vision: { label: "Vision", aide: "quel joueur ai-je envie de devenir ?" },
  annee: { label: "Objectif à 1 an", aide: null },
  trimestre: { label: "Ce trimestre", aide: "trois au maximum" },
};

// Cible d'une statistique, en clair : « 80 – 85 % », « ≥ 80 % », « ≤ 25 % ».
export function libelleTarget(stat) {
  const { target_min: min, target_max: max } = stat;
  if (min != null && max != null) return `${min} – ${max}`;
  if (min != null) return `≥ ${min}`;
  if (max != null) return `≤ ${max}`;
  return "—";
}

// Une valeur est dans la cible quand elle tient les deux bornes renseignées.
export function dansLaCible(stat, valeur = stat.valeur_actuelle) {
  if (valeur == null) return false;
  if (stat.target_min != null && valeur < stat.target_min) return false;
  if (stat.target_max != null && valeur > stat.target_max) return false;
  return true;
}

// Carte d'une statistique en focus : la valeur, la cible, l'écart, la dernière note du coach.
// C'est l'élément le plus visible du tableau de bord — c'est ce que le joueur travaille.
export function StatFocus({ stat, compact }) {
  const ok = dansLaCible(stat);
  const derniere = stat.notes?.[0];
  return (
    <div style={{
      background: "var(--panel-2)", borderRadius: 12, padding: 14,
      border: `1px solid ${ok ? "rgba(52,211,153,0.45)" : "var(--border)"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{stat.nom}</span>
        {ok && <Pastille couleur="#34D399">dans la cible</Pastille>}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 800, fontFamily: MONO, color: ok ? "#34D399" : "var(--text)" }}>
          {stat.valeur_actuelle != null ? stat.valeur_actuelle : "—"}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>cible</span>
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO, color: "var(--accent)" }}>
          {libelleTarget(stat)}
        </span>
      </div>
      {!compact && derniere && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.6 }}>
          {derniere.note}
        </div>
      )}
    </div>
  );
}

export function LienSection({ href, children }) {
  return (
    <Link href={href} style={{ fontSize: 12, color: "var(--accent)" }}>{children}</Link>
  );
}
