"use client";

import { useState } from "react";
import Link from "next/link";
import { recordSkillAttempt } from "@/lib/supabase/skillAttempts";
import { SITUATIONS, toutesLesQuestions } from "@/lib/poker/cotesPreflop";

// « Quelle équité te faut-il ? » — à une profondeur donnée, le seuil à partir duquel payer un
// tapis préflop devient rentable. Les treize repères du classeur de Boris.
//
// Le barème est serré — 1 et 3 points — parce que la bande utile ne fait que quatorze points de
// large, de 33,5 % à 47,5 %. Deux points d'erreur sur une cote préflop, ce n'est pas une nuance :
// c'est la différence entre payer et se coucher avec la même main.
const TOL_EXACT = 1;
const TOL_PROCHE = 3;

const MONO = "var(--font-ibm-plex-mono), monospace";
const btn = {
  padding: "9px 18px", background: "var(--accent-gradient)", color: "var(--sur-accent)",
  border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
};
const chip = (actif) => ({
  padding: "6px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
  border: `1px solid ${actif ? "var(--accent)" : "var(--border)"}`,
  background: actif ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--panel-2)",
  color: actif ? "var(--accent)" : "var(--text-muted)",
  fontWeight: actif ? 700 : 400,
});

const listeDe = (id) =>
  (id === "*" ? toutesLesQuestions() : toutesLesQuestions().filter((q) => q.situation.id === id));

function tirage(liste, precedente) {
  // Treize questions seulement : sans cette précaution, la même tombe deux fois de suite assez
  // souvent pour que l'exercice paraisse cassé.
  const possibles = liste.length > 1 && precedente
    ? liste.filter((q) => !(q.situation.id === precedente.situation.id && q.bb === precedente.bb))
    : liste;
  return possibles[Math.floor(Math.random() * possibles.length)];
}

export default function EquiteNecessairePage() {
  const [situationId, setSituationId] = useState("*");
  const [q, setQ] = useState(() => tirage(toutesLesQuestions(), null));
  const [reponse, setReponse] = useState("");
  const [resultat, setResultat] = useState(null);
  const [stats, setStats] = useState({ total: 0, exact: 0, somme: 0 });

  const poser = (id = situationId) => {
    setQ(tirage(listeDe(id), q));
    setReponse("");
    setResultat(null);
  };
  const choisir = (id) => { setSituationId(id); setQ(tirage(listeDe(id), null)); setReponse(""); setResultat(null); };

  const valider = () => {
    if (!q || resultat) return;
    const donnee = parseFloat(reponse.replace(",", "."));
    if (Number.isNaN(donnee)) return;
    const ecart = Math.abs(donnee - q.equite);
    const note = ecart <= TOL_EXACT ? "exact" : ecart <= TOL_PROCHE ? "proche" : "loin";

    setResultat({ donnee, ecart, note });
    setStats((s) => ({
      total: s.total + 1,
      exact: s.exact + (note === "exact" ? 1 : 0),
      somme: s.somme + ecart,
    }));
    recordSkillAttempt({
      exercise: "equite-necessaire",
      outcome: { error: ecart },
      meta: { situation: q.situation.id, bb: q.bb, donnee, vraie: q.equite },
    }).catch(() => {});
  };

  const couleur = resultat
    ? resultat.note === "exact" ? "var(--accent)" : resultat.note === "proche" ? "var(--attention)" : "var(--erreur)"
    : "var(--text)";

  return (
    <div style={{ minHeight: "100vh", padding: 20, width: "100%", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <span className="titre" style={{ fontSize: 21, fontWeight: 700 }}>Quelle équité te faut-il ?</span>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontFamily: MONO, color: "var(--text-muted)" }}>
            {stats.total
              ? `${stats.exact}/${stats.total} au point · ${(stats.somme / stats.total).toFixed(1)} pt d'écart moyen`
              : "—"}
          </span>
          <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>Accueil</Link>
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={() => choisir("*")} style={chip(situationId === "*")}>Toutes</button>
          {SITUATIONS.map((s) => (
            <button key={s.id} onClick={() => choisir(s.id)} style={chip(situationId === s.id)}>{s.label}</button>
          ))}
        </div>

        {q && (
          <>
            <div style={{ background: "var(--panel-2)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>{q.situation.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{q.situation.contexte}</div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Profondeur</span>
              <span style={{ fontSize: 26, fontWeight: 800, fontFamily: MONO }}>{q.bb}</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>bb effectifs</span>
            </div>

            <div style={{ fontSize: 13, marginBottom: 10 }}>
              À partir de quelle équité le call devient-il rentable ?
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <input
                type="text" inputMode="decimal" placeholder="ex : 43" value={reponse}
                onChange={(e) => setReponse(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { if (resultat) poser(); else valider(); } }}
                disabled={!!resultat}
                autoFocus
                aria-label="Équité nécessaire en pourcentage"
                style={{
                  width: 110, background: "var(--panel-2)", border: "1px solid var(--border)", color: "var(--text)",
                  borderRadius: 8, padding: "9px 10px", fontSize: 15, textAlign: "center",
                  fontFamily: MONO, opacity: resultat ? 0.6 : 1,
                }}
              />
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
              {!resultat
                ? <button onClick={valider} style={btn} disabled={!reponse.trim()}>Valider</button>
                : <button onClick={() => poser()} style={btn}>Question suivante →</button>}
            </div>

            {resultat && (
              <div style={{
                borderRadius: 11, padding: 14, fontSize: 12.5, lineHeight: 1.7,
                background: `color-mix(in srgb, ${couleur} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${couleur} 35%, transparent)`,
              }}>
                <div style={{ fontWeight: 700, color: couleur, marginBottom: 8, fontSize: 14 }}>
                  {resultat.note === "exact" ? "Au point" : resultat.note === "proche" ? "Pas loin" : "À revoir"}
                  <span style={{ fontFamily: MONO, fontWeight: 400, color: "var(--text-muted)", marginLeft: 10 }}>
                    {resultat.ecart.toFixed(1)} point{resultat.ecart >= 2 ? "s" : ""} d&apos;écart
                  </span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  À <strong style={{ fontFamily: MONO }}>{q.bb} bb</strong>, il te faut{" "}
                  <strong style={{ fontFamily: MONO, color: couleur }}>{q.equite} %</strong> — tu as
                  répondu {resultat.donnee} %.
                </div>

                {/* La colonne entière après la réponse : un seuil isolé se retient mal, la
                    progression se retient toute seule. */}
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 5 }}>
                  {q.situation.label} — la table complète (bande utile {q.situation.bande}) :
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {q.situation.seuils.map((s) => (
                    <span key={s.bb} style={{
                      fontFamily: MONO, fontSize: 12, padding: "4px 9px", borderRadius: 7,
                      background: s.bb === q.bb ? `color-mix(in srgb, ${couleur} 22%, transparent)` : "var(--panel-2)",
                      fontWeight: s.bb === q.bb ? 700 : 400,
                    }}>
                      {s.bb} bb → {s.equite} %
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.7 }}>
        Treize repères, tirés du classeur de Boris. Les tailles retenues y sont intégrées : open à
        2bb, 3-bet à 6bb. À d&apos;autres tailles, les seuils bougent.
      </div>
    </div>
  );
}
