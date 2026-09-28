"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SkillRadar from "@/components/SkillRadar";
import { Carte, MONO, Pastille, Vide, btn, btnFantome, champ } from "@/components/carriere/Blocs";
import {
  enregistrerEvaluation, listerCompetences, listerEvaluations, monCompte,
} from "@/lib/supabase/carriere";

// Auto-évaluation : le joueur se note de 0 à 100 sur chaque compétence, et ça donne une carte.
//
// Le radar ne trace pas les vingt-trois compétences — ça ferait une forme illisible. Il trace les
// GROUPES (`skill_items.groupe`), moyenne des compétences qu'ils contiennent : sept branches, une
// forme qu'on reconnaît d'un coup d'œil, et une nouvelle compétence rejoint un groupe existant
// sans toucher au code.

const FAMILLES = [
  { id: "technique", label: "Technique" },
  { id: "apprentissage", label: "Apprentissage" },
  { id: "gestion", label: "Gestion et carrière" },
];

function dateCourte(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

// Moyenne des notes d'un groupe, pondérée à parts égales. Une compétence non notée ne compte pas :
// zéro et « pas répondu » ne veulent pas dire la même chose.
function moyennes(competences, scores) {
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

export default function AutoEvaluationPage() {
  const [compte, setCompte] = useState(null);
  const [competences, setCompetences] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [etat, setEtat] = useState("chargement");
  const [erreur, setErreur] = useState(null);

  const [saisie, setSaisie] = useState(null);      // null = on regarde la carte, objet = on remplit
  const [commentaire, setCommentaire] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = useCallback(async () => {
    const c = await monCompte();
    if (!c) { setEtat("horsligne"); return; }
    setCompte(c);
    const [items, evals] = await Promise.all([listerCompetences(), listerEvaluations(c.id)]);
    setCompetences(items);
    setEvaluations(evals);
    setEtat("pret");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await charger();
      } catch (e) { setErreur(e.message); setEtat("erreur"); }
    })();
  }, [charger]);

  const derniere = evaluations[0] || null;
  const precedente = evaluations[1] || null;

  const groupes = useMemo(
    () => [...new Set(competences.map((c) => c.groupe))],
    [competences]
  );
  const actuelles = useMemo(() => moyennes(competences, derniere?.scores), [competences, derniere]);
  const anciennes = useMemo(() => moyennes(competences, precedente?.scores), [competences, precedente]);

  const axes = groupes.map((g) => ({
    id: g, label: g, score: actuelles[g] ?? null, measured: actuelles[g] != null,
  }));
  const notes = Object.values(actuelles);
  const global = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : null;

  const commencer = () => {
    // On repart des dernières notes : une auto-évaluation, c'est surtout ajuster ce qui a bougé.
    setSaisie(Object.fromEntries(competences.map((c) => [c.id, derniere?.scores?.[c.id] ?? 50])));
    setCommentaire("");
  };

  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      await enregistrerEvaluation(compte.id, saisie, commentaire);
      setSaisie(null);
      setEvaluations(await listerEvaluations(compte.id));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Auto-évaluation</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            Note-toi de 0 à 100. À refaire tous les trois à six mois, pas plus souvent.
          </div>
        </div>
        <Link href="/carriere" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Carrière</Link>
      </div>

      {etat === "chargement" && <Vide>Chargement…</Vide>}
      {etat === "horsligne" && (
        <Vide>Connecte-toi pour t&apos;auto-évaluer. <Link href="/login" style={{ color: "var(--accent)" }}>Se connecter</Link></Vide>
      )}
      {erreur && (
        <div style={{ fontSize: 13, color: "#E0645A", marginBottom: 14, lineHeight: 1.7 }}>{erreur}</div>
      )}

      {etat === "pret" && !saisie && (
        <div style={{ display: "grid", gap: 14 }}>
          {/* La carte joueur : une note globale, une forme, et ce qui a bougé depuis la dernière fois. */}
          <Carte
            titre="Ma carte"
            aide={derniere ? `dernière évaluation le ${dateCourte(derniere.date)}` : "aucune évaluation pour l'instant"}
            action={<button style={btn} onClick={commencer}>{derniere ? "Refaire mon évaluation" : "Faire ma première évaluation"}</button>}
          >
            {derniere ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
                    <div style={{ fontSize: 44, fontWeight: 800, fontFamily: MONO, color: "var(--accent)", lineHeight: 1 }}>
                      {global}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>note globale<br />moyenne de tes axes</div>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
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
                              <Pastille couleur={delta > 0 ? "#34D399" : "#E0645A"}>
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
            ) : (
              <Vide>
                Note-toi une première fois : c&apos;est ce qui permettra de voir ton évolution dans six mois.
                Compte une vingtaine de minutes, et sois franc — cette carte n&apos;est lue que par toi et ton coach.
              </Vide>
            )}
          </Carte>

          {evaluations.length > 1 && (
            <Carte titre="Évolution" aide="une colonne par évaluation, de la plus récente à la plus ancienne">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                      <th style={{ padding: "6px 8px", fontWeight: 500 }}>Axe</th>
                      {evaluations.slice(0, 5).map((e) => (
                        <th key={e.id} style={{ padding: "6px 8px", fontWeight: 500, fontFamily: MONO }}>{dateCourte(e.date)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupes.map((g) => (
                      <tr key={g} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 8px" }}>{g}</td>
                        {evaluations.slice(0, 5).map((e) => {
                          const m = moyennes(competences, e.scores)[g];
                          return (
                            <td key={e.id} style={{ padding: "6px 8px", fontFamily: MONO, color: m == null ? "var(--text-muted)" : "var(--text)" }}>
                              {m ?? "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Carte>
          )}
        </div>
      )}

      {etat === "pret" && saisie && (
        <div style={{ display: "grid", gap: 14 }}>
          {FAMILLES.map((f) => {
            const liste = competences.filter((c) => c.famille === f.id);
            if (!liste.length) return null;
            return (
              <Carte key={f.id} titre={f.label}>
                <div style={{ display: "grid", gap: 12 }}>
                  {liste.map((c) => (
                    <div key={c.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                        <span style={{ fontSize: 13 }}>{c.libelle}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO, color: "var(--accent)" }}>
                          {saisie[c.id]}
                        </span>
                      </div>
                      <input
                        type="range" min={0} max={100} step={5} value={saisie[c.id]}
                        onChange={(e) => setSaisie((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
                        aria-label={c.libelle}
                        style={{ width: "100%", accentColor: "#34D399" }}
                      />
                    </div>
                  ))}
                </div>
              </Carte>
            );
          })}

          <Carte titre="Un mot sur le moment" aide="facultatif — ce que tu veux retenir de cette évaluation">
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={3}
              placeholder="ex : sortie de six mois sans jouer, je me remets en route"
              style={{ ...champ, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button style={btn} onClick={enregistrer} disabled={enregistrement}>
                {enregistrement ? "…" : "Enregistrer mon évaluation"}
              </button>
              <button style={btnFantome} onClick={() => setSaisie(null)} disabled={enregistrement}>Annuler</button>
              <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>
                Chaque enregistrement crée un instantané daté : les précédents ne sont jamais écrasés.
              </span>
            </div>
          </Carte>
        </div>
      )}
    </div>
  );
}
