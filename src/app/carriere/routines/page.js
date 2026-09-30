"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Onglets from "@/components/carriere/Onglets";
import { Carte, MONO, Pastille, Vide, btn, btnFantome, champ } from "@/components/carriere/Blocs";
import {
  chargerGrilleRoutines, creerRoutine, marquerRoutine, monCompte, saisirQuantite, supprimerRoutine,
} from "@/lib/supabase/carriere";
import {
  JOURS, aujourdhui, decalerJours, joursDeSemaine, libelleCourt, libelleSemaine, lundiDe,
} from "@/lib/carriere/semaine";
import { PERIODES, bilans, estPrevu, record, serie } from "@/lib/carriere/routines";

// Mes routines : ce qu'on répète, jour après jour.
//
// Deux choses que la page doit rendre évidentes :
//   - la CHAÎNE. Une case cochée à côté d'une autre, c'est une série ; la voir grandir est la
//     seule récompense d'une habitude. D'où la grille, la série en cours et le record.
//   - le CUMUL. « Drill ICM » sans nombre ne dit pas si la semaine valait dix spots ou deux cents.
//     Le joueur saisit la quantité dans la case, et les totaux du mois, du trimestre et de l'année
//     se calculent tout seuls.
//
// Une case non cochée ne vaut pas zéro : elle vaut « rien de saisi ». C'est pour ça qu'un jour
// fait sans quantité compte dans les jours mais pas dans le total — supposer « 1 » serait inventer.

// Palette des lignes, dans la famille de la marque.
const COULEURS = ["#5F6127", "#3A6851", "#8A6A1E", "#A0552A", "#7C5372", "#4E3E66", "#7A4E12", "#6A5A87"];

