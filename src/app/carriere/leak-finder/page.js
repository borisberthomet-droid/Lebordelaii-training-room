"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Onglets from "@/components/carriere/Onglets";
import {
  Carte, MONO, Pastille, StatFocus, Vide, btnFantome, dansLaCible, libelleTarget,
} from "@/components/carriere/Blocs";
import { lienCapture, listerCaptures, listerStats, monCompte } from "@/lib/supabase/carriere";

// Leak Finder, côté joueur : ce qu'il travaille en ce moment, ce qu'il a déjà acquis, et les
// captures de statistiques qui servent de référence. Le coach saisit, le joueur lit — c'est lui
// qui décide de ce qui est prioritaire.

function dateCourte(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function LeakFinderPage() {
  const [stats, setStats] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [liens, setLiens] = useState({});
  const [ouvertes, setOuvertes] = useState({});
  const [etat, setEtat] = useState("chargement");
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await monCompte();
        if (!c) { setEtat("horsligne"); return; }
        const [s, caps] = await Promise.all([listerStats(c.id), listerCaptures(c.id)]);
        setStats(s);
        setCaptures(caps);
        // Les captures vivent dans un bucket privé : on demande un lien signé par image.
        const paires = await Promise.all(caps.map(async (x) => [x.id, await lienCapture(x.chemin)]));
        setLiens(Object.fromEntries(paires));
        setEtat("pret");
      } catch (e) { setErreur(e.message); setEtat("erreur"); }
    })();
  }, []);

  const focus = stats.filter((s) => s.statut === "focus");
  const acquises = stats.filter((s) => s.statut === "acquise");

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 900, margin: "0 auto" }}>
      <Onglets />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="titre" style={{ fontSize: 22, fontWeight: 700 }}>Leak Finder</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            Trois statistiques à la fois, pas plus. Le reste attend son tour.
          </div>
        </div>
        <Link href="/carriere" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Carrière</Link>
      </div>

      {etat === "chargement" && <Vide>Chargement…</Vide>}
      {etat === "horsligne" && (
        <Vide>Connecte-toi pour voir tes statistiques. <Link href="/login" style={{ color: "var(--accent)" }}>Se connecter</Link></Vide>
      )}
      {erreur && <div style={{ fontSize: 13, color: "var(--erreur)", marginBottom: 14 }}>{erreur}</div>}

      {etat === "pret" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Carte titre="En focus" aide="les statistiques que tu travailles en ce moment">
            {focus.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {focus.map((s) => (
                  <div key={s.id}>
                    <StatFocus stat={s} />
                    {s.notes.length > 1 && (
                      <div style={{ marginTop: 6 }}>
                        <button style={btnFantome} onClick={() => setOuvertes((o) => ({ ...o, [s.id]: !o[s.id] }))}>
                          {ouvertes[s.id] ? "Masquer" : `Voir les ${s.notes.length - 1} notes précédentes`}
                        </button>
                        {ouvertes[s.id] && (
                          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                            {s.notes.slice(1).map((n) => (
                              <div key={n.id} style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                                <span style={{ fontFamily: MONO }}>{dateCourte(n.created_at)}</span> — {n.note}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Vide>Aucune statistique en focus. Ton coach en fixe jusqu&apos;à trois après un Leak Finder.</Vide>
            )}
          </Carte>

          {acquises.length > 0 && (
            <Carte titre="Acquis" aide="atteint et validé avec ton coach">
              <div style={{ display: "grid", gap: 8 }}>
                {acquises.map((s) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
                    <span>{s.nom}</span>
                    <span style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: MONO, color: "var(--text-muted)" }}>
                      {s.valeur_depart != null && <span>{s.valeur_depart} →</span>}
                      <span style={{ color: "var(--accent)", fontWeight: 700 }}>{s.valeur_atteinte}</span>
                      <span>cible {libelleTarget(s)}</span>
                      <Pastille couleur="var(--accent)">validé le {dateCourte(s.valide_le)}</Pastille>
                    </span>
                  </div>
                ))}
              </div>
            </Carte>
          )}

          <Carte titre="Mes captures" aide="les rapports que ton coach a déposés">
            {captures.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {captures.map((c) => (
                  <a key={c.id} href={liens[c.id] || "#"} target="_blank" rel="noreferrer"
                    style={{ display: "block", background: "var(--panel-2)", borderRadius: 10, padding: 8 }}>
                    {liens[c.id]
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={liens[c.id]} alt={c.titre || "capture"} style={{ width: "100%", borderRadius: 6, display: "block" }} />
                      : <div style={{ fontSize: 11, color: "var(--text-muted)" }}>lien indisponible</div>}
                    <div style={{ fontSize: 11, marginTop: 6 }}>{c.titre || "capture"}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: MONO }}>{dateCourte(c.created_at)}</div>
                  </a>
                ))}
              </div>
            ) : (
              <Vide>Aucune capture pour l&apos;instant.</Vide>
            )}
          </Carte>

          {focus.some((s) => dansLaCible(s)) && (
            <div style={{ fontSize: 12, color: "var(--accent)" }}>
              Une de tes statistiques est dans la cible : parles-en à ton coach, il pourra la valider et en ouvrir une autre.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
