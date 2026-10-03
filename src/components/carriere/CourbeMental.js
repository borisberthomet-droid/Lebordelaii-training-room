"use client";

import { courbe } from "@/lib/carriere/mental";

// Une courbe d'évaluation mentale. Partagée entre l'écran de l'élève et la fiche du coach : ils
// doivent lire exactement le même tracé, sinon « il remonte » et « il stagne » se discutent sur
// deux dessins différents.
//
// L'échelle verticale est figée de 0 à 100, jamais ajustée aux valeurs présentes. Une courbe qui
// se recadre toute seule fait passer un progrès de deux points pour une envolée — précisément ce
// qu'une mesure de confiance en soi ne doit pas raconter.

export default function CourbeMental({ points, couleur, largeur = 220, hauteur = 54 }) {
  const pts = courbe(points, largeur, hauteur);
  if (pts.length === 0) return null;

  const trace = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fin = pts[pts.length - 1];

  return (
    <svg width={largeur} height={hauteur} style={{ display: "block", overflow: "visible" }} aria-hidden="true">
      {/* Repère à 50 : sans lui, une courbe plate en haut et une courbe plate en bas se
          ressemblent, alors qu'elles ne disent pas du tout la même chose. */}
      <line x1={0} y1={hauteur / 2} x2={largeur} y2={hauteur / 2}
        stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
      {pts.length > 1 && (
        <path d={trace} fill="none" stroke={couleur} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 3.5 : 2} fill={couleur} />
      ))}
      <circle cx={fin.x} cy={fin.y} r={6} fill="none" stroke={couleur} strokeWidth={1.5} opacity={0.35} />
    </svg>
  );
}
