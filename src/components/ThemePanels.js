"use client";

import { useEffect, useState } from "react";
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
// Pot Odds apparaît dans deux thèmes, et c'est voulu : ses questions de cote de call nourrissent
// l'axe Équité, ses questions de fréquence de bluff nourrissent l'axe Fréquence. La fiche fait
// déjà cette distinction question par question.
const THEMES = [
  {
    axis: "equite", label: "Équité", color: "#34D399",
    desc: "Estimer sa force brute face à une range",
    tools: [
      { href: "/value-equity", label: "Quelle est ton équité ?" },
      { href: "/pot-odds", label: "Pot Odds" },
    ],
  },
  {
    axis: "frequence", label: "Fréquence", color: "#4FA8E0",
    desc: "Savoir à quelle fréquence défendre, miser, bluffer",
    tools: [
      { href: "/range-position", label: "Où suis-je dans ma range ?" },
      { href: "/range-builder", label: "Range Builder" },
      { href: "/pot-odds", label: "Pot Odds" },
    ],
  },
  {
    axis: "lecture", label: "Lecture de range", color: "#E8C547",
    desc: "Reconstruire ce que l'adversaire peut avoir",
    tools: [
      { href: "/train", label: "Find It! — un spot au hasard" },
      { href: "/find-it", label: "Find It! — accueil" },
    ],
  },
  {
    axis: "calcul", label: "Calcul mental", color: "#E89A47",
    desc: "Sortir les nombres sans hésiter",
    tools: [
      { href: "/math-trainer", label: "Math Trainer" },
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
          <div key={theme.axis} style={{
            background: `linear-gradient(160deg, ${theme.color}14 0%, var(--panel) 60%)`,
            border: `1px solid ${theme.color}59`, borderRadius: 14, padding: "18px 18px",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: theme.color, letterSpacing: -0.2 }}>
                {theme.label}
              </span>
              <span style={{
                fontSize: 22, fontWeight: 800, lineHeight: 1,
                fontFamily: "var(--font-ibm-plex-mono), monospace",
                color: note != null ? theme.color : "var(--border)",
              }}>
                {note != null ? note : "—"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              {theme.desc}
              {note == null && <span style={{ color: theme.color, opacity: 0.8 }}> · pas encore noté</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {theme.tools.map((t) => (
                <Link key={t.href + t.label} href={t.href} style={{
                  display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)",
                  background: "var(--panel-2)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "8px 11px",
                }}>
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