function Grille({ routines, parRoutine, lundi, jour, onBasculer, onQuantite, occupe }) {
  const jours = joursDeSemaine(lundi);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
        <thead>
          <tr style={{ color: "var(--text-muted)" }}>
            <th style={{ textAlign: "left", padding: "6px 10px 6px 0", fontWeight: 500, minWidth: 150 }}>Routine</th>
            {jours.map((j, i) => (
              <th key={j} style={{ padding: "4px 4px", fontWeight: 500, minWidth: 54 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: j === jour ? "var(--accent)" : "inherit" }}>
                  {JOURS[i].slice(0, 3)}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: j === jour ? "var(--accent)" : "inherit" }}>
                  {libelleCourt(j)}
                </div>
              </th>
            ))}
            <th style={{ padding: "4px 6px", fontWeight: 500 }}>Série</th>
            <th style={{ padding: "4px 6px", fontWeight: 500 }}>Record</th>
          </tr>
        </thead>
        <tbody>
          {routines.map((r, i) => {
            const entrees = parRoutine[r.id] || [];
            const index = Object.fromEntries(entrees.map((e) => [e.jour, e]));
            const couleur = r.couleur || COULEURS[i % COULEURS.length];
            return (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "7px 10px 7px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: couleur, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{r.titre}</span>
                    {r.unite && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>({r.unite})</span>}
                  </div>
                </td>
                {jours.map((j) => {
                  const e = index[j];
                  const prevu = estPrevu(r, j);
                  const futur = j > jour;
                  return (
                    <td key={j} style={{ padding: 2, textAlign: "center" }}>
                      <button
                        onClick={() => !futur && onBasculer(r, j, e)}
                        disabled={futur || occupe === `${r.id}|${j}`}
                        title={`${r.titre} · ${j}${e?.quantite != null ? ` · ${e.quantite} ${r.unite || ""}` : ""}`}
                        style={{
                          width: 42, height: 36, borderRadius: 8, cursor: futur ? "default" : "pointer",
                          border: `1px solid ${e?.fait ? couleur : "var(--border)"}`,
                          background: e?.fait ? couleur : prevu ? "var(--panel-2)" : "transparent",
                          color: "var(--sur-accent)", fontSize: 9, fontFamily: MONO,
                          opacity: futur ? 0.35 : 1, padding: 0,
                        }}
                      >
                        {e?.fait && e.quantite != null ? e.quantite : ""}
                      </button>
                      {e?.fait && r.unite && (
                        <input
                          type="number" inputMode="numeric" value={e.quantite ?? ""}
                          onChange={(ev) => onQuantite(e, ev.target.value)}
                          aria-label={`Quantité ${r.titre} ${j}`}
                          style={{
                            width: 42, marginTop: 3, padding: "2px 3px", fontSize: 10, textAlign: "center",
                            background: "var(--panel)", color: "var(--text)",
                            border: "1px solid var(--border)", borderRadius: 4, fontFamily: MONO,
                          }}
                        />
                      )}
                    </td>
                  );
                })}
                <td style={{ padding: "4px 6px", textAlign: "center" }}>
                  <span style={{
                    display: "inline-block", minWidth: 26, padding: "3px 6px", borderRadius: 999,
                    fontFamily: MONO, fontWeight: 700,
                    border: `1px solid ${couleur}`, color: couleur,
                  }}>
                    {serie(r, entrees, jour)}
                  </span>
                </td>
                <td style={{ padding: "4px 6px", textAlign: "center", fontFamily: MONO, color: "var(--text-muted)" }}>
                  {record(r, entrees, jour)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RoutinesPage() {
  const [compte, setCompte] = useState(null);
  const [routines, setRoutines] = useState([]);
  const [entrees, setEntrees] = useState([]);
  const [etat, setEtat] = useState("chargement");
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(null);
  const [lundi, setLundi] = useState(lundiDe());
  const [form, setForm] = useState({ titre: "", unite: "", jours: [] });

  const jour = aujourdhui();

  useEffect(() => {
    (async () => {
      try {
        const c = await monCompte();
        if (!c) { setEtat("horsligne"); return; }
        setCompte(c);
        const { routines: rs, entrees: es } = await chargerGrilleRoutines(c.id);
        setRoutines(rs);
        setEntrees(es);
        setEtat("pret");
      } catch (e) { setErreur(e.message); setEtat("erreur"); }
    })();
  }, []);

  const parRoutine = useMemo(() => {
    const paquets = {};
    for (const e of entrees) (paquets[e.routine_id] ||= []).push(e);
    return paquets;
  }, [entrees]);

  const basculer = async (routine, j, entree) => {
    setOccupe(`${routine.id}|${j}`); setErreur(null);
    try {
      const ligne = await marquerRoutine({
        userId: compte.id, routine, jour: j, fait: !entree?.fait, entree,
      });
      setEntrees((liste) => {
        const sans = liste.filter((x) => x.id !== ligne.id);
        return [...sans, ligne];
      });
    } catch (e) { setErreur(e.message); }
    finally { setOccupe(null); }
  };

  // La quantité s'écrit à la frappe côté écran, et part en base derrière : attendre la réponse
  // à chaque chiffre rendrait la saisie poussive.
  const quantite = (entree, valeur) => {
    setEntrees((liste) => liste.map((x) => (x.id === entree.id ? { ...x, quantite: valeur === "" ? null : Number(valeur) } : x)));
    saisirQuantite(entree.id, valeur).catch((e) => setErreur(e.message));
  };

  const ajouter = async () => {
    const titre = form.titre.trim();
    if (!titre) return;
    setOccupe("ajout"); setErreur(null);
    try {
      const r = await creerRoutine(compte.id, titre, form.jours, {
        unite: form.unite.trim() || null,
        couleur: COULEURS[routines.length % COULEURS.length],
        ordre: routines.length,
      });
      setRoutines((l) => [...l, r]);
      setForm({ titre: "", unite: "", jours: [] });
    } catch (e) { setErreur(e.message); }
    finally { setOccupe(null); }
  };

  const retirer = async (r) => {
    setOccupe(r.id);
    try { await supprimerRoutine(r.id); setRoutines((l) => l.filter((x) => x.id !== r.id)); }
    catch (e) { setErreur(e.message); }
    finally { setOccupe(null); }
  };

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 1100, margin: "0 auto" }}>
      <Onglets />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="titre" style={{ fontSize: 22, fontWeight: 700 }}>Ce que tu répètes</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            Coche chaque jour : plus la série s&apos;allonge, plus elle compte. Ne casse pas la chaîne.
          </div>
        </div>
        <Link href="/carriere" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Carrière</Link>
      </div>

      {etat === "chargement" && <Vide>Chargement…</Vide>}
      {etat === "horsligne" && (
        <Vide>Connecte-toi pour suivre tes routines. <Link href="/login" style={{ color: "var(--accent)" }}>Se connecter</Link></Vide>
      )}
      {erreur && <div style={{ fontSize: 13, color: "var(--erreur)", marginBottom: 14 }}>{erreur}</div>}

      {etat === "pret" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Carte
            titre="Ma semaine de routines"
            aide={libelleSemaine(lundi)}
            action={
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button style={btnFantome} onClick={() => setLundi(decalerJours(lundi, -7))}>← semaine précédente</button>
                <button style={btnFantome} onClick={() => setLundi(decalerJours(lundi, 7))}>semaine suivante →</button>
                {lundi !== lundiDe() && (
                  <button style={btnFantome} onClick={() => setLundi(lundiDe())}>cette semaine</button>
                )}
              </span>
            }
          >
            {routines.length ? (
              <Grille
                routines={routines} parRoutine={parRoutine} lundi={lundi} jour={jour}
                onBasculer={basculer} onQuantite={quantite} occupe={occupe}
              />
            ) : (
              <Vide>
                Aucune routine. Ajoute ce que tu veux tenir dans la durée : un drill, une review,
                quinze minutes de rien.
              </Vide>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
              <input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                placeholder="ex : Drill ICM" style={{ ...champ, flex: 1, minWidth: 180, fontSize: 12, padding: "7px 9px" }} />
              <input value={form.unite} onChange={(e) => setForm((f) => ({ ...f, unite: e.target.value }))}
                placeholder="unité (ex : spots)" style={{ ...champ, width: 150, fontSize: 12, padding: "7px 9px" }} />
              {JOURS.map((nom, i) => {
                const n = i + 1;
                const actif = form.jours.includes(n);
                return (
                  <button key={nom} onClick={() => setForm((f) => ({
                    ...f, jours: actif ? f.jours.filter((x) => x !== n) : [...f.jours, n],
                  }))} style={{
                    padding: "5px 8px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                    border: `1px solid ${actif ? "var(--accent)" : "var(--border)"}`,
                    background: actif ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--panel-2)",
                    color: actif ? "var(--accent)" : "var(--text-muted)",
                  }}>{nom.slice(0, 3)}</button>
                );
              })}
              <button style={btn} onClick={ajouter} disabled={occupe === "ajout" || !form.titre.trim()}>Ajouter</button>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.6 }}>
              Sans jour coché, la routine est quotidienne. Avec des jours, la série ne compte que
              ceux-là — un mardi vide ne casse pas une routine du lundi et du jeudi.
            </div>
          </Carte>

          {/* Les cumuls : c'est ce qui transforme une case cochée en volume de travail. */}
          {routines.length > 0 && (
            <Carte titre="Ce que ça fait au total" aide="calculé à partir des quantités saisies">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                      <th style={{ padding: "6px 8px", fontWeight: 500 }}>Routine</th>
                      {PERIODES.map((p) => (
                        <th key={p.id} style={{ padding: "6px 8px", fontWeight: 500 }}>{p.label}</th>
                      ))}
                      <th style={{ padding: "6px 8px", fontWeight: 500 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {routines.map((r) => {
                      const b = bilans(parRoutine[r.id] || [], jour);
                      return (
                        <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "7px 8px", fontWeight: 600 }}>{r.titre}</td>
                          {PERIODES.map((p) => {
                            const v = b[p.id];
                            return (
                              <td key={p.id} style={{ padding: "7px 8px", fontFamily: MONO }}>
                                {r.unite && v.total > 0 ? `${v.total} ${r.unite} · ` : ""}
                                <span style={{ color: "var(--text-muted)" }}>{v.jours} j</span>
                              </td>
                            );
                          })}
                          <td style={{ padding: "7px 8px", textAlign: "right" }}>
                            <button onClick={() => retirer(r)} disabled={occupe === r.id}
                              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>
                              arrêter
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.6 }}>
                Un jour fait sans quantité compte dans les jours, pas dans le total — supposer « 1 »
                reviendrait à inventer un chiffre.
              </div>
            </Carte>
          )}
        </div>
      )}
    </div>
  );
}
