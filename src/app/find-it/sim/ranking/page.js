"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { MINIMUM_MAINS, getMesStatsSim, getSimRanking } from "@/lib/supabase/findItSim";

// Classement du Find It sur simulation.
//
// Le tableau est trié sur les POINTS — la somme des scores — parce que c'est le chiffre d'un jeu :
// il monte en jouant. La moyenne est affichée à côté, parce que c'est le chiffre qui dit si on
// joue bien. Trier sur la moyenne seule récompenserait celui qui s'arrête après trois bonnes
// mains ; trier sur les points seuls récompenserait celui qui clique sans réfléchir. Les deux
// colonnes côte à côte ne laissent ni l'un ni l'autre passer pour un bon joueur.

const MONO = "var(--font-ibm-plex-mono), monospace";
const panneau = { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 };

function Chiffre({ valeur, libelle, fort = false }) {
  return (
    <div style={{ textAlign: "center", minWidth: 72 }}>
      <div style={{
        fontSize: fort ? 26 : 20, fontWeight: 800, fontFamily: MONO,
        color: fort ? "var(--accent)" : "var(--text)",
      }}>{valeur}</div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{libelle}</div>
    </div>
  );
}

export default function ClassementSim() {
  const [lignes, setLignes] = useState([]);
  const [moi, setMoi] = useState(null);
  const [etat, setEtat] = useState("chargement");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [classement, mien] = await Promise.all([getSimRanking(), getMesStatsSim()]);
        setLignes(classement);
        setMoi(mien);
        setEtat("ok");
      } catch (e) {
        setErreur(e.message);
        setEtat("erreur");
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", padding: 20, width: "100%", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={24} showWordmark={false} />
          <span className="titre" style={{ fontSize: 21, fontWeight: 700 }}>Find It sur simulation — classement</span>
        </div>
        <Link href="/find-it/sim" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Jouer</Link>
      </div>

      {etat === "chargement" && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chargement…</div>}
      {etat === "erreur" && <div style={{ fontSize: 13, color: "var(--erreur)" }}>{erreur}</div>}

      {etat === "ok" && (
        <>
          {moi && (
            <div style={{ ...panneau, marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Mes chiffres</div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "space-around" }}>
                <Chiffre valeur={moi.points} libelle="points" fort />
                <Chiffre valeur={moi.moyenne} libelle="moyenne /100" />
                <Chiffre valeur={moi.meilleur} libelle="meilleure main" />
                <Chiffre valeur={moi.total_mains} libelle="mains jouées" />
              </div>
              {moi.total_mains < MINIMUM_MAINS && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.7 }}>
                  Encore {MINIMUM_MAINS - moi.total_mains} main
                  {MINIMUM_MAINS - moi.total_mains > 1 ? "s" : ""} avant d&apos;apparaître au classement.
                  Le seuil existe pour qu&apos;une seule main réussie ne passe pas devant tout le monde.
                </div>
              )}
            </div>
          )}

          <div style={panneau}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 10, color: "var(--text-muted)", padding: "0 12px 8px" }}>
              <span style={{ minWidth: 22 }}>#</span>
              <span style={{ flex: 1 }}>Joueur</span>
              <span style={{ minWidth: 54, textAlign: "right" }}>Mains</span>
              <span style={{ minWidth: 54, textAlign: "right" }}>Moyenne</span>
              <span style={{ minWidth: 54, textAlign: "right" }}>Points</span>
            </div>

            {lignes.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "0 12px", lineHeight: 1.7 }}>
                Personne n&apos;a encore atteint {MINIMUM_MAINS} mains. Le classement s&apos;ouvre au premier.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {lignes.map((l, i) => (
                  <div key={l.user_id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: "var(--panel-2)", borderRadius: 8, padding: "9px 12px",
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, minWidth: 22,
                      color: i === 0 ? "var(--accent)" : "var(--text-muted)",
                    }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{l.pseudo}</span>
                    <span style={{ minWidth: 54, textAlign: "right", fontSize: 12, fontFamily: MONO, color: "var(--text-muted)" }}>{l.total_mains}</span>
                    <span style={{ minWidth: 54, textAlign: "right", fontSize: 12, fontFamily: MONO }}>{l.moyenne}</span>
                    <span style={{ minWidth: 54, textAlign: "right", fontSize: 13, fontFamily: MONO, fontWeight: 700, color: "var(--accent)" }}>{l.points}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.7 }}>
              Chaque main rapporte sa note sur 100. Les points s&apos;accumulent sans limite : le
              classement récompense autant la régularité que la précision.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
