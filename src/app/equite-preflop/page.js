"use client";

import { useState } from "react";
import Link from "next/link";
import MiniCard from "@/components/MiniCard";
import { recordSkillAttempt } from "@/lib/supabase/skillAttempts";
import { EQUITES, MAINS, SCENARIOS, equiteDe, rangDe } from "@/lib/poker/equitesPreflop";

// « Ton équité préflop » — une main, un scénario de tapis, estime ton équité contre la range
// adverse. Les chiffres sont ceux du classeur de Boris, pas un recalcul maison : l'élève est
// corrigé sur la référence que son coach enseigne.
//
// Deux tolérances, et elles sont serrées exprès. L'écart type de ces équités est bien plus faible
// qu'en postflop — presque tout tient entre 25 % et 60 % — donc trois points d'erreur ici valent
// ce que dix points vaudraient sur un spot de river. Un barème large laisserait croire qu'on sait
// estimer alors qu'on aurait seulement deviné l'ordre de grandeur.
const TOL_EXACT = 2;
const TOL_PROCHE = 5;

// Couleurs données aux deux cartes. Une main servie n'a pas de couleur dans le classeur : on en
// choisit une lisible, la même à chaque fois, pour que l'élève reconnaisse « AKs » du premier
// coup d'œil au lieu de relire les symboles.
function cartesDe(main) {
  const [a, b] = [main[0], main[1]];
  if (a === b) return [`${a}s`, `${b}h`];           // paire : deux couleurs différentes
  return main.endsWith("s") ? [`${a}s`, `${b}s`] : [`${a}s`, `${b}h`];
}

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
const MONO = "var(--font-ibm-plex-mono), monospace";

const listeDe = (id) => (id === "*" ? SCENARIOS : SCENARIOS.filter((s) => s.id === id));

function tirage(liste) {
  const scenario = liste[Math.floor(Math.random() * liste.length)];
  const main = MAINS[Math.floor(Math.random() * MAINS.length)];
  return { main, scenario, cartes: cartesDe(main) };
}

export default function EquitePreflopPage() {
  // Le choix par défaut mélange les six scénarios : s'entraîner sur un seul revient à apprendre
  // une colonne par cœur, et c'est justement ce que l'exercice doit remplacer.
  const [scenarioId, setScenarioId] = useState("*");
  // Première question tirée à l'initialisation, pas dans un effet : un effet qui pose l'état au
  // montage fait un rendu dans le vide, et le compilateur React de ce projet le refuse.
  const [q, setQ] = useState(() => tirage(SCENARIOS));
  const [reponse, setReponse] = useState("");
  const [resultat, setResultat] = useState(null);
  const [stats, setStats] = useState({ total: 0, exact: 0, proche: 0, somme: 0 });

  const poser = (id = scenarioId) => {
    setQ(tirage(listeDe(id)));
    setReponse("");
    setResultat(null);
  };

  // Changer de scénario tire aussitôt une main dedans : rester sur la question précédente, qui
  // vient d'un autre scénario, ferait répondre à côté sans que rien ne le signale.
  const choisir = (id) => { setScenarioId(id); poser(id); };

  const valider = () => {
    if (!q || resultat) return;
    const donnee = parseFloat(reponse.replace(",", "."));
    if (Number.isNaN(donnee)) return;
    const vraie = equiteDe(q.main, q.scenario);
    const ecart = Math.abs(donnee - vraie);
    const note = ecart <= TOL_EXACT ? "exact" : ecart <= TOL_PROCHE ? "proche" : "loin";

    setResultat({ donnee, vraie, ecart, note, rang: rangDe(q.main, q.scenario) });
    setStats((s) => ({
      total: s.total + 1,
      exact: s.exact + (note === "exact" ? 1 : 0),
      proche: s.proche + (note === "proche" ? 1 : 0),
      somme: s.somme + ecart,
    }));
    recordSkillAttempt({
      exercise: "equite-preflop",
      outcome: { error: ecart },
      meta: { main: q.main, scenario: q.scenario.id, donnee, vraie },
    }).catch(() => {});
  };

  const couleur = resultat
    ? resultat.note === "exact" ? "var(--accent)" : resultat.note === "proche" ? "var(--attention)" : "var(--erreur)"
    : "var(--text)";

  return (
    <div style={{ minHeight: "100vh", padding: 20, width: "100%", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <span className="titre" style={{ fontSize: 21, fontWeight: 700 }}>Ton équité préflop</span>
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
          <button onClick={() => choisir("*")} style={chip(scenarioId === "*")}>Tous</button>
          {SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => choisir(s.id)} style={chip(scenarioId === s.id)}>{s.label}</button>
          ))}
        </div>

        {q && (
          <>
            <div style={{
              background: "var(--panel-2)", borderRadius: 12, padding: 14, marginBottom: 16,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{q.scenario.label}</span>
                {/* La taille de sa range est l'information qui rend la question jouable : la même
                    main ne vaut pas la même chose contre 54 % et contre 3,8 %. */}
                <span style={{ fontSize: 12, fontFamily: MONO, color: "var(--accent)" }}>
                  sa range : {q.scenario.range}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 4 }}>{q.scenario.detail}</div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ta main</span>
              {q.cartes.map((c) => <MiniCard key={c} card={c} />)}
              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO }}>{q.main}</span>
            </div>

            <div style={{ fontSize: 13, marginBottom: 10 }}>
              Quelle est ton équité quand il paie (ou quand tu paies) ?
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <input
                type="text" inputMode="decimal" placeholder="ex : 46" value={reponse}
                onChange={(e) => setReponse(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { if (resultat) poser(); else valider(); } }}
                disabled={!!resultat}
                autoFocus
                aria-label="Ton estimation d'équité en pourcentage"
                style={{
                  width: 110, background: "var(--panel-2)", border: "1px solid var(--border)", color: "var(--text)",
                  borderRadius: 8, padding: "9px 10px", fontSize: 15, textAlign: "center",
                  fontFamily: MONO, opacity: resultat ? 0.6 : 1,
                }}
              />
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
              {!resultat
                ? <button onClick={valider} style={btn} disabled={!reponse.trim()}>Valider</button>
                : <button onClick={() => poser()} style={btn}>Main suivante →</button>}
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
                <div>
                  <strong style={{ fontFamily: MONO }}>{q.main}</strong> fait{" "}
                  <strong style={{ fontFamily: MONO, color: couleur }}>{resultat.vraie.toFixed(1)} %</strong>{" "}
                  dans ce spot — tu as répondu {resultat.donnee} %.
                </div>
                {/* Le rang situe la main là où le pourcentage seul ne dit rien : 46 %, est-ce
                    beaucoup ? La réponse dépend entièrement du scénario. */}
                <div style={{ color: "var(--text-muted)", marginTop: 6 }}>
                  C&apos;est la <strong style={{ color: "var(--text)" }}>{resultat.rang}<sup>e</sup></strong> main
                  sur {MAINS.length} dans ce scénario.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.7 }}>
        Les {Object.keys(EQUITES).length} mains et leurs {SCENARIOS.length} scénarios viennent du classeur
        d&apos;équités de Boris. Rien n&apos;est recalculé ici : tu es corrigé sur les chiffres qu&apos;il enseigne.
      </div>
    </div>
  );
}
