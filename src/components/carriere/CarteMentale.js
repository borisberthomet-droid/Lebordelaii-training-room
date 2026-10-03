"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Carte, MONO, Vide } from "./Blocs";
import CourbeMental from "./CourbeMental";
import { AXES, dernier, moyenne, retardJours, serie, variation } from "@/lib/carriere/mental";
import { lienPhotoMentale } from "@/lib/supabase/carriere";

// La carte mentale du tableau de bord : une phrase, une image, trois courbes.
//
// La photo et le mantra ne sont pas de la décoration. Ils sont là pour la même raison que les
// chiffres : se remettre dans un état d'esprit avant de jouer. Ils passent donc AVANT les
// courbes — on regarde d'abord pourquoi on joue, ensuite comment on va.
//
// Les mesures sont en lecture seule ici. On ne note pas sa confiance en passant sur un tableau de
// bord : l'évaluation a sa page et son rythme, sinon elle se remplit à la volée et ne vaut plus
// rien. La carte n'a qu'un lien vers elle.

export default function CarteMentale({ fiche, lien = "/carriere/mental" }) {
  const checkins = fiche?.mental || [];
  const mantra = fiche?.prive?.mantra || "";
  const chemin = fiche?.prive?.photo_mentale || null;
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    let vivant = true;
    // Tout passe par la fonction asynchrone, y compris le cas « pas de photo » : un setState
    // synchrone dans le corps d'un effet déclenche une cascade de rendus, que le compilateur
    // React de ce projet refuse.
    (async () => {
      // Lien signé, valable une heure : le bucket est privé, rien n'est servi en clair.
      const url = chemin ? await lienPhotoMentale(chemin).catch(() => null) : null;
      if (vivant) setPhoto(url);
    })();
    return () => { vivant = false; };
  }, [chemin]);

  const retard = retardJours(checkins);
  const dernierCheckin = dernier(checkins);
  const globale = dernierCheckin ? moyenne(dernierCheckin) : null;

  return (
    <Carte
      titre="Ma carte mentale"
      action={<Link href={lien} style={{ fontSize: 12, color: "var(--accent)" }}>Évaluer →</Link>}
    >
      {(photo || mantra) && (
        <div style={{
          position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 14,
          minHeight: photo ? 150 : 0,
          display: "flex", alignItems: "flex-end",
          background: photo ? `url(${photo}) center/cover no-repeat` : "var(--panel-2)",
        }}>
          {/* Le voile n'est pas de la décoration : sans lui, la lisibilité du mantra dépend de la
              photo choisie, et une image claire le ferait disparaître. */}
          {photo && mantra && (
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0) 100%)",
            }} />
          )}
          {mantra && (
            <div className="titre" style={{
              position: "relative", padding: photo ? "16px 16px 14px" : "14px 16px",
              fontSize: 16, fontWeight: 700, lineHeight: 1.45,
              color: photo ? "var(--sur-photo, #F5F1EE)" : "var(--brun)",
            }}>
              « {mantra} »
            </div>
          )}
        </div>
      )}

      {checkins.length === 0 ? (
        <Vide>
          Pas encore d&apos;évaluation mentale.{" "}
          <Link href={lien} style={{ color: "var(--accent)" }}>En noter une</Link> — trois curseurs,
          trente secondes.
        </Vide>
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap", marginBottom: 14 }}>
            <span style={{ fontSize: 32, fontWeight: 800, fontFamily: MONO, color: "var(--accent)", lineHeight: 1 }}>
              {globale ?? "—"}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              moyenne au {new Date(dernierCheckin.fait_le + "T12:00:00").toLocaleDateString("fr-FR")}
            </span>
            {retard != null && retard > 0 && (
              <span style={{ fontSize: 11, color: "var(--attention)", fontWeight: 700, marginLeft: "auto" }}>
                {retard} j de retard
              </span>
            )}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {AXES.map((a) => {
              const points = serie(checkins, a.id);
              const delta = variation(checkins, a.id);
              const actuel = points.length ? points[points.length - 1].valeur : null;
              return (
                <div key={a.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 130 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: a.couleur }}>{a.label}</div>
                    <div style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
                      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: MONO }}>{actuel ?? "—"}</span>
                      {delta != null && (
                        <span style={{
                          fontSize: 11, fontFamily: MONO,
                          color: delta > 0 ? "var(--accent)" : delta < 0 ? "var(--erreur)" : "var(--text-muted)",
                        }}>{delta > 0 ? "+" : ""}{delta}</span>
                      )}
                    </div>
                  </div>
                  <CourbeMental points={points} couleur={a.couleur} largeur={170} hauteur={40} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </Carte>
  );
}
