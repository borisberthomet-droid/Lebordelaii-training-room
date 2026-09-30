"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Onglets from "@/components/carriere/Onglets";
import { Carte, Jauge, MONO, Pastille, Vide, btn, btnFantome, champ } from "@/components/carriere/Blocs";
import {
  chargerTaches, creerRoutine, creerTache, listerRoutines, majTache,
  materialiserRoutines, monCompte, supprimerRoutine, supprimerTache,
} from "@/lib/supabase/carriere";
import {
  JOURS, aujourdhui, decalerJours, enRetard, joursDeSemaine, libelleCourt, libelleSemaine,
  lundiDe, tauxAccomplissement,
} from "@/lib/carriere/semaine";

// Ma semaine : une to-do générale à gauche, sept colonnes à droite, et le glisser-déposer entre
// les deux.
//
// Deux règles de fonctionnement qui viennent du produit, pas de la technique :
//   - une tâche non faite NE BOUGE PAS toute seule. Elle reste sur son jour, marquée en retard.
//     C'est au joueur de décider de la reporter — un report automatique transforme la semaine en
//     dette qui s'empile toute seule.
//   - le coach lit, il ne touche pas. Les policies l'interdisent, l'écran n'en propose même pas.
//
// Le glisser-déposer natif ne marche pas au doigt : chaque tâche porte aussi un menu de jour, qui
// fait la même chose au clavier comme au tactile.

const AUTRE = "__todo__";

// Une tâche, où qu'elle soit posée. Composant de module et non fonction interne : défini dans le
// rendu du parent, il serait recréé à chaque frappe et la case à cocher perdrait le focus.
function Tache({ t, dansBacklog, jours, jour, occupe, onBasculer, onDeplacer, onSupprimer, onGlisse }) {
  const retard = enRetard(t, jour);
  return (
    <div
      draggable
      onDragStart={() => onGlisse(t)}
      onDragEnd={() => onGlisse(null)}
      style={{
        background: "var(--panel-2)", borderRadius: 8, padding: "8px 10px",
        border: `1px solid ${retard ? "rgba(232,197,71,0.5)" : "var(--border)"}`,
        opacity: t.fait ? 0.55 : 1, cursor: "grab", display: "grid", gap: 6,
      }}
    >
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={t.fait} disabled={occupe === t.id} onChange={() => onBasculer(t)}
          style={{ accentColor: "var(--accent)", width: 15, height: 15, marginTop: 2 }} />
        <span style={{ fontSize: 12, lineHeight: 1.5, textDecoration: t.fait ? "line-through" : "none" }}>
          {t.titre}
          {t.origine === "coaching" && <span style={{ color: "var(--text-muted)" }}> · coaching</span>}
          {t.routine_id && <span style={{ color: "var(--text-muted)" }}> · routine</span>}
        </span>
      </label>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={dansBacklog ? AUTRE : t.jour}
          onChange={(e) => onDeplacer(t, e.target.value)}
          aria-label="Déplacer la tâche"
          style={{
            background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text-muted)",
            borderRadius: 6, fontSize: 10, padding: "2px 4px",
          }}
        >
          <option value={AUTRE}>to-do</option>
          {jours.map((j, i) => <option key={j} value={j}>{JOURS[i]} {libelleCourt(j)}</option>)}
        </select>
        {retard && <Pastille couleur="var(--attention)">en retard</Pastille>}
        <button onClick={() => onSupprimer(t)} disabled={occupe === t.id}
          style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>
          supprimer
        </button>
      </div>
    </div>
  );
}

