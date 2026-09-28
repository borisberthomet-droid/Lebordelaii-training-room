"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Carte, Compteur, MONO, Pastille, Vide, btnFantome } from "@/components/carriere/Blocs";
import {
  accepterAction, etatPack, listerCoachings, listerPacks, majAction, monCompte,
} from "@/lib/supabase/carriere";

// Historique des coachings, côté joueur : ce qui a été travaillé, les actions proposées, l'état du
// pack d'heures. Une synthèse n'apparaît ici qu'une fois validée par le coach — un brouillon est
// un document de travail, pas un compte rendu.

const SECTIONS = [
  ["points_cles", "Points clés"],
  ["concepts", "Concepts travaillés"],
  ["leaks", "Erreurs et leaks identifiés"],
  ["decisions", "Décisions prises"],
  ["plan", "Plan de travail"],
  ["actions", "Avant le prochain coaching"],
];

function dateLongue(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "long", year: "numeric" });
}
function duree(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export default function CoachingsPage() {
  const [compte, setCompte] = useState(null);
  const [coachings, setCoachings] = useState([]);
  const [packs, setPacks] = useState([]);
  const [etat, setEtat] = useState("chargement");
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(null);
  const [ouvert, setOuvert] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await monCompte();
        if (!c) { setEtat("horsligne"); return; }
        setCompte(c);
        const [liste, ps] = await Promise.all([listerCoachings(c.id), listerPacks(c.id)]);
        setCoachings(liste);
        setPacks(ps);
        setEtat("pret");
      } catch (e) { setErreur(e.message); setEtat("erreur"); }
    })();
  }, []);

  const recharger = async () => setCoachings(await listerCoachings(compte.id));
  const agir = async (cle, fn) => {
    setOccupe(cle); setErreur(null);
    try { await fn(); await recharger(); }
    catch (e) { setErreur(e.message); }
    finally { setOccupe(null); }
  };

  const faits = coachings.filter((c) => c.statut === "fait");
  const minutes = faits.reduce((s, c) => s + (c.duree_min || 0), 0);
  const aVenir = coachings.filter((c) => c.statut === "a_venir");

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Mes coachings</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            Ce qu&apos;on a travaillé, et ce qui reste à faire d&apos;ici la prochaine fois.
          </div>
        </div>
        <Link href="/carriere" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Carrière</Link>
      </div>

      {etat === "chargement" && <Vide>Chargement…</Vide>}
      {etat === "horsligne" && (
        <Vide>Connecte-toi pour voir tes coachings. <Link href="/login" style={{ color: "var(--accent)" }}>Se connecter</Link></Vide>
      )}
      {erreur && <div style={{ fontSize: 13, color: "#E0645A", marginBottom: 14 }}>{erreur}</div>}

      {etat === "pret" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Carte>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 14 }}>
              <Compteur valeur={faits.length} libelle="coachings réalisés" />
              <Compteur valeur={duree(minutes)} libelle="heures à vie" />
              {aVenir.length > 0 && <Compteur valeur={aVenir.length} libelle="à venir" couleur="var(--accent)" />}
            </div>
          </Carte>

          {packs.length > 0 && (
            <Carte titre="Mes packs d'heures">
              <div style={{ display: "grid", gap: 10 }}>
                {packs.map((p) => {
                  const e = etatPack(p, coachings);
                  return (
                    <div key={p.id} style={{ background: "var(--panel-2)", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                        <span style={{ fontSize: 13, fontFamily: MONO }}>
                          {e.achetees} h achetées · {e.utilisees} h utilisées ·{" "}
                          <strong style={{ color: e.restantes > 0 ? "var(--accent)" : "var(--text-muted)" }}>
                            {e.restantes} h restantes
                          </strong>
                        </span>
                        {e.expire && (
                          <Pastille couleur={e.expire_passe ? "var(--text-muted)" : e.expire_bientot ? "#E8C547" : "var(--text-muted)"}>
                            {e.expire_passe ? "expiré" : `expire le ${new Date(e.expire).toLocaleDateString("fr-FR")}`}
                          </Pastille>
                        )}
                      </div>
                      {e.expire_bientot && (
                        <div style={{ fontSize: 11, color: "#E8C547", marginTop: 8 }}>
                          Il te reste {e.restantes} h et {e.joursRestants} jour{e.joursRestants > 1 ? "s" : ""} pour les utiliser.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Carte>
          )}

          <Carte titre="Historique">
            {coachings.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {coachings.map((c) => {
                  const visible = c.synthese_statut === "valide";
                  const actions = (c.coaching_actions || []).filter((a) => a.statut === "propose");
                  return (
                    <div key={c.id} style={{ background: "var(--panel-2)", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {dateLongue(c.date)} · {duree(c.duree_min)}
                        </span>
                        <span style={{ display: "flex", gap: 6 }}>
                          <Pastille couleur={c.statut === "fait" ? "#34D399" : "#4FA8E0"}>
                            {c.statut === "fait" ? "fait" : "à venir"}
                          </Pastille>
                          <Pastille couleur={c.paiement === "paye" ? "#34D399" : c.paiement === "pack" ? "#4FA8E0" : "#E8C547"}>
                            {c.paiement === "paye" ? "payé" : c.paiement === "pack" ? "sur pack" : "à payer"}
                          </Pastille>
                        </span>
                      </div>

                      {visible ? (
                        <>
                          <button style={{ ...btnFantome, marginTop: 10 }}
                            onClick={() => setOuvert(ouvert === c.id ? null : c.id)}>
                            {ouvert === c.id ? "Masquer la synthèse" : "Voir la synthèse"}
                          </button>
                          {ouvert === c.id && (
                            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                              {SECTIONS.map(([cle, titre]) => {
                                const texte = c.synthese?.[cle];
                                if (!texte) return null;
                                return (
                                  <div key={cle}>
                                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>{titre}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                                      {texte}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        c.statut === "fait" && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                            Synthèse en cours de relecture par ton coach.
                          </div>
                        )
                      )}

                      {actions.length > 0 && (
                        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 600 }}>Actions proposées</div>
                          {actions.map((a) => (
                            <div key={a.id} style={{
                              display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center",
                              flexWrap: "wrap", background: "var(--panel)", borderRadius: 8, padding: "8px 10px",
                            }}>
                              <span style={{ fontSize: 12 }}>
                                {a.texte}
                                {a.frequence && <span style={{ color: "var(--text-muted)" }}> · {a.frequence}</span>}
                              </span>
                              <span style={{ display: "flex", gap: 6 }}>
                                <button style={btnFantome} disabled={occupe === a.id}
                                  onClick={() => agir(a.id, () => accepterAction(a, compte.id))}>
                                  Ajouter à ma to-do
                                </button>
                                <button style={btnFantome} disabled={occupe === a.id}
                                  onClick={() => agir(a.id, () => majAction(a.id, { statut: "ignore" }))}>
                                  Ignorer
                                </button>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Vide>Aucun coaching enregistré pour l&apos;instant.</Vide>
            )}
          </Carte>
        </div>
      )}
    </div>
  );
}
