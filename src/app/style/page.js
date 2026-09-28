"use client";

import { useState } from "react";
import Link from "next/link";
import { Fraunces, Poppins } from "next/font/google";

// Page de comparaison de styles — pas une page du produit, un banc d'essai.
//
// Boris veut aligner la Training Room sur son site de coaching (beige chaud, brun profond, vert
// olive, gros titres en serif). La question n'est pas « est-ce que c'est beau » : c'est « est-ce
// que ça tient sur les écrans DENSES du produit ». On affiche donc exactement les mêmes blocs
// dans les deux habillages, dont une grille de range — c'est elle qui tranche, parce que ses
// couleurs portent de l'information et non de la décoration.

const serif = Fraunces({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-essai-serif" });
const sans = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-essai-sans" });

// Les jetons de l'habillage actuel.
const SOMBRE = {
  "--d-bg": "#121413",
  "--d-panel": "#1A1D1B",
  "--d-panel-2": "#20241F",
  "--d-border": "#272B28",
  "--d-text": "#ECEEF1",
  "--d-muted": "#8E968F",
  "--d-accent": "#34D399",
  "--d-accent-fort": "#4ADE80",
  "--d-contre": "#0B1210",
  "--d-alerte": "#E8C547",
  "--d-titre": "var(--font-space-grotesk), sans-serif",
  "--d-corps": "var(--font-space-grotesk), sans-serif",
};

// Les jetons repris du site de coaching. Couleurs relevées sur les captures ; les tons de données
// (vert, ambre) sont assombris, sinon ils disparaissent sur un fond crème.
const CHAUD = {
  "--d-bg": "#EFE4DF",
  "--d-panel": "#FAF5F2",
  "--d-panel-2": "#E7D9D1",
  "--d-border": "#D6C3B8",
  "--d-text": "#3B2A1E",
  "--d-muted": "#8A7466",
  "--d-accent": "#7A8B4B",
  "--d-accent-fort": "#5F6E36",
  "--d-contre": "#FAF5F2",
  "--d-alerte": "#B07A17",
  "--d-titre": "var(--font-essai-serif), Georgia, serif",
  "--d-corps": "var(--font-essai-sans), sans-serif",
};

const MAIN = ["AA", "AKs", "AQs", "AJs", "ATs", "KK", "KQs", "KJs", "QQ", "JJ"];
const POIDS = [1, 0.82, 0.55, 1, 0.31, 1, 0.68, 0.12, 0.94, 0.47];

function Demo({ jetons, titre, note }) {
  return (
    <div style={{ ...jetons, background: "var(--d-bg)", color: "var(--d-text)", borderRadius: 16, padding: 20, fontFamily: "var(--d-corps)" }}>
      <div style={{ fontSize: 11, color: "var(--d-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
        {titre}
      </div>
      <div style={{ fontSize: 11, color: "var(--d-muted)", marginBottom: 16 }}>{note}</div>

      <div style={{ fontFamily: "var(--d-titre)", fontSize: 28, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 14 }}>
        Gestion de carrière
      </div>

      {/* Compteurs */}
      <div style={{ background: "var(--d-panel)", border: "1px solid var(--d-border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[["24", "coachings"], ["37 h 30", "heures à vie"], ["2 h", "restantes"]].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{v}</div>
              <div style={{ fontSize: 11, color: "var(--d-muted)", marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Statistique en focus */}
      <div style={{ background: "var(--d-panel)", border: "1px solid var(--d-border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontFamily: "var(--d-titre)", fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Mes 3 statistiques en focus</div>
        <div style={{ background: "var(--d-panel-2)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>C-bet flop IP</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
            <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 24, fontWeight: 800 }}>65</span>
            <span style={{ fontSize: 12, color: "var(--d-muted)" }}>cible</span>
            <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 15, fontWeight: 700, color: "var(--d-accent)" }}>80 – 85</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--d-muted)", marginTop: 8, lineHeight: 1.6 }}>
            Augmenter fortement les petits c-bets sur les textures favorables.
          </div>
        </div>
      </div>

      {/* Grille de range : le vrai test. */}
      <div style={{ background: "var(--d-panel)", border: "1px solid var(--d-border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ fontFamily: "var(--d-titre)", fontSize: 15, fontWeight: 700, marginBottom: 10 }}>La range du solveur</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 3 }}>
          {MAIN.map((m, i) => {
            const p = POIDS[i];
            return (
              <div key={m} style={{
                position: "relative", overflow: "hidden", borderRadius: 4,
                background: "var(--d-panel-2)", border: "1px solid var(--d-border)",
                padding: "6px 4px", textAlign: "center",
              }}>
                <div style={{
                  position: "absolute", left: 0, right: 0, bottom: 0, height: `${p * 100}%`,
                  background: `color-mix(in srgb, var(--d-accent) ${30 + p * 55}%, transparent)`,
                }} />
                <div style={{ position: "relative", fontSize: 11, fontWeight: 600 }}>{m}</div>
                <div style={{ position: "relative", fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 9, opacity: 0.75 }}>
                  {Math.round(p * 100)}%
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: "var(--d-muted)", marginTop: 8 }}>
          La hauteur colorée est la fréquence du solveur : ici la couleur porte une information.
        </div>
      </div>

      {/* Boutons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={{
          padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
          background: "var(--d-accent)", color: "var(--d-contre)", fontFamily: "var(--d-corps)",
        }}>
          Nouvelle main
        </button>
        <button style={{
          padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12,
          background: "var(--d-panel-2)", color: "var(--d-text)", border: "1px solid var(--d-border)",
          fontFamily: "var(--d-corps)",
        }}>
          Voir la correction
        </button>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 999, alignSelf: "center",
          background: "color-mix(in srgb, var(--d-alerte) 18%, transparent)", color: "var(--d-alerte)",
        }}>
          en retard
        </span>
      </div>
    </div>
  );
}

export default function StylePage() {
  const [cote, setCote] = useState("deux");   // deux | sombre | chaud

  return (
    <div className={`${serif.variable} ${sans.variable}`}
      style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Banc d&apos;essai — habillage</div>
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.7, maxWidth: 620 }}>
        Les mêmes blocs, deux habillages : celui de la Training Room aujourd&apos;hui, et celui du site
        de coaching. Regarde surtout la grille de range — c&apos;est l&apos;écran le plus dense du produit,
        et celui qui dit si un fond clair tient ou non.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["deux", "Les deux"], ["sombre", "Actuel"], ["chaud", "Site coaching"]].map(([id, label]) => (
          <button key={id} onClick={() => setCote(id)} style={{
            padding: "6px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
            border: `1px solid ${cote === id ? "var(--accent)" : "var(--border)"}`,
            background: cote === id ? "rgba(52,211,153,0.14)" : "var(--panel-2)",
            color: cote === id ? "var(--accent)" : "var(--text-muted)",
          }}>{label}</button>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: cote === "deux" ? "repeat(auto-fit, minmax(330px, 1fr))" : "1fr",
        gap: 16,
      }}>
        {cote !== "chaud" && <Demo jetons={SOMBRE} titre="Aujourd'hui" note="fond sombre, accent vert, tout en sans" />}
        {cote !== "sombre" && <Demo jetons={CHAUD} titre="Style du site de coaching" note="crème et brun, titres en serif, vert olive" />}
      </div>
    </div>
  );
}
