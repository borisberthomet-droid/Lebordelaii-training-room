"use client";

import Link from "next/link";
import SkillRadar from "@/components/SkillRadar";
import { Carte, MONO, Pastille, Vide } from "./Blocs";

// La carte du joueur : une note globale, une forme, et ce qui a bougé depuis la dernière fois.
//
// Le radar trace les GROUPES de compétences (`skill_items.groupe`), pas les vingt-trois
// compétences — sept branches se lisent d'un coup d'œil, vingt-trois font une tache. Le calcul
// est le même que sur la page d'auto-évaluation : il vit ici pour que les deux écrans ne puissent
// pas diverger.

// Moyenne par groupe. Une compétence non notée ne compte pas : zéro et « pas répondu » ne veulent
// pas dire la même chose.
export function moyennesParGroupe(competences, scores) {
  const paquets = {};
  for (const c of competences) {
    const v = scores?.[c.id];
    if (v == null) continue;
    (paquets[c.groupe] ||= []).push(v);
  }
  return Object.fromEntries(
    Object.entries(paquets).map(([g, vals]) => [g, Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)])
  );
}

function dateCourte(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function CarteJoueur({ competences, evaluations, lien = "/carriere/auto-evaluation" }) {
  const derniere = evaluations?.[0] || null;
  const precedente = evaluations?.[1] || null;

  if (!derniere) {
    return (
      <Carte titre="Ma carte" aide="ton auto-évaluation, en une forme">
        <Vide>
          Pas encore d&apos;auto-évaluation. C&apos;est elle qui dessine ta carte et qui permettra, dans six
          mois, de voir ce qui a bougé.{" "}
          <Link href={lien} style={{ color: "var(--accent)" }}>La faire maintenant</Link>
        </Vide>
      </Carte>
    );
  }

  const groupes = [...new Set(competences.map((c) => c.groupe))];
  const actuelles = moyennesParGroupe(competences, derniere.scores);
  const anciennes = moyennesParGroupe(competences, precedente?.scores);
  const axes = groupes.map((g) => ({
    id: g, label: g, score: actuelles[g] ?? null, measured: actuelles[g] != null,
  }));
  const notes = Object.values(actuelles);
  const global = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : null;

  return (
    <Carte
      titre="Ma carte"
      aide={`dernière évaluation le ${dateCourte(derniere.date)}`}
      action={<Link href={lien} style={{ fontSize: 12, color: "var(--accent)" }}>Refaire →</Link>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 40, fontWeight: 800, fontFamily: MONO, color: "var(--accent)", lineHeight: 1 }}>
              {global}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
              note globale<br />moyenne de tes axes
            </div>
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            {groupes.map((g) => {
              const v = actuelles[g];
              const avant = anciennes[g];
              const delta = v != null && avant != null ? v - avant : null;
              return (
                <div key={g} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>{g}</span>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontWeight: 700 }}>{v ?? "—"}</span>
                    {delta != null && delta !== 0 && (
                      <Pastille couleur={delta > 0 ? "var(--accent)" : "var(--erreur)"}>
                        {delta > 0 ? "+" : ""}{delta}
                      </Pastille>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <SkillRadar axes={axes} />
      </div>
    </Carte>
  );
}
