"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Onglets from "@/components/carriere/Onglets";
import { Carte, Compteur, MONO, Pastille, Vide, btn, btnFantome, champ } from "@/components/carriere/Blocs";
import {
  accepterAction, creerCoaching, etatPack, listerCoachings, listerPacks, listerPrestations,
  majAction, monCompte, supprimerCoaching,
} from "@/lib/supabase/carriere";
import SuiviPrestation from "@/components/carriere/SuiviPrestation";

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
// Un rendez-vous sans heure ne sert à rien : « mardi » ne dit pas s'il faut être libre le matin
// ou le soir.
function dateHeure(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
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
  const [prestations, setPrestations] = useState([]);
  const [creneau, setCreneau] = useState({ quand: "", duree: "60" });
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
        const [liste, ps, prs] = await Promise.all([
          listerCoachings(c.id), listerPacks(c.id), listerPrestations(c.id),
        ]);
        setCoachings(liste);
        setPacks(ps);
        setPrestations(prs);
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
      <Onglets />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="titre" style={{ fontSize: 22, fontWeight: 700 }}>Mes coachings</div>
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
      {erreur && <div style={{ fontSize: 13, color: "var(--erreur)", marginBottom: 14 }}>{erreur}</div>}

      {etat === "pret" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Carte>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 14 }}>
              <Compteur valeur={faits.length} libelle="coachings réalisés" />
              <Compteur valeur={duree(minutes)} libelle="heures à vie" />
              {aVenir.length > 0 && <Compteur valeur={aVenir.length} libelle="à venir" couleur="var(--accent)" />}
            </div>
          </Carte>

          {/* Le créneau est convenu avec le coach AVANT, par message : cet écran ne demande
              rien à personne, il enregistre ce qui est déjà décidé. D'où l'absence de bouton
              « demander » ou d'état « en attente » — ce serait refaire à l'écran un accord
              déjà pris. La base, elle, empêche d'aller plus loin : un élève ne peut ni passer
              une séance à « faite », ni la déclarer payée (supabase/carriere-9-creneau-eleve.sql). */}
          <Carte titre="Mes créneaux" aide="Note ici le rendez-vous convenu avec Boris, pour qu'il apparaisse dans ton suivi.">
            {aVenir.length > 0 && (
              <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                {aVenir.map((c) => (
                  <div key={c.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                    flexWrap: "wrap", background: "var(--panel-2)", borderRadius: 10, padding: "10px 12px",
                  }}>
                    <span style={{ fontSize: 13 }}>
                      <strong>{dateHeure(c.date)}</strong>
                      <span style={{ color: "var(--text-muted)", fontFamily: MONO }}> · {duree(c.duree_min)}</span>
                    </span>
                    <button style={btnFantome} disabled={occupe === c.id}
                      onClick={() => agir(c.id, () => supprimerCoaching(c.id))}>
                      {occupe === c.id ? "…" : "Annuler"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input type="datetime-local" value={creneau.quand}
                onChange={(e) => setCreneau((c) => ({ ...c, quand: e.target.value }))}
                style={{ ...champ, width: "auto", fontSize: 12, padding: "7px 9px" }} />
              <select value={creneau.duree} onChange={(e) => setCreneau((c) => ({ ...c, duree: e.target.value }))}
                style={{ ...champ, width: "auto", fontSize: 12, padding: "7px 9px" }}>
                <option value="60">1 h</option>
                <option value="90">1 h 30</option>
                <option value="120">2 h</option>
              </select>
              <button style={btn} disabled={!creneau.quand || occupe === "creneau"}
                onClick={() => agir("creneau", async () => {
                  await creerCoaching(compte.id, {
                    date: new Date(creneau.quand).toISOString(),
                    duree_min: Number(creneau.duree),
                  }, compte.id);
                  setCreneau({ quand: "", duree: "60" });
                })}>
                {occupe === "creneau" ? "…" : "Noter mon créneau"}
              </button>
            </div>
          </Carte>

          {prestations.filter((p) => p.statut !== "annulee").length > 0 && (
            <Carte titre="Mes prestations" aide="Où en est ce que tu as commandé.">
              <div style={{ display: "grid", gap: 18 }}>
                {prestations.filter((p) => p.statut !== "annulee").map((p) => (
                  <SuiviPrestation key={p.id} prestation={p} />
                ))}
              </div>
            </Carte>
          )}

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
                          <Pastille couleur={e.expire_passe ? "var(--text-muted)" : e.expire_bientot ? "var(--attention)" : "var(--text-muted)"}>
                            {e.expire_passe ? "expiré" : `expire le ${new Date(e.expire).toLocaleDateString("fr-FR")}`}
                          </Pastille>
                        )}
                      </div>
                      {e.expire_bientot && (
                        <div style={{ fontSize: 11, color: "var(--attention)", marginTop: 8 }}>
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
                          <Pastille couleur={c.statut === "fait" ? "var(--accent)" : "var(--info)"}>
                            {c.statut === "fait" ? "fait" : "à venir"}
                          </Pastille>
                          <Pastille couleur={c.paiement === "paye" ? "var(--accent)" : c.paiement === "pack" ? "var(--info)" : "var(--attention)"}>
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
