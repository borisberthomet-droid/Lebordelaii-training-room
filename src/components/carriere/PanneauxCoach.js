"use client";

import { useState } from "react";
import {
  Carte, MONO, Pastille, STATUT_AXE, Vide, btn, btnFantome, champ, libelleTarget,
} from "./Blocs";
import {
  ajouterNote, chargerBrouillon, creerActions, creerAxe, creerCoaching, creerPack, creerPrestation,
  creerStat, enregistrerBrouillon, envoyerCapture, etatPack, majAxe, majCoaching, majPrestation,
  majStat, supprimerAxe, supprimerCapture, supprimerCoaching, supprimerPack, supprimerPrestation,
  supprimerStat, validerStat, validerSynthese,
} from "@/lib/supabase/carriere";
import {
  avancer, encaisse, estTerminee, etapesFranchies, PAIEMENTS, prochaineEtape, reculer,
  resteAEncaisser, STATUTS, TYPES,
} from "@/lib/carriere/prestations";
import SuiviPrestation from "./SuiviPrestation";
import CourbeMental from "./CourbeMental";
import {
  AXES as AXES_MENTAL, dernier as dernierMental, retardJours, serie as serieMentale,
  variation as variationMentale,
} from "@/lib/carriere/mental";

// Les écrans du coach. Ils sont regroupés ici parce qu'ils partagent la même mécanique : un
// formulaire court, une liste, et un bouton qui recharge la fiche. Le joueur ne voit jamais ces
// panneaux — ni par l'écran, ni par les policies.

const petit = { ...champ, fontSize: 12, padding: "7px 9px" };

