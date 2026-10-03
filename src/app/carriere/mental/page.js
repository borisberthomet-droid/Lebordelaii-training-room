"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Onglets from "@/components/carriere/Onglets";
import { Carte, MONO, Vide, btn, btnFantome, champ } from "@/components/carriere/Blocs";
import CourbeMental from "@/components/carriere/CourbeMental";
import { enregistrerMental, listerMental, monCompte, supprimerMental } from "@/lib/supabase/carriere";
import {
  AXES, CADENCE_JOURS, dernier, iso, moyenne, note, prochaineEcheance, retardJours,
  serie, variation,
} from "@/lib/carriere/mental";

// Évaluation mentale, tous les quinze jours, trois curseurs.
//
// Deux partis pris qui méritent d'être écrits, parce qu'ils se discutent :
//
// 1. Les curseurs ne sont PAS pré-remplis avec les valeurs de la dernière fois. Partir de la note
//    précédente ancre la réponse dessus — on bouge de cinq points et on valide. La note d'avant
//    est affichée à côté, en petit : l'information est là, la main ne l'est pas.
// 2. Une seule évaluation par jour. Revenir le même jour corrige celle du jour au lieu d'en
//    empiler deux, ce qui ferait un pic sur la courbe là où il n'y a eu qu'une hésitation.

const DEFAUT = 50;

