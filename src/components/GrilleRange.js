"use client";

import { CASES } from "@/lib/poker/rangesPreflop";

// Une range préflop, en lecture seule, aux couleurs du site.
//
// Les captures d'origine viennent d'un outil tiers : fond gris, saumon, police système. Les
// reprendre telles quelles aurait collé une fenêtre d'un autre logiciel au milieu de l'écran.
// La grille est donc redessinée — mêmes données, lues au pixel sur ces captures, mais la couleur
// de l'accent et les cases arrondies du reste du site.
//
// Une main jouée à fréquence partielle est remplie DEPUIS LE BAS, à hauteur de sa fréquence.
// C'est la convention de tous les outils de range, et elle se lit sans légende : une case à
// moitié pleine se joue une fois sur deux.

export default function GrilleRange({ mains, surligner = null, taille = 24 }) {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: `repeat(13, minmax(0, 1fr))`, gap: 2, maxWidth: taille * 13 + 24 }}
      role="img"
      aria-label="Grille des mains de la range"
    >
      {CASES.flat().map((main) => {
        const poids = mains[main] || 0;
        const pct = Math.round(poids * 100);
        const vedette = surligner === main;
        return (
          <div
            key={main}
            title={poids ? `${main} — ${pct} %` : main}
            style={{
              aspectRatio: "1", borderRadius: 3, display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: Math.max(7, taille * 0.36), fontWeight: poids ? 700 : 400,
              fontFamily: "var(--font-ibm-plex-mono), monospace",
              background: poids
                ? `linear-gradient(to top, var(--accent) ${pct}%, var(--panel-2) ${pct}%)`
                : "var(--panel-2)",
              color: poids >= 0.55 ? "var(--sur-accent)" : "var(--text-muted)",
              // La main en cours ressort par un contour, pas par une couleur : la couleur sert
              // déjà à dire si la main est dans la range, et deux sens pour un même signal se
              // contredisent dès qu'une main surlignée n'y est pas.
              outline: vedette ? "2px solid var(--brun)" : "none",
              outlineOffset: vedette ? 1 : 0,
              overflow: "hidden",
            }}
          >
            {main}
          </div>
        );
      })}
    </div>
  );
}