function dateCourte(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

function useAction(onRafraichir) {
  const [occupe, setOccupe] = useState(null);
  const [erreur, setErreur] = useState(null);
  const agir = async (cle, fn) => {
    setOccupe(cle); setErreur(null);
    try { await fn(); await onRafraichir(); }
    catch (e) { setErreur(e.message); }
    finally { setOccupe(null); }
  };
  return { occupe, erreur, agir };
}

function Erreur({ message }) {
  if (!message) return null;
  return <div style={{ fontSize: 12, color: "var(--erreur)", marginTop: 10, lineHeight: 1.6 }}>{message}</div>;
}

// --- Axes prioritaires ---------------------------------------------------------------------------

export function PanneauAxes({ fiche, coachId, onRafraichir }) {
  const { occupe, erreur, agir } = useAction(onRafraichir);
  const [form, setForm] = useState({ titre: "", detail: "", fin: "" });
  const actifs = fiche.axes.filter((a) => a.statut !== "maitrise");
  const anciens = fiche.axes.filter((a) => a.statut === "maitrise");

  const ajouter = () => {
    if (!form.titre.trim()) return;
    return agir("ajout", async () => {
      await creerAxe(fiche.userId, {
        titre: form.titre.trim(),
        detail: form.detail.trim() || null,
        fin: form.fin || null,
      }, coachId);
      setForm({ titre: "", detail: "", fin: "" });
    });
  };

  return (
    <Carte titre="Axes prioritaires" aide="trois au maximum — la base refuse le quatrième">
      {actifs.length ? (
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {actifs.map((a) => (
            <div key={a.id} style={{ background: "var(--panel-2)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{a.titre}</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select value={a.statut} onChange={(e) => agir(a.id, () => majAxe(a.id, { statut: e.target.value }))}
                    disabled={occupe === a.id} aria-label="Statut de l'axe"
                    style={{ ...petit, width: "auto" }}>
                    {Object.entries(STATUT_AXE).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
                  </select>
                  <button style={btnFantome} disabled={occupe === a.id}
                    onClick={() => agir(a.id, () => supprimerAxe(a.id))}>Supprimer</button>
                </span>
              </div>
              {a.detail && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{a.detail}</div>}
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, fontFamily: MONO }}>
                {dateCourte(a.debut)}{a.fin ? ` → ${dateCourte(a.fin)}` : " → fin de trimestre"}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}><Vide>Aucun axe actif.</Vide></div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        <input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
          placeholder="ex : défense BB face aux petits cbets" style={petit} />
        <input value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
          placeholder="précision (facultatif)" style={petit} />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)" }}>jusqu&apos;au</label>
          <input type="date" value={form.fin} onChange={(e) => setForm((f) => ({ ...f, fin: e.target.value }))}
            style={{ ...petit, width: "auto" }} />
          <button style={btn} onClick={ajouter} disabled={occupe === "ajout" || !form.titre.trim()}>Ajouter l&apos;axe</button>
        </div>
      </div>

      {anciens.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.8 }}>
          Déjà maîtrisés : {anciens.map((a) => a.titre).join(" · ")}
        </div>
      )}
      <Erreur message={erreur} />
    </Carte>
  );
}

// --- Leak Finder ---------------------------------------------------------------------------------

export function PanneauLeak({ fiche, coachId, captures, liens, onRafraichir }) {
  const { occupe, erreur, agir } = useAction(onRafraichir);
  const [form, setForm] = useState({ nom: "", valeur_depart: "", valeur_actuelle: "", target_min: "", target_max: "", note: "" });
  const [notes, setNotes] = useState({});
  const [valeurs, setValeurs] = useState({});
  const [titreCapture, setTitreCapture] = useState("");
  const [survol, setSurvol] = useState(false);

  const envoyer = (fichiers) => agir("upload", async () => {
    for (const f of fichiers) await envoyerCapture(fiche.userId, f, titreCapture, coachId);
    setTitreCapture("");
  });

  const focus = fiche.stats.filter((s) => s.statut === "focus");
  const acquises = fiche.stats.filter((s) => s.statut === "acquise");
  const nombre = (v) => (v === "" || v == null ? null : Number(v));

  const ajouter = () => {
    if (!form.nom.trim()) return;
    return agir("ajout", async () => {
      const stat = await creerStat(fiche.userId, {
        nom: form.nom.trim(),
        valeur_depart: nombre(form.valeur_depart),
        valeur_actuelle: nombre(form.valeur_actuelle !== "" ? form.valeur_actuelle : form.valeur_depart),
        target_min: nombre(form.target_min),
        target_max: nombre(form.target_max),
      }, coachId);
      if (form.note.trim()) await ajouterNote(stat.id, form.note.trim(), coachId);
      setForm({ nom: "", valeur_depart: "", valeur_actuelle: "", target_min: "", target_max: "", note: "" });
    });
  };

  return (
    <Carte titre="Leak Finder" aide="trois statistiques en focus au maximum">
      {focus.length ? (
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          {focus.map((s) => (
            <div key={s.id} style={{ background: "var(--panel-2)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{s.nom}</span>
                <span style={{ fontSize: 12, fontFamily: MONO, color: "var(--text-muted)" }}>
                  {s.valeur_depart != null ? `${s.valeur_depart} → ` : ""}{s.valeur_actuelle ?? "—"} · cible {libelleTarget(s)}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input type="number" step="0.1" placeholder="valeur relevée"
                  value={valeurs[s.id] ?? ""} onChange={(e) => setValeurs((v) => ({ ...v, [s.id]: e.target.value }))}
                  style={{ ...petit, width: 130 }} />
                <button style={btnFantome} disabled={occupe === s.id || valeurs[s.id] == null || valeurs[s.id] === ""}
                  onClick={() => agir(s.id, () => majStat(s.id, { valeur_actuelle: Number(valeurs[s.id]) }))}>
                  Mettre à jour
                </button>
                <button style={btn} disabled={occupe === s.id}
                  onClick={() => agir(s.id, () => validerStat(s.id, Number(valeurs[s.id] ?? s.valeur_actuelle)))}>
                  Valider
                </button>
                <button style={btnFantome} disabled={occupe === s.id}
                  onClick={() => agir(s.id, () => supprimerStat(s.id))}>Supprimer</button>
              </div>

              {s.notes[0] && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>
                  <span style={{ fontFamily: MONO }}>{dateCourte(s.notes[0].created_at)}</span> — {s.notes[0].note}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <input value={notes[s.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                  placeholder="nouvelle note (l'ancienne est conservée)" style={{ ...petit, flex: 1, minWidth: 200 }} />
                <button style={btnFantome} disabled={occupe === s.id || !(notes[s.id] || "").trim()}
                  onClick={() => agir(s.id, async () => {
                    await ajouterNote(s.id, notes[s.id].trim(), coachId);
                    setNotes((n) => ({ ...n, [s.id]: "" }));
                  })}>
                  Ajouter la note
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}><Vide>Aucune statistique en focus.</Vide></div>
      )}

      {focus.length < 3 && (
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
            placeholder="ex : C-bet flop IP" style={petit} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="number" step="0.1" value={form.valeur_depart} placeholder="valeur actuelle"
              onChange={(e) => setForm((f) => ({ ...f, valeur_depart: e.target.value }))} style={{ ...petit, width: 130 }} />
            <input type="number" step="0.1" value={form.target_min} placeholder="cible min"
              onChange={(e) => setForm((f) => ({ ...f, target_min: e.target.value }))} style={{ ...petit, width: 110 }} />
            <input type="number" step="0.1" value={form.target_max} placeholder="cible max"
              onChange={(e) => setForm((f) => ({ ...f, target_max: e.target.value }))} style={{ ...petit, width: 110 }} />
          </div>
          <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="note de coach (facultatif)" style={petit} />
          <div>
            <button style={btn} onClick={ajouter} disabled={occupe === "ajout" || !form.nom.trim()}>
              Mettre en focus
            </button>
          </div>
        </div>
      )}

      {acquises.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.9, marginBottom: 14 }}>
          Acquises : {acquises.map((s) => `${s.nom} (${s.valeur_depart ?? "?"} → ${s.valeur_atteinte})`).join(" · ")}
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }} id="captures">
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Captures de statistiques</div>
        {captures.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
            {captures.map((c) => (
              <div key={c.id} style={{ background: "var(--panel-2)", borderRadius: 10, padding: 8 }}>
                {liens[c.id] && (
                  <a href={liens[c.id]} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={liens[c.id]} alt={c.titre || "capture"} style={{ width: "100%", borderRadius: 6, display: "block" }} />
                  </a>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{c.titre || dateCourte(c.created_at)}</span>
                  <button onClick={() => agir(c.id, () => supprimerCapture(c))} disabled={occupe === c.id}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 10, cursor: "pointer" }}>
                    retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <input value={titreCapture} onChange={(e) => setTitreCapture(e.target.value)}
          placeholder="titre des captures (ex : H2N postflop janvier)" style={{ ...petit, marginBottom: 8 }} />

        {/* Zone de dépôt : on peut faire glisser les captures Hand2Note dessus, ou cliquer. Un
            simple bouton « choisir un fichier » passait inaperçu au milieu du panneau. */}
        <label
          onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSurvol(false);
            const fichiers = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
            if (fichiers.length) envoyer(fichiers);
          }}
          style={{
            display: "block", textAlign: "center", cursor: "pointer",
            border: `1px dashed ${survol ? "var(--accent)" : "var(--border)"}`,
            background: survol ? "rgba(52,211,153,0.08)" : "var(--panel-2)",
            borderRadius: 10, padding: "18px 12px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: survol ? "var(--accent)" : "var(--text)" }}>
            {occupe === "upload" ? "Envoi en cours…" : "Déposer des captures ici"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            ou clique pour les choisir — captures Hand2Note, plusieurs à la fois
          </div>
          <input type="file" accept="image/*" multiple style={{ display: "none" }}
            onChange={(e) => {
              const fichiers = [...e.target.files];
              e.target.value = "";
              if (fichiers.length) envoyer(fichiers);
            }} />
        </label>
      </div>
      <Erreur message={erreur} />
    </Carte>
  );
}

// --- Coachings, synthèses, packs -----------------------------------------------------------------

const SECTIONS = [
  ["points_cles", "Points clés"],
  ["concepts", "Concepts travaillés"],
  ["leaks", "Erreurs et leaks identifiés"],
  ["decisions", "Décisions prises"],
  ["plan", "Plan de travail"],
  ["actions", "Avant le prochain coaching"],
];

// Prestations vendues : ce que l'élève a commandé, s'il a payé, et où ça en est.
//
// L'avancement se fait étape par étape, dans l'ordre, avec un bouton pour revenir sur un clic de
// trop. Pas de case à cocher libre : une prestation qui serait « à l'étape 3 sans être passée par
// la 2 » ne veut rien dire pour l'élève qui suit sa commande, et c'est lui le destinataire.
export function PanneauPrestations({ fiche, coachId, onRafraichir }) {
  const { occupe, erreur, agir } = useAction(onRafraichir);
  const [form, setForm] = useState({ type: "leakfinder", libelle: "", montant: "", commandee_le: "" });

  const prestations = fiche.prestations || [];
  const du = resteAEncaisser(prestations);
  const encaissé = encaisse(prestations);

  const ajouter = () => agir("ajout", async () => {
    const jour = form.commandee_le || new Date().toISOString().slice(0, 10);
    await creerPrestation(fiche.userId, {
      type: form.type,
      libelle: form.libelle.trim() || null,
      montant: form.montant === "" ? null : Number(form.montant),
      commandee_le: jour,
      // L'étape 1 est franchie par la commande elle-même : une prestation qui vient d'être vendue
      // n'est pas « à l'étape zéro », elle est commandée. Le suivi démarre donc à 1/4.
      jalons: { "1": jour },
    }, coachId);
    setForm({ type: "leakfinder", libelle: "", montant: "", commandee_le: "" });
  });

  const avancerDe = (p) => agir(p.id + "-av", async () => {
    const jalons = avancer(p);
    const finie = estTerminee({ ...p, jalons });
    await majPrestation(p.id, { jalons, statut: finie ? "terminee" : "en_cours" });
  });

  const reculerDe = (p) => agir(p.id + "-re", () =>
    majPrestation(p.id, { jalons: reculer(p), statut: "en_cours" }));

  return (
    <Carte titre="Prestations" aide="Ce que l'élève a commandé. Il voit ce suivi depuis son espace.">
      {prestations.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14, fontSize: 12, fontFamily: MONO }}>
          <span style={{ color: "var(--accent)" }}>{encaissé.toLocaleString("fr-FR")} € encaissés</span>
          {du > 0 && <span style={{ color: "var(--attention)" }}>{du.toLocaleString("fr-FR")} € en attente</span>}
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {prestations.length === 0 && <Vide>Aucune prestation enregistrée.</Vide>}

        {prestations.map((p) => {
          const statut = STATUTS[p.statut] || STATUTS.en_cours;
          const suivante = prochaineEtape(p);
          return (
            <div key={p.id} style={{ background: "var(--panel-2)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <Pastille couleur={statut.couleur}>{statut.label}</Pastille>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: MONO }}>
                  commandée le {dateCourte(p.commandee_le)}
                </span>
              </div>

              <SuiviPrestation prestation={p} />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                {suivante && p.statut !== "annulee" && (
                  <button style={btn} disabled={occupe === p.id + "-av"} onClick={() => avancerDe(p)}>
                    {occupe === p.id + "-av" ? "…" : `Passer à « ${suivante.titre} »`}
                  </button>
                )}
                {etapesFranchies(p) > 0 && (
                  <button style={btnFantome} disabled={occupe === p.id + "-re"} onClick={() => reculerDe(p)}>
                    Revenir
                  </button>
                )}

                <select value={p.paiement} style={{ ...petit, width: "auto" }}
                  onChange={(e) => agir(p.id + "-pay", () => majPrestation(p.id, {
                    paiement: e.target.value,
                    // La date d'encaissement se pose toute seule : c'est l'information que le
                    // coach cherchera dans six mois, et personne ne pense à la saisir.
                    paye_le: e.target.value === "recu" ? new Date().toISOString().slice(0, 10) : null,
                  }))}>
                  {Object.entries(PAIEMENTS).map(([cle, v]) => (
                    <option key={cle} value={cle}>{v.label}</option>
                  ))}
                </select>

                <input type="number" min="0" step="5" defaultValue={p.montant ?? ""} placeholder="€"
                  style={{ ...petit, width: 90 }}
                  onBlur={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    if (v !== (p.montant == null ? null : Number(p.montant))) {
                      agir(p.id + "-montant", () => majPrestation(p.id, { montant: v }));
                    }
                  }} />

                <select value={p.statut} style={{ ...petit, width: "auto" }}
                  onChange={(e) => agir(p.id + "-st", () => majPrestation(p.id, { statut: e.target.value }))}>
                  {Object.entries(STATUTS).map(([cle, v]) => (
                    <option key={cle} value={cle}>{v.label}</option>
                  ))}
                </select>

                <button style={{ ...btnFantome, marginLeft: "auto" }} disabled={occupe === p.id + "-sup"}
                  onClick={() => agir(p.id + "-sup", () => supprimerPrestation(p.id))}>Supprimer</button>
              </div>

              <textarea defaultValue={p.note || ""} rows={2} placeholder="Mot pour l'élève (il le verra sous le suivi)"
                style={{ ...petit, marginTop: 10, resize: "vertical" }}
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== (p.note || null)) agir(p.id + "-note", () => majPrestation(p.id, { note: v }));
                }} />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          style={{ ...petit, width: "auto" }}>
          {Object.entries(TYPES).map(([cle, v]) => <option key={cle} value={cle}>{v.label}</option>)}
        </select>
        <input value={form.libelle} placeholder="précision (facultatif)"
          onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))} style={{ ...petit, flex: "1 1 160px" }} />
        <input type="number" min="0" step="5" value={form.montant} placeholder="€"
          onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))} style={{ ...petit, width: 90 }} />
        <input type="date" value={form.commandee_le} title="date de commande, aujourd'hui par défaut"
          onChange={(e) => setForm((f) => ({ ...f, commandee_le: e.target.value }))} style={{ ...petit, width: "auto" }} />
        <button style={btn} disabled={occupe === "ajout"} onClick={ajouter}>
          {occupe === "ajout" ? "…" : "Ajouter"}
        </button>
      </div>

      <Erreur message={erreur} />
    </Carte>
  );
}

// Évaluation mentale de l'élève, en lecture seule.
//
// Le coach ne peut pas la remplir à sa place, et ce n'est pas un oubli : une auto-évaluation que
// l'on n'a pas écrite soi-même ne mesure plus rien. La base applique la même règle (policy
// « mental ecrit par son auteur »), donc l'écran ne fait que refléter ce qui est déjà vrai.
export function PanneauMental({ fiche }) {
  const checkins = fiche.mental || [];
  const retard = retardJours(checkins);
  const dernierCheckin = dernierMental(checkins);

  return (
    <Carte titre="Évaluation mentale" aide="Rempli par l'élève seul, tous les quinze jours.">
      {checkins.length === 0 ? (
        <Vide>Aucune évaluation pour le moment.</Vide>
      ) : (
        <>
          {retard != null && retard > 0 && (
            <div style={{ fontSize: 12, color: "var(--attention)", marginBottom: 12, lineHeight: 1.6 }}>
              {retard} jour{retard > 1 ? "s" : ""} de retard sur la prochaine évaluation.
            </div>
          )}

          <div style={{ display: "grid", gap: 16 }}>
            {AXES_MENTAL.map((a) => {
              const points = serieMentale(checkins, a.id);
              const delta = variationMentale(checkins, a.id);
              const actuel = points.length ? points[points.length - 1].valeur : null;
              return (
                <div key={a.id} style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 140 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: a.couleur }}>{a.label}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontSize: 18, fontWeight: 800, fontFamily: MONO }}>{actuel ?? "—"}</span>
                      {delta != null && (
                        <span style={{
                          fontSize: 11, fontFamily: MONO,
                          color: delta > 0 ? "var(--accent)" : delta < 0 ? "var(--erreur)" : "var(--text-muted)",
                        }}>{delta > 0 ? "+" : ""}{delta}</span>
                      )}
                    </div>
                  </div>
                  <CourbeMental points={points} couleur={a.couleur} largeur={190} hauteur={46} />
                </div>
              );
            })}
          </div>

          {/* Le commentaire de la dernière évaluation : c'est lui qui donne la matière d'une
              séance, pas les trois chiffres. */}
          {dernierCheckin?.note && (
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "var(--panel-2)", fontSize: 12, lineHeight: 1.7 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                Le {dateCourte(dernierCheckin.fait_le)}, il écrit :
              </div>
              {dernierCheckin.note}
            </div>
          )}
        </>
      )}
    </Carte>
  );
}

export function PanneauCoachings({ fiche, coachId, onRafraichir }) {
  const { occupe, erreur, agir } = useAction(onRafraichir);
  const [form, setForm] = useState({ date: "", duree_min: 60, statut: "a_venir", paiement: "a_payer", pack_id: "" });
  const [ouvert, setOuvert] = useState(null);
  const [brouillon, setBrouillon] = useState({});
  const [propositions, setPropositions] = useState("");
  const [pack, setPack] = useState({ heures: "", expire_le: "", note: "" });

  const ajouter = () => {
    if (!form.date) return;
    return agir("ajout", async () => {
      await creerCoaching(fiche.userId, {
        date: new Date(form.date).toISOString(),
        duree_min: Number(form.duree_min) || 60,
        statut: form.statut,
        paiement: form.paiement,
        pack_id: form.pack_id || null,
      }, coachId);
      setForm({ date: "", duree_min: 60, statut: "a_venir", paiement: "a_payer", pack_id: "" });
    });
  };

  const ouvrir = async (c) => {
    if (ouvert === c.id) { setOuvert(null); return; }
    setOuvert(c.id);
    setPropositions("");
    // Le brouillon vit dans une table que le joueur ne peut pas lire ; la synthese deja publiee
    // sert de point de depart quand il n'y a pas encore de brouillon.
    try {
      const contenu = await chargerBrouillon(c.id);
      setBrouillon(Object.keys(contenu).length ? contenu : (c.synthese || {}));
    } catch { setBrouillon(c.synthese || {}); }
  };

  return (
    <>
      <Carte titre="Packs d'heures">
        {fiche.packs.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {fiche.packs.map((p) => {
              const e = etatPack(p, fiche.coachings);
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
                  <span style={{ fontFamily: MONO }}>
                    {e.achetees} h · utilisées {e.utilisees} h · restantes{" "}
                    <strong style={{ color: e.restantes > 0 && !e.expire_passe ? "var(--accent)" : "var(--text-muted)" }}>{e.restantes} h</strong>
                    {e.expire ? ` · expire le ${dateCourte(e.expire)}` : ""}
                  </span>
                  <button style={btnFantome} disabled={occupe === p.id}
                    onClick={() => agir(p.id, () => supprimerPack(p.id))}>Supprimer</button>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input type="number" step="0.5" min="0.5" value={pack.heures} placeholder="heures"
            onChange={(e) => setPack((p) => ({ ...p, heures: e.target.value }))} style={{ ...petit, width: 100 }} />
          <label style={{ fontSize: 11, color: "var(--text-muted)" }}>expire le</label>
          <input type="date" value={pack.expire_le} onChange={(e) => setPack((p) => ({ ...p, expire_le: e.target.value }))}
            style={{ ...petit, width: "auto" }} />
          <button style={btn} disabled={occupe === "pack" || !pack.heures}
            onClick={() => agir("pack", async () => {
              await creerPack(fiche.userId, {
                heures: Number(pack.heures),
                expire_le: pack.expire_le || null,
                note: pack.note || null,
              }, coachId);
              setPack({ heures: "", expire_le: "", note: "" });
            })}>
            Ajouter le pack
          </button>
        </div>
        <Erreur message={erreur} />
      </Carte>

      <Carte titre="Coachings" aide="la synthèse n'est visible du joueur qu'une fois validée">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <input type="datetime-local" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            style={{ ...petit, width: "auto" }} />
          <input type="number" min="15" step="15" value={form.duree_min}
            onChange={(e) => setForm((f) => ({ ...f, duree_min: e.target.value }))}
            style={{ ...petit, width: 90 }} aria-label="Durée en minutes" />
          <select value={form.statut} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value }))}
            style={{ ...petit, width: "auto" }} aria-label="Statut">
            <option value="a_venir">à venir</option>
            <option value="fait">fait</option>
          </select>
          <select value={form.paiement} onChange={(e) => setForm((f) => ({ ...f, paiement: e.target.value }))}
            style={{ ...petit, width: "auto" }} aria-label="Paiement">
            <option value="a_payer">à payer</option>
            <option value="paye">payé</option>
            <option value="pack">sur pack</option>
          </select>
          {form.paiement === "pack" && fiche.packs.length > 0 && (
            <select value={form.pack_id} onChange={(e) => setForm((f) => ({ ...f, pack_id: e.target.value }))}
              style={{ ...petit, width: "auto" }} aria-label="Pack">
              <option value="">quel pack ?</option>
              {fiche.packs.map((p) => <option key={p.id} value={p.id}>{p.heures} h du {dateCourte(p.achete_le)}</option>)}
            </select>
          )}
          <button style={btn} onClick={ajouter} disabled={occupe === "ajout" || !form.date}>Ajouter</button>
        </div>

        {fiche.coachings.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {fiche.coachings.map((c) => (
              <div key={c.id} style={{ background: "var(--panel-2)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {dateCourte(c.date)} · {c.duree_min} min
                  </span>
                  <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={c.statut} onChange={(e) => agir(c.id, () => majCoaching(c.id, { statut: e.target.value }))}
                      style={{ ...petit, width: "auto" }} aria-label="Statut" disabled={occupe === c.id}>
                      <option value="a_venir">à venir</option>
                      <option value="fait">fait</option>
                    </select>
                    <select value={c.paiement} onChange={(e) => agir(c.id, () => majCoaching(c.id, { paiement: e.target.value }))}
                      style={{ ...petit, width: "auto" }} aria-label="Paiement" disabled={occupe === c.id}>
                      <option value="a_payer">à payer</option>
                      <option value="paye">payé</option>
                      <option value="pack">sur pack</option>
                    </select>
                    <Pastille couleur={c.synthese_statut === "valide" ? "var(--accent)" : "var(--attention)"}>
                      {c.synthese_statut === "valide" ? "synthèse validée" : "brouillon"}
                    </Pastille>
                    <button style={btnFantome} onClick={() => ouvrir(c)}>
                      {ouvert === c.id ? "Fermer" : "Synthèse"}
                    </button>
                    <button style={btnFantome} disabled={occupe === c.id}
                      onClick={() => agir(c.id, () => supprimerCoaching(c.id))}>Supprimer</button>
                  </span>
                </div>

                {ouvert === c.id && (
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                      La transcription audio arrivera plus tard : pour l&apos;instant la synthèse s&apos;écrit ou se colle ici.
                      Tant qu&apos;elle est en brouillon, le joueur ne la voit pas.
                    </div>
                    {SECTIONS.map(([cle, titre]) => (
                      <div key={cle}>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>{titre}</div>
                        <textarea rows={2} value={brouillon[cle] || ""}
                          onChange={(e) => setBrouillon((b) => ({ ...b, [cle]: e.target.value }))}
                          style={{ ...petit, resize: "vertical" }} />
                      </div>
                    ))}

                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
                        Actions à proposer <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>— une par ligne, le joueur accepte ou non</span>
                      </div>
                      <textarea rows={3} value={propositions} onChange={(e) => setPropositions(e.target.value)}
                        placeholder={"Driller 20 spots SRP IP par semaine pendant 4 semaines\nTaguer 30 mains de défense BB"}
                        style={{ ...petit, resize: "vertical" }} />
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={btnFantome} disabled={occupe === c.id}
                        onClick={() => agir(c.id, async () => {
                          await enregistrerBrouillon(c.id, brouillon);
                          if (propositions.trim()) {
                            await creerActions(c.id, fiche.userId, propositions.split("\n"));
                            setPropositions("");
                          }
                        })}>
                        Enregistrer le brouillon
                      </button>
                      <button style={btn} disabled={occupe === c.id}
                        onClick={() => agir(c.id, async () => {
                          await validerSynthese(c.id, brouillon);
                          if (propositions.trim()) {
                            await creerActions(c.id, fiche.userId, propositions.split("\n"));
                            setPropositions("");
                          }
                        })}>
                        Valider et ajouter au suivi
                      </button>
                    </div>

                    {(c.coaching_actions || []).length > 0 && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.8 }}>
                        Actions envoyées : {(c.coaching_actions || []).map((a) => `${a.texte} (${a.statut})`).join(" · ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Vide>Aucun coaching enregistré.</Vide>
        )}
        <Erreur message={erreur} />
      </Carte>
    </>
  );
}
