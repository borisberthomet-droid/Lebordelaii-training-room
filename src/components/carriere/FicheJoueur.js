"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Carte, Compteur, Jauge, Pastille, StatFocus, Vide, MONO,
  STATUT_AXE, HORIZONS, btnFantome,
} from "./Blocs";
import { accepterAction, majAction, majAxe, majTache, packActif } from "@/lib/supabase/carriere";
import { aujourdhui, enRetard, libelleJour, tauxAccomplissement } from "@/lib/carriere/semaine";

// Le tableau de bord, partagé par le joueur (sur /carriere) et par le coach (sur la fiche d'un
// joueur). Même lecture des deux côtés : c'est voulu, le coach doit voir ce que voit le joueur
// avant un coaching. Seules les commandes changent — le coach ne coche pas les tâches d'un autre.
//
// Ce que la page doit répondre en une seconde : où j'en suis, ce que je dois améliorer, ce que je
// fais aujourd'hui, est-ce que je progresse.

function heuresLisibles(h) {
  const total = Math.round((h || 0) * 60);
  const heures = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${heures} h ${String(minutes).padStart(2, "0")}` : `${heures} h`;
}

function dateCourte(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function FicheJoueur({ fiche, compte, mode = "joueur", onRafraichir }) {
  const [enCours, setEnCours] = useState(null);
  const joueur = mode === "joueur";

  const { axes, objectifs, stats, coachings, packs, tachesSemaine, evaluations } = fiche;
  const axesActifs = axes.filter((a) => a.statut !== "maitrise");
  const focus = stats.filter((s) => s.statut === "focus");
  const faits = coachings.filter((c) => c.statut === "fait");
  const minutes = faits.reduce((s, c) => s + (c.duree_min || 0), 0);
  const dernier = faits[0] || null;
  const prochain = [...coachings].reverse().find((c) => c.statut === "a_venir" && new Date(c.date) >= new Date());
  const pack = packActif(packs, coachings);
  const taux = tauxAccomplissement(tachesSemaine);
  const jour = aujourdhui();
  const duJour = tachesSemaine.filter((t) => t.jour === jour).sort((a, b) => a.ordre - b.ordre);
  const retards = tachesSemaine.filter((t) => enRetard(t, jour));
  const actions = coachings.flatMap((c) => (c.coaching_actions || []).filter((a) => a.statut === "propose"));
  const derniereEval = evaluations[0] || null;

  const agir = async (cle, fn) => {
    setEnCours(cle);
    try { await fn(); await onRafraichir?.(); }
    finally { setEnCours(null); }
  };

  const syntheseVisible = dernier && (dernier.synthese_statut === "valide" || mode === "coach");
  const pointsCles = syntheseVisible ? (dernier.synthese?.points_cles || "") : "";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Bandeau de compteurs : le suivi coaching en un coup d'œil. */}
      <Carte>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
          <Compteur valeur={faits.length} libelle="coachings réalisés" />
          <Compteur valeur={heuresLisibles(minutes / 60)} libelle="heures à vie" />
          <Compteur valeur={dateCourte(dernier?.date)} libelle="dernier coaching" />
          <Compteur valeur={dateCourte(prochain?.date)} libelle="prochain" couleur={prochain ? "var(--accent)" : undefined} />
          {pack && (
            <Compteur
              valeur={`${pack.etat.restantes} h`}
              libelle={`restantes sur ${pack.etat.achetees} h${pack.etat.expire ? ` · jusqu'au ${dateCourte(pack.etat.expire)}` : ""}`}
              couleur={pack.etat.expire_bientot ? "#E8C547" : undefined}
            />
          )}
        </div>
        {pack?.etat.expire_bientot && (
          <div style={{
            marginTop: 12, fontSize: 12, color: "#E8C547", background: "rgba(232,197,71,0.10)",
            border: "1px solid rgba(232,197,71,0.35)", borderRadius: 10, padding: "8px 12px",
          }}>
            Ton pack expire dans {pack.etat.joursRestants} jour{pack.etat.joursRestants > 1 ? "s" : ""} et il te
            reste {pack.etat.restantes} h. Au-delà, les heures non utilisées sont perdues.
          </div>
        )}
      </Carte>

      {/* Ce qu'il faut améliorer : les trois stats en focus, l'élément le plus visible. */}
      <Carte
        titre="Mes 3 statistiques en focus"
        aide="définies avec ton coach dans le Leak Finder"
        action={joueur && <Link href="/carriere/leak-finder" style={{ fontSize: 12, color: "var(--accent)" }}>Leak Finder →</Link>}
      >
        {focus.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {focus.map((s) => <StatFocus key={s.id} stat={s} />)}
          </div>
        ) : (
          <Vide>Aucune statistique en focus pour l&apos;instant. Ton coach en fixe jusqu&apos;à trois après un Leak Finder.</Vide>
        )}
      </Carte>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {/* Axes techniques prioritaires. */}
        <Carte titre="Mes axes de travail" aide="trois au maximum, définis avec le coach">
          {axesActifs.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {axesActifs.map((a) => {
                const st = STATUT_AXE[a.statut];
                return (
                  <div key={a.id} style={{ background: "var(--panel-2)", borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{a.titre}</span>
                      <Pastille couleur={st.couleur}>{st.label}</Pastille>
                    </div>
                    {a.detail && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>{a.detail}</div>
                    )}
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, fontFamily: MONO }}>
                      depuis le {dateCourte(a.debut)}{a.fin ? ` · jusqu'au ${dateCourte(a.fin)}` : ""}
                    </div>
                    {joueur && a.statut !== "maitrise" && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {a.statut === "a_travailler" && (
                          <button style={btnFantome} disabled={enCours === a.id}
                            onClick={() => agir(a.id, () => majAxe(a.id, { statut: "en_cours" }))}>
                            Je m&apos;y mets
                          </button>
                        )}
                        <button style={btnFantome} disabled={enCours === a.id}
                          onClick={() => agir(a.id, () => majAxe(a.id, { statut: "maitrise", fin: jour }))}>
                          Je le maîtrise
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Vide>Pas d&apos;axe actif. C&apos;est ton coach qui les fixe, en général pour un trimestre.</Vide>
          )}
        </Carte>

        {/* Objectifs. */}
        <Carte
          titre="Mes objectifs"
          action={joueur && <Link href="/carriere/objectifs" style={{ fontSize: 12, color: "var(--accent)" }}>Modifier →</Link>}
        >
          {objectifs.length ? (
            <div style={{ display: "grid", gap: 12 }}>
              {["vision", "annee", "trimestre"].map((h) => {
                const liste = objectifs.filter((o) => o.horizon === h && o.statut === "en_cours");
                if (!liste.length) return null;
                return (
                  <div key={h}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{HORIZONS[h].label}</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                      {liste.map((o) => <li key={o.id}>{o.texte}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <Vide>Rien d&apos;écrit pour l&apos;instant. Une vision, un objectif à un an, trois objectifs pour le trimestre : ça suffit.</Vide>
          )}
        </Carte>
      </div>

      {/* La semaine : le taux, les tâches du jour, les retards. */}
      <Carte
        titre="Ma semaine"
        aide={taux ? `${taux.faites} tâches faites sur ${taux.total}` : "aucune tâche posée cette semaine"}
        action={joueur && <Link href="/carriere/semaine" style={{ fontSize: 12, color: "var(--accent)" }}>Planning →</Link>}
      >
        {taux && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>accomplissement</span>
              <span style={{ fontSize: 18, fontWeight: 800, fontFamily: MONO, color: "var(--accent)" }}>{taux.pct}%</span>
            </div>
            <Jauge pct={taux.pct} />
          </div>
        )}

        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
          Aujourd&apos;hui — {libelleJour(jour)}
        </div>
        {duJour.length ? (
          <div style={{ display: "grid", gap: 6 }}>
            {duJour.map((t) => (
              <label key={t.id} style={{
                display: "flex", alignItems: "center", gap: 10, background: "var(--panel-2)",
                borderRadius: 8, padding: "8px 10px", fontSize: 13,
                cursor: joueur ? "pointer" : "default", opacity: t.fait ? 0.55 : 1,
              }}>
                <input type="checkbox" checked={t.fait} disabled={!joueur || enCours === t.id}
                  onChange={() => agir(t.id, () => majTache(t.id, { fait: !t.fait, fait_le: t.fait ? null : new Date().toISOString() }))}
                  style={{ accentColor: "#34D399", width: 16, height: 16 }} />
                <span style={{ textDecoration: t.fait ? "line-through" : "none" }}>{t.titre}</span>
              </label>
            ))}
          </div>
        ) : (
          <Vide>Rien de prévu aujourd&apos;hui.</Vide>
        )}

        {retards.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#E8C547" }}>
            {retards.length} tâche{retards.length > 1 ? "s" : ""} en retard cette semaine — à toi de décider si tu la
            {retards.length > 1 ? "s " : " "}déplaces.
          </div>
        )}
      </Carte>

      {/* Actions proposées après un coaching : rien n'entre dans la to-do sans l'accord du joueur. */}
      {actions.length > 0 && (
        <Carte titre="Actions proposées après ton dernier coaching" aide="rien n'est ajouté sans ton accord">
          <div style={{ display: "grid", gap: 8 }}>
            {actions.map((a) => (
              <div key={a.id} style={{
                background: "var(--panel-2)", borderRadius: 10, padding: 12,
                display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontSize: 13 }}>{a.texte}</div>
                  {(a.frequence || a.echeance) && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                      {a.frequence}{a.frequence && a.echeance ? " · " : ""}{a.echeance ? `avant le ${dateCourte(a.echeance)}` : ""}
                    </div>
                  )}
                </div>
                {joueur && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={btnFantome} disabled={enCours === a.id}
                      onClick={() => agir(a.id, () => accepterAction(a, compte.id))}>
                      Ajouter à ma to-do
                    </button>
                    <button style={btnFantome} disabled={enCours === a.id}
                      onClick={() => agir(a.id, () => majAction(a.id, { statut: "ignore" }))}>
                      Ignorer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Carte>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {/* Dernier coaching. */}
        <Carte
          titre="Dernier coaching"
          action={joueur && <Link href="/carriere/coachings" style={{ fontSize: 12, color: "var(--accent)" }}>Historique →</Link>}
        >
          {dernier ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {dateCourte(dernier.date)} · {heuresLisibles((dernier.duree_min || 0) / 60)}
              </div>
              {pointsCles ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {pointsCles.split("\n").slice(0, 3).join("\n")}
                </div>
              ) : (
                <Vide>
                  {dernier.synthese_statut === "brouillon"
                    ? "La synthèse est en cours de relecture par le coach."
                    : "Pas encore de synthèse."}
                </Vide>
              )}
            </>
          ) : (
            <Vide>Aucun coaching enregistré.</Vide>
          )}
        </Carte>

        {/* Auto-évaluation. */}
        <Carte
          titre="Mon auto-évaluation"
          action={joueur && <Link href="/carriere/auto-evaluation" style={{ fontSize: 12, color: "var(--accent)" }}>Ma carte →</Link>}
        >
          {derniereEval ? (
            <div style={{ fontSize: 13 }}>
              Dernière le {dateCourte(derniereEval.date)}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.7 }}>
                {evaluations.length} évaluation{evaluations.length > 1 ? "s" : ""} enregistrée{evaluations.length > 1 ? "s" : ""}.
                Refais-en une tous les trois à six mois pour voir la forme bouger.
              </div>
            </div>
          ) : (
            <Vide>Pas encore d&apos;auto-évaluation. Compte vingt minutes la première fois.</Vide>
          )}
        </Carte>
      </div>
    </div>
  );
}
