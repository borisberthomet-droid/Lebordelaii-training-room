"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { loadMySkillRows } from "@/lib/supabase/skillAttempts";
import { buildProfile } from "@/lib/poker/skillScore";

// Les quatre compétences clés, chacune avec sa couleur et sa note du moment. L'accueil devient
// une carte de ce qui va et de ce qui manque, plutôt qu'une liste d'outils dont il faut deviner
// l'usage.
//
// Les couleurs sont prises dans la palette déjà utilisée ailleurs (niveaux d'élasticité, couleurs
// de cartes), pas inventées : le rouge en est écarté, il signale une erreur partout dans le site.
//
// Pot Odds est rangé dans Calcul mental — c'est là que l'élève le cherche : on y applique des
// formules. Mais sa NOTE, elle, continue d'aller là où elle doit : cote de call et équité de value
// bet nourrissent l'axe Équité, fold equity et ratio de bluff nourrissent l'axe Fréquence. Un même
// exercice peut se ranger à un endroit et mesurer autre chose ; c'est la fiche qui fait foi, pas
// la carte.
const THEMES = [
  {
    axis: "equite", color2: "#8A8C43", label: "Équité", color: "#4F5220",
    desc: "Estimer sa force brute face à une range",
    tools: [
      { href: "/equite-preflop", label: "Mon équité vs sa range", groupe: "Préflop" },
      { href: "/equite-necessaire", label: "Quelle équité me faut-il ?", groupe: "Préflop" },
      { href: "/value-equity", label: "Quelle est ton équité ?", groupe: "Postflop" },
      { href: "/pot-odds?axe=equite", label: "Pot Odds — équité", groupe: "Postflop" },
    ],
  },
  {
    axis: "frequence", color2: "#5F8B73", label: "Fréquence", color: "#3A6851",
    desc: "Savoir à quelle fréquence défendre, miser, bluffer",
    tools: [
      { href: "/range-position", label: "Défendre ma range — Vs AGG" },
      { href: "/dois-je-bluffer", label: "Dois-je bluffer ? — as AGG" },
      { href: "/pot-odds?axe=frequence", label: "Pot Odds — fréquence" },
    ],
  },
  {
    axis: "lecture", color2: "#A9741F", label: "Lecture de range", color: "#7A4E12",
    desc: "Reconstruire ce que l'adversaire peut avoir",
    tools: [
      { href: "/find-it", label: "Find It!" },
      { href: "/range-decomposition", label: "Décompose la range" },
    ],
  },
  {
    axis: "construction", color2: "#6E5A8C", label: "Construction de range", color: "#4E3E66",
    desc: "Dessiner la range que le spot demande",
    tools: [
      { href: "/range-builder", label: "Range Builder" },
    ],
  },
  {
    axis: "calcul", color2: "#A8552A", label: "Calcul mental", color: "#7E3C1B",
    desc: "Sortir les nombres sans hésiter",
    tools: [
      { href: "/math-trainer", label: "Math Trainer" },
      { href: "/pot-odds", label: "Pot Odds — tout" },
    ],
  },
];

export default function ThemePanels() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    loadMySkillRows()
      .then(({ rows }) => setProfile(buildProfile(rows)))
      .catch(() => setProfile(null));
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 26 }}>
      {THEMES.map((theme) => {
        const axis = profile?.axes.find((a) => a.id === theme.axis);
        const note = axis?.measured ? axis.score : null;
        return (
          <div key={theme.axis} className="theme-card"
            style={{ "--tp": theme.color, borderRadius: 16, padding: "18px 18px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 2 }}>
              <span className="grad-text" style={{
                fontSize: 19, fontWeight: 800, letterSpacing: -0.3,
                backgroundImage: `linear-gradient(100deg, ${theme.color}, ${theme.color2})`,
              }}>
                {theme.label}
              </span>
              <span className={note != null ? "grad-text" : undefined} style={{
                fontSize: 24, fontWeight: 800, lineHeight: 1,
                fontFamily: "var(--font-ibm-plex-mono), monospace",
                ...(note != null
                  ? { backgroundImage: `linear-gradient(140deg, ${theme.color2}, ${theme.color})` }
                  : { color: "var(--border)" }),
              }}>
                {note != null ? note : "—"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              {theme.desc}
              {note == null && <span style={{ color: theme.color, opacity: 0.8 }}> · pas encore noté</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Un intertitre n'apparaît que quand un outil change de groupe : une compétence
                  qui n'en a qu'un seul reste une simple liste, sans en-tête inutile. */}
              {theme.tools.map((t, i) => (
                <Fragment key={t.href + t.label}>
                  {t.groupe && t.groupe !== theme.tools[i - 1]?.groupe && (
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase",
                      color: theme.color, marginTop: i ? 7 : 0, marginBottom: -1,
                    }}>
                      {t.groupe}
                    </div>
                  )}
                  <Link href={t.href} className="tool-link" style={{
                    display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)",
                    background: "var(--panel-2)", border: "1px solid var(--border)",
                    borderRadius: 9, padding: "9px 11px",
                  }}>
                    {t.label}
                  </Link>
                </Fragment>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