export default function SemainePage() {
  const [compte, setCompte] = useState(null);
  const [lundi, setLundi] = useState(lundiDe());
  const [backlog, setBacklog] = useState([]);
  const [semaine, setSemaine] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [etat, setEtat] = useState("chargement");
  const [erreur, setErreur] = useState(null);
  const [nouvelle, setNouvelle] = useState("");
  const [nouvelleRoutine, setNouvelleRoutine] = useState({ titre: "", jours: [] });
  const [occupe, setOccupe] = useState(null);
  const [glisse, setGlisse] = useState(null);

  const jours = joursDeSemaine(lundi);
  const jour = aujourdhui();

  const charger = useCallback(async (userId, debut) => {
    const recs = await listerRoutines(userId);
    const { backlog: b, semaine: s } = await chargerTaches(userId, debut);
    // Les routines de la semaine affichée sont posées à l'ouverture : tant que personne
    // ne regarde la semaine, rien n'est créé en base.
    const ajoutees = await materialiserRoutines(userId, debut, recs, s);
    setRoutines(recs);
    setBacklog(b);
    setSemaine([...s, ...ajoutees]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const c = await monCompte();
        if (!c) { setEtat("horsligne"); return; }
        setCompte(c);
        await charger(c.id, lundi);
        setEtat("pret");
      } catch (e) { setErreur(e.message); setEtat("erreur"); }
    })();
  }, [charger, lundi]);

  const recharger = async () => { if (compte) await charger(compte.id, lundi); };

  const agir = async (cle, fn) => {
    setOccupe(cle); setErreur(null);
    try { await fn(); await recharger(); }
    catch (e) { setErreur(e.message); }
    finally { setOccupe(null); }
  };

  const ajouterTache = (jourCible) => {
    const titre = nouvelle.trim();
    if (!titre) return;
    return agir("ajout", async () => {
      await creerTache(compte.id, { titre, jour: jourCible || null });
      setNouvelle("");
    });
  };

  const deplacer = (tache, cible) => {
    const nouveauJour = cible === AUTRE ? null : cible;
    if (nouveauJour === tache.jour) return;
    return agir(tache.id, () => majTache(tache.id, { jour: nouveauJour }));
  };

  const basculer = (t) =>
    agir(t.id, () => majTache(t.id, { fait: !t.fait, fait_le: t.fait ? null : new Date().toISOString() }));

  const ajouterRoutine = () => {
    const titre = nouvelleRoutine.titre.trim();
    if (!titre || !nouvelleRoutine.jours.length) return;
    return agir("rec", async () => {
      await creerRoutine(compte.id, titre, nouvelleRoutine.jours);
      setNouvelleRoutine({ titre: "", jours: [] });
    });
  };

  const taux = tauxAccomplissement(semaine);
  // Ce que chaque tâche a besoin de savoir, rassemblé une fois.
  const commandes = {
    jours, jour, occupe,
    onBasculer: basculer,
    onDeplacer: deplacer,
    onSupprimer: (t) => agir(t.id, () => supprimerTache(t.id)),
    onGlisse: setGlisse,
  };

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 1200, margin: "0 auto" }}>
      <Onglets />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="titre" style={{ fontSize: 22, fontWeight: 700 }}>Ma semaine</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            Glisse une tâche de ta to-do vers un jour. Rien ne se reporte tout seul.
          </div>
        </div>
        <Link href="/carriere" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Carrière</Link>
      </div>

      {etat === "chargement" && <Vide>Chargement…</Vide>}
      {etat === "horsligne" && (
        <Vide>Connecte-toi pour organiser ta semaine. <Link href="/login" style={{ color: "var(--accent)" }}>Se connecter</Link></Vide>
      )}
      {erreur && <div style={{ fontSize: 13, color: "var(--erreur)", marginBottom: 14 }}>{erreur}</div>}

      {etat === "pret" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <button style={btnFantome} onClick={() => setLundi(decalerJours(lundi, -7))}>← semaine précédente</button>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO }}>{libelleSemaine(lundi)}</span>
            <button style={btnFantome} onClick={() => setLundi(decalerJours(lundi, 7))}>semaine suivante →</button>
            {lundi !== lundiDe() && (
              <button style={btnFantome} onClick={() => setLundi(lundiDe())}>revenir à cette semaine</button>
            )}
            {taux && (
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, minWidth: 220 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{taux.faites}/{taux.total}</span>
                <span style={{ flex: 1 }}><Jauge pct={taux.pct} /></span>
                <span style={{ fontSize: 15, fontWeight: 800, fontFamily: MONO, color: "var(--accent)" }}>{taux.pct}%</span>
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 300px) 1fr", gap: 14, alignItems: "start" }}>
            {/* To-do générale */}
            <Carte
              titre="Ma to-do"
              aide="tout ce que tu veux faire, sans date"
              style={{
                outline: glisse && glisse.jour ? "2px dashed var(--accent)" : "none",
                outlineOffset: 3,
              }}
            >
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (glisse) { deplacer(glisse, AUTRE); setGlisse(null); } }}
                style={{ display: "grid", gap: 8, minHeight: 60 }}
              >
                {backlog.length
                  ? backlog.map((t) => <Tache key={t.id} t={t} dansBacklog {...commandes} />)
                  : <Vide>Vide. Ajoute ce que tu veux travailler : un report GTO Wizard, vingt spots, une review.</Vide>}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input value={nouvelle} onChange={(e) => setNouvelle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ajouterTache(null)}
                  placeholder="ex : driller 20 spots SRP IP"
                  style={{ ...champ, fontSize: 12, padding: "7px 9px" }} />
                <button style={btn} onClick={() => ajouterTache(null)} disabled={occupe === "ajout"}>+</button>
              </div>
            </Carte>

            {/* Les sept jours */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              {jours.map((j, i) => {
                const dedans = semaine.filter((t) => t.jour === j).sort((a, b) => a.ordre - b.ordre);
                const cJour = j === jour;
                return (
                  <div
                    key={j}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (glisse) { deplacer(glisse, j); setGlisse(null); } }}
                    style={{
                      background: "var(--panel)", border: `1px solid ${cJour ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 12, padding: 10, minHeight: 120,
                      outline: glisse ? "1px dashed var(--border)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cJour ? "var(--accent)" : "var(--text)" }}>
                        {JOURS[i]}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: MONO }}>{libelleCourt(j)}</span>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {dedans.map((t) => <Tache key={t.id} t={t} {...commandes} />)}
                    </div>
                    <button
                      onClick={() => { const titre = nouvelle.trim(); if (titre) ajouterTache(j); }}
                      disabled={!nouvelle.trim() || occupe === "ajout"}
                      style={{
                        marginTop: 8, width: "100%", background: "none", border: "1px dashed var(--border)",
                        color: "var(--text-muted)", borderRadius: 8, fontSize: 11, padding: "5px 0",
                        cursor: nouvelle.trim() ? "pointer" : "default",
                      }}
                    >
                      + ici
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Récurrences */}
          <Carte titre="Mes routines" aide="ce que tu refais chaque semaine — posé automatiquement sur les jours choisis" style={{ marginTop: 14 }}>
            {routines.length > 0 && (
              <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
                {routines.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontSize: 12 }}>
                    <span>
                      {r.titre}
                      <span style={{ color: "var(--text-muted)" }}>
                        {" — "}{(r.jours || []).map((n) => JOURS[n - 1]).join(", ")}
                      </span>
                    </span>
                    <button style={btnFantome} disabled={occupe === r.id}
                      onClick={() => agir(r.id, () => supprimerRoutine(r.id))}>
                      Arrêter
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input value={nouvelleRoutine.titre} onChange={(e) => setNouvelleRoutine((r) => ({ ...r, titre: e.target.value }))}
                placeholder="ex : review des mains taguées"
                style={{ ...champ, flex: 1, minWidth: 200, fontSize: 12, padding: "7px 9px" }} />
              {JOURS.map((nom, i) => {
                const n = i + 1;
                const actif = nouvelleRoutine.jours.includes(n);
                return (
                  <button key={nom} onClick={() => setNouvelleRoutine((r) => ({
                    ...r, jours: actif ? r.jours.filter((x) => x !== n) : [...r.jours, n],
                  }))} style={{
                    padding: "5px 9px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                    border: `1px solid ${actif ? "var(--accent)" : "var(--border)"}`,
                    background: actif ? "rgba(52,211,153,0.14)" : "var(--panel-2)",
                    color: actif ? "var(--accent)" : "var(--text-muted)",
                  }}>
                    {nom.slice(0, 3)}
                  </button>
                );
              })}
              <button style={btn} onClick={ajouterRoutine}
                disabled={occupe === "rec" || !nouvelleRoutine.titre.trim() || !nouvelleRoutine.jours.length}>
                Ajouter
              </button>
            </div>
          </Carte>
        </>
      )}
    </div>
  );
}