function formatDate(jour) {
  return new Date(jour + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function MentalPage() {
  const [compte, setCompte] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [etat, setEtat] = useState("chargement");
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(null);
  const [scores, setScores] = useState(() => Object.fromEntries(AXES.map((a) => [a.id, DEFAUT])));
  const [commentaire, setCommentaire] = useState("");

  const aujourdhui = iso();

  useEffect(() => {
    (async () => {
      try {
        const c = await monCompte();
        if (!c) { setEtat("horsligne"); return; }
        setCompte(c);
        const liste = await listerMental(c.id);
        setCheckins(liste);
        // Seule exception à la règle « pas de pré-remplissage » : l'évaluation du jour, qu'on
        // vient corriger. Là, repartir de zéro ferait perdre ce qui vient d'être saisi.
        const duJour = liste.find((x) => x.fait_le === iso());
        if (duJour) {
          setScores(Object.fromEntries(AXES.map((a) => [a.id, note(duJour, a.id) ?? DEFAUT])));
          setCommentaire(duJour.note || "");
        }
        setEtat("pret");
      } catch (e) { setErreur(e.message); setEtat("erreur"); }
    })();
  }, []);

  const recharger = async () => setCheckins(await listerMental(compte.id));
  const agir = async (cle, fn) => {
    setOccupe(cle); setErreur(null);
    try { await fn(); await recharger(); }
    catch (e) { setErreur(e.message); }
    finally { setOccupe(null); }
  };

  const precedent = useMemo(() => {
    const avant = checkins.filter((c) => c.fait_le !== aujourdhui);
    return dernier(avant);
  }, [checkins, aujourdhui]);

  const retard = retardJours(checkins);
  const echeance = prochaineEcheance(checkins);
  const dejaFaitAujourdhui = checkins.some((c) => c.fait_le === aujourdhui);

  const enregistrer = () => agir("save", () =>
    enregistrerMental(compte.id, { fait_le: aujourdhui, scores, note: commentaire.trim() || null }));

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 820, margin: "0 auto" }}>
      <div className="titre" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Évaluation mentale</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.7 }}>
        Trois notes, tous les {CADENCE_JOURS} jours. Ce n&apos;est pas un bilan : c&apos;est une mesure, et
        elle ne vaut que si elle est reprise au même rythme.
      </div>

      <Onglets />

      {etat === "chargement" && <Vide>Chargement…</Vide>}
      {etat === "horsligne" && (
        <Vide>Connecte-toi pour noter ton évaluation. <Link href="/login" style={{ color: "var(--accent)" }}>Se connecter</Link></Vide>
      )}
      {erreur && <div style={{ fontSize: 13, color: "var(--erreur)", marginBottom: 14 }}>{erreur}</div>}

      {etat === "pret" && (
        <div style={{ display: "grid", gap: 14 }}>
          {/* Le rappel d'échéance. Il n'apparaît que lorsqu'il a quelque chose à dire : un bandeau
              permanent devient un décor qu'on ne lit plus. */}
          {retard != null && retard >= 0 && !dejaFaitAujourdhui && (
            <div style={{
              padding: "11px 14px", borderRadius: 11, fontSize: 12.5, lineHeight: 1.7,
              background: "color-mix(in srgb, var(--attention) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--attention) 35%, transparent)",
            }}>
              {retard === 0
                ? "C'est le jour : ta prochaine évaluation est attendue aujourd'hui."
                : `Ton évaluation a ${retard} jour${retard > 1 ? "s" : ""} de retard. Note-la maintenant, même approximative — une mesure sautée fait un trou dans la courbe.`}
            </div>
          )}

          <Carte
            titre={dejaFaitAujourdhui ? "Corriger l'évaluation du jour" : "Noter aujourd'hui"}
            aide={echeance && !dejaFaitAujourdhui && retard < 0
              ? `Prochaine échéance le ${echeance.toLocaleDateString("fr-FR")} — tu peux noter en avance.`
              : undefined}
          >
            <div style={{ display: "grid", gap: 20 }}>
              {AXES.map((a) => {
                const avant = precedent ? note(precedent, a.id) : null;
                return (
                  <div key={a.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: a.couleur }}>{a.label}</span>
                      <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                        {avant != null && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: MONO }}>
                            dernière fois {avant}
                          </span>
                        )}
                        <span style={{ fontSize: 19, fontWeight: 800, fontFamily: MONO, color: a.couleur, minWidth: 34, textAlign: "right" }}>
                          {scores[a.id]}
                        </span>
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6, margin: "3px 0 8px" }}>{a.aide}</div>
                    <input
                      type="range" min={0} max={100} step={5} value={scores[a.id]}
                      onChange={(e) => setScores((s) => ({ ...s, [a.id]: Number(e.target.value) }))}
                      aria-label={a.label}
                      style={{ width: "100%", accentColor: a.couleur }}
                    />
                  </div>
                );
              })}

              <div>
                <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>
                  Ce qui explique ces notes (facultatif, mais c&apos;est ce qu&apos;on relit dans six mois)
                </label>
                <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={3}
                  placeholder="Ex : trois sessions coupées trop tard, j'ai senti la crispation revenir sur les bulles."
                  style={{ ...champ, resize: "vertical", fontSize: 12.5 }} />
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button style={btn} disabled={occupe === "save"} onClick={enregistrer}>
                  {occupe === "save" ? "…" : dejaFaitAujourdhui ? "Corriger" : "Enregistrer"}
                </button>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Ton coach voit ces notes — c&apos;est ce qui les rend utiles en séance.
                </span>
              </div>
            </div>
          </Carte>

          {checkins.length > 0 && (
            <Carte titre="Évolution" aide="Échelle figée de 0 à 100 : une courbe qui se recadre ferait passer deux points pour une envolée.">
              <div style={{ display: "grid", gap: 18 }}>
                {AXES.map((a) => {
                  const points = serie(checkins, a.id);
                  const delta = variation(checkins, a.id);
                  const actuel = points.length ? points[points.length - 1].valeur : null;
                  return (
                    <div key={a.id} style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 150 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: a.couleur }}>{a.label}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                          <span style={{ fontSize: 20, fontWeight: 800, fontFamily: MONO }}>{actuel ?? "—"}</span>
                          {delta != null && (
                            <span style={{
                              fontSize: 12, fontFamily: MONO,
                              color: delta > 0 ? "var(--accent)" : delta < 0 ? "var(--erreur)" : "var(--text-muted)",
                            }}>
                              {delta > 0 ? "+" : ""}{delta}
                            </span>
                          )}
                        </div>
                      </div>
                      <CourbeMental points={points} couleur={a.couleur} />
                    </div>
                  );
                })}
              </div>
            </Carte>
          )}

          {checkins.length > 0 && (
            <Carte titre="Mes évaluations">
              <div style={{ display: "grid", gap: 8 }}>
                {checkins.map((c) => (
                  <div key={c.id} style={{ background: "var(--panel-2)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{formatDate(c.fait_le)}</span>
                      <span style={{ display: "flex", gap: 12, alignItems: "baseline", fontFamily: MONO, fontSize: 12 }}>
                        {AXES.map((a) => (
                          <span key={a.id} style={{ color: a.couleur }}>{note(c, a.id) ?? "—"}</span>
                        ))}
                        <span style={{ color: "var(--text-muted)" }}>moy. {moyenne(c) ?? "—"}</span>
                        <button style={btnFantome} disabled={occupe === c.id}
                          onClick={() => agir(c.id, () => supprimerMental(c.id))}>Supprimer</button>
                      </span>
                    </div>
                    {c.note && (
                      <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.6, marginTop: 7 }}>{c.note}</div>
                    )}
                  </div>
                ))}
              </div>
            </Carte>
          )}
        </div>
      )}
    </div>
  );
}
