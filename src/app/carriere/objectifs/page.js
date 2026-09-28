"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Carte, HORIZONS, Pastille, Vide, btn, btnFantome, champ } from "@/components/carriere/Blocs";
import {
  creerObjectif, listerObjectifs, majObjectif, monCompte, supprimerObjectif,
} from "@/lib/supabase/carriere";

// Objectifs. Trois horizons, et c'est tout : la vision (quel joueur je veux devenir), l'année, le
// trimestre. Les objectifs trimestriels sont limités à trois — au-delà ce n'est plus un objectif,
// c'est une liste de courses. Ils n'ont pas à être reliés aux axes techniques : « établir mon set
// de session » est un objectif parfaitement légitime.

const MAX_TRIMESTRE = 3;

export default function ObjectifsPage() {
  const [compte, setCompte] = useState(null);
  const [objectifs, setObjectifs] = useState([]);
  const [etat, setEtat] = useState("chargement");
  const [erreur, setErreur] = useState(null);
  const [brouillons, setBrouillons] = useState({ vision: "", annee: "", trimestre: "" });
  const [occupe, setOccupe] = useState(null);

  const charger = useCallback(async () => {
    const c = await monCompte();
    if (!c) { setEtat("horsligne"); return; }
    setCompte(c);
    setObjectifs(await listerObjectifs(c.id));
    setEtat("pret");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await charger();
      } catch (e) { setErreur(e.message); setEtat("erreur"); }
    })();
  }, [charger]);

  const recharger = async () => setObjectifs(await listerObjectifs(compte.id));

  const agir = async (cle, fn) => {
    setOccupe(cle); setErreur(null);
    try { await fn(); await recharger(); }
    catch (e) { setErreur(e.message); }
    finally { setOccupe(null); }
  };

  const ajouter = (horizon) => {
    const texte = brouillons[horizon].trim();
    if (!texte) return;
    return agir(`ajout-${horizon}`, async () => {
      await creerObjectif(compte.id, { horizon, texte });
      setBrouillons((b) => ({ ...b, [horizon]: "" }));
    });
  };

  const parHorizon = (h) => objectifs.filter((o) => o.horizon === h);
  const actifs = (h) => parHorizon(h).filter((o) => o.statut === "en_cours");

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 820, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="titre" style={{ fontSize: 22, fontWeight: 700 }}>Mes objectifs</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            Une vision, un cap à un an, trois chantiers pour le trimestre.
          </div>
        </div>
        <Link href="/carriere" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Carrière</Link>
      </div>

      {etat === "chargement" && <Vide>Chargement…</Vide>}
      {etat === "horsligne" && (
        <Vide>Connecte-toi pour écrire tes objectifs. <Link href="/login" style={{ color: "var(--accent)" }}>Se connecter</Link></Vide>
      )}
      {erreur && <div style={{ fontSize: 13, color: "var(--erreur)", marginBottom: 14 }}>{erreur}</div>}

      {etat === "pret" && (
        <div style={{ display: "grid", gap: 14 }}>
          {["vision", "annee", "trimestre"].map((h) => {
            const liste = actifs(h);
            const plein = h === "trimestre" && liste.length >= MAX_TRIMESTRE;
            const unique = h !== "trimestre" && liste.length >= 1;
            return (
              <Carte key={h} titre={HORIZONS[h].label} aide={HORIZONS[h].aide}>
                {liste.length ? (
                  <div style={{ display: "grid", gap: 8, marginBottom: plein || unique ? 0 : 12 }}>
                    {liste.map((o) => (
                      <div key={o.id} style={{
                        background: "var(--panel-2)", borderRadius: 10, padding: 12,
                        display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap",
                      }}>
                        <span style={{ fontSize: 13, lineHeight: 1.6, flex: 1, minWidth: 200 }}>{o.texte}</span>
                        <span style={{ display: "flex", gap: 6 }}>
                          <button style={btnFantome} disabled={occupe === o.id}
                            onClick={() => agir(o.id, () => majObjectif(o.id, { statut: "atteint" }))}>
                            Atteint
                          </button>
                          <button style={btnFantome} disabled={occupe === o.id}
                            onClick={() => agir(o.id, () => supprimerObjectif(o.id))}>
                            Supprimer
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {!plein && !unique && (
                  <div style={{ display: "flex", gap: 8, marginTop: liste.length ? 12 : 0, flexWrap: "wrap" }}>
                    <input
                      value={brouillons[h]}
                      onChange={(e) => setBrouillons((b) => ({ ...b, [h]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && ajouter(h)}
                      placeholder={
                        h === "vision" ? "ex : un joueur qui ne subit jamais ses spots"
                          : h === "annee" ? "ex : jouer les 100 € d'ABI sereinement"
                            : "ex : établir mon set de session"
                      }
                      style={{ ...champ, flex: 1, minWidth: 220 }}
                    />
                    <button style={btn} onClick={() => ajouter(h)} disabled={occupe === `ajout-${h}`}>Ajouter</button>
                  </div>
                )}
                {plein && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
                    Trois objectifs trimestriels, c&apos;est le maximum. Marque-en un comme atteint pour en ouvrir un autre.
                  </div>
                )}
              </Carte>
            );
          })}

          {objectifs.some((o) => o.statut !== "en_cours") && (
            <Carte titre="Déjà atteints" aide="ce que tu as coché au fil des trimestres">
              <div style={{ display: "grid", gap: 6 }}>
                {objectifs.filter((o) => o.statut !== "en_cours").map((o) => (
                  <div key={o.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>{o.texte}</span>
                    <Pastille couleur={o.statut === "atteint" ? "var(--accent)" : "var(--text-muted)"}>
                      {o.statut === "atteint" ? "atteint" : "abandonné"}
                    </Pastille>
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
