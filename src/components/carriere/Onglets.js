"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation de la Gestion de carrière, présente sur toutes ses pages.
//
// Une couleur par onglet, comme les thèmes de l'accueil : la couleur devient un repère qu'on
// reconnaît avant d'avoir lu le mot. L'onglet de la page en cours est plein, les autres sont
// posés sur un fond léger de leur propre teinte — ils restent lisibles sans tirer l'œil.

export const ONGLETS = [
  { href: "/carriere", label: "Tableau de bord", couleur: "#5F6127" },
  { href: "/carriere/auto-evaluation", label: "Auto-évaluation", couleur: "#3A6851" },
  { href: "/carriere/objectifs", label: "Objectifs", couleur: "#4E3E66" },
  { href: "/carriere/routines", label: "Mes routines", couleur: "#7A4E12" },
  { href: "/carriere/semaine", label: "Ma semaine", couleur: "#8A6A1E" },
  { href: "/carriere/leak-finder", label: "Leak Finder", couleur: "#A0552A" },
  { href: "/carriere/coachings", label: "Coachings", couleur: "#7C5372" },
];

export default function Onglets() {
  const ici = usePathname();

  return (
    <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      {ONGLETS.map((o) => {
        const actif = ici === o.href;
        return (
          <Link
            key={o.href}
            href={o.href}
            aria-current={actif ? "page" : undefined}
            style={{
              padding: "7px 14px", borderRadius: 999, fontSize: 12,
              fontWeight: actif ? 700 : 500,
              background: actif ? o.couleur : `color-mix(in srgb, ${o.couleur} 12%, var(--panel))`,
              color: actif ? "var(--sur-accent)" : o.couleur,
              border: `1px solid ${actif ? o.couleur : `color-mix(in srgb, ${o.couleur} 35%, transparent)`}`,
            }}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
