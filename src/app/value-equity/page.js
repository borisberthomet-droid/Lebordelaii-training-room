"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SimsEnPreparation from "@/components/SimsEnPreparation";
import MiniCard from "@/components/MiniCard";
import SolvedReplayer from "@/components/SolvedReplayer";
import { potOddsRow } from "@/lib/poker/memoTables";
import { PotOddsIcon } from "@/components/ToolIcons";
import { recordSkillAttempt } from "@/lib/supabase/skillAttempts";

// « Quelle est ton équité ? » — sur un nœud où tu peux miser, estime ton équité contre la range
// GLOBALE de l'adversaire, puis déduis-en jusqu'à quel sizing tu peux miser en value.
//
// Cadre théorique retenu par Boris : le défenseur paie exactement sa MDF avec le haut de sa
// range, et il faut battre plus de 50% de cette calling range pour value bet. Ça revient à une
// équité contre la range globale ≥ 1 − MDF/2 — la colonne « équité min. value bet » de la fiche
// Pot Odds, qu'on réutilise ici pour n'avoir qu'une seule définition de la formule. En jeu, on
// s'adapte ensuite à ce qu'on sait du joueur.

const LADDER = [25, 33, 50, 66, 75, 100, 150, 200];
const TOL_EXACT = 5;
const TOL_CLOSE = 10;

// Inversion de E ≥ 1 − MDF/2 avec MDF = 1/(1 + b) : b_max = 1 / (2(1 − E)) − 1, en fraction du
// pot. Sous 50% d'équité il n'existe aucun sizing de value.
function maxValueSizing(equity) {
  if (equity <= 0.5) return null;
  return 1 / (2 * (1 - equity)) - 1;
}

const btn = {
  padding: "9px 18px", background: "var(--accent-gradient)", color: "#0B1210",
  border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
};
const ghost = {
  padding: "7px 14px", background: "var(--panel-2)", color: "var(--text)",
  border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, cursor: "pointer",
};

function chip(active) {
  return {
    padding: "6px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: active ? "rgba(52,211,153,0.14)" : "var(--panel-2)",
    color: active ? "var(--accent)" : "var(--text-muted)",
    fontWeight: active ? 600 : 400,
  };
}

function Row({ label, value, strong, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{
        fontFamily: "var(--font-ibm-plex-mono), monospace",
        color: color || (strong ? "var(--accent)" : "var(--text)"), fontWeight: strong ? 700 : 400,
      }}>{value}</span>
    </div>
  );
}

// Tirage pondéré par la fréquence d'arrivée du combo au nœud.
function drawCombo(combos) {
  const total = combos.reduce((a, c) => a + c[1], 0);
  let r = Math.random() * total;
  for (const c of combos) { r -= c[1]; if (r <= 0) return c; }
  return combos[combos.length - 1];
}

function actionLabel(a) {
  if (a.type === "X") return "check";
  if (a.type === "R") return `bet ${a.pctPot}% (${a.amountBB} bb)`;
  if (a.type === "F") return "fold";
  return a.type;
}

export default function ValueEquityPage() {
  const [sims, setSims] = useState(null);
  const [sim, setSim] = useState(null);
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);
  // Catalogue vide : sims retirées le temps d'en préparer de nouvelles, ce n'est pas une panne.
  const [empty, setEmpty] = useState(false);
  const [streets, setStreets] = useState(["turn", "river"]);
  const [situations, setSituations] = useState(["Après son check", "Premier de parole"]);
  const [q, setQ] = useState(null);         // { spot, combo }
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({ exact: 0, close: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/solved/sims.json")
      .then((r) => { if (!r.ok) throw new Error(`catalogue introuvable (${r.status})`); return r.json(); })
      .then((list) => {
        const usable = list.filter((s) => s.value > 0);
        if (!usable.length) { setEmpty(true); return; }
        setSims(usable);
        setSim(usable[0].name);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!sim) return;
    setIndex(null); setQ(null); setResult(null); setGuess("");
    fetch(`/solved/${sim}/index.json`)
      .then((r) => { if (!r.ok) throw new Error(`index de ${sim} introuvable (${r.status})`); return r.json(); })
      .then(setIndex)
      .catch((e) => setError(e.message));
  }, [sim]);

  const pool = useMemo(() => {
    if (!index?.valueSpots) return [];
    return index.valueSpots.filter((s) => streets.includes(s.streetName) && situations.includes(s.situation));
  }, [index, streets, situations]);

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const newQuestion = async () => {
    if (!pool.length) return;
    setLoading(true); setResult(null); setGuess("");
    try {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const res = await fetch(`/solved/${sim}/v${pick.id}.json`);
      if (!res.ok) throw new Error(`spot ${pick.id} introuvable`);
      const spot = await res.json();
      setQ({ spot, combo: drawCombo(spot.combos) });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    if (!q || result) return;
    const g = parseFloat(guess.replace(",", "."));
    if (isNaN(g)) return;
    const delta = Math.abs(g - q.combo[2]);
    const grade = delta <= TOL_EXACT ? "exact" : delta <= TOL_CLOSE ? "proche" : "loin";
    setResult({ given: g, delta, grade });
    setStats((s) => ({
      exact: s.exact + (grade === "exact" ? 1 : 0),
      close: s.close + (grade === "proche" ? 1 : 0),
      total: s.total + 1,
    }));
    recordSkillAttempt({
      exercise: "value-equity",
      outcome: { error: delta },
      meta: { sim, spot: q.spot.id, street: q.spot.streetName, situation: q.spot.situation },
    }).catch(() => {});
  };

  if (empty) return <SimsEnPreparation title="Quelle est ton équité ?" />;

  if (error) {
    return (
      <div style={{ padding: 20, width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ fontSize: 14, color: "#E0645A", marginBottom: 8 }}>Impossible de charger les données : {error}</div>
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
      </div>
    );
  }

  const spot = q?.spot;
  const combo = q?.combo;
  const heroCards = combo ? [combo[0].slice(0, 2), combo[0].slice(2, 4)] : null;
  const equity = combo ? combo[2] / 100 : null;
  const bMax = equity != null ? maxValueSizing(equity) : null;
  const allInPct = spot && spot.potBB > 0 ? (spot.effStackBB / spot.potBB) * 100 : null;

  return (
    <div style={{ minHeight: "100vh", padding: 20, width: "100%", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PotOddsIcon size={22} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>Quelle est ton équité ?</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontFamily: "var(--font-ibm-plex-mono), monospace", color: "var(--text-muted)" }}>
            {stats.total ? `${stats.exact}/${stats.total} exact · ${stats.close} proche` : "—"}
          </span>
          <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
          Tu peux miser. Estime ton équité contre la <strong style={{ color: "var(--text)" }}>range globale</strong> de
          l&apos;adversaire : c&apos;est elle qui dit si tu as de la value, et jusqu&apos;à quel sizing.
        </div>

        {sims && sims.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Texture</label>
            <select value={sim || ""} onChange={(e) => setSim(e.target.value)} style={{
              width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
              color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
            }}>
              {sims.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.fullBoard || s.board.join(" ")} — {s.effectiveBB} bb — {s.value} spots
                </option>
              ))}
            </select>
          </div>
        )}

        {!index ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chargement de la simulation…</div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Street</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {["turn", "river"].map((s) => (
                <button key={s} onClick={() => toggle(streets, setStreets, s)} style={chip(streets.includes(s))}>
                  {s}
                  <span style={{ opacity: 0.65, marginLeft: 6, fontSize: 10 }}>
                    {(index.valueSpots || []).filter((x) => x.streetName === s).length}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Situation</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {["Après son check", "Premier de parole"].map((s) => (
                <button key={s} onClick={() => toggle(situations, setSituations, s)} style={chip(situations.includes(s))}>
                  {s}
                  <span style={{ opacity: 0.65, marginLeft: 6, fontSize: 10 }}>
                    {(index.valueSpots || []).filter((x) => x.situation === s).length}
                  </span>
                </button>
              ))}
              <button onClick={() => { setStreets(["turn", "river"]); setSituations(["Après son check", "Premier de parole"]); }} style={ghost}>Tout</button>
            </div>

            <button onClick={newQuestion} style={btn} disabled={!pool.length || loading}>
              {loading ? "…" : "Nouvelle question"}
            </button>
            <span style={{ fontSize: 11, color: pool.length ? "var(--text-muted)" : "#E0645A", marginLeft: 12 }}>
              {pool.length ? `${pool.length} spots correspondent` : "Aucun spot : élargis les filtres."}
            </span>
          </>
        )}
      </div>

      {spot && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{spot.situation}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {spot.streetName} · tu es {spot.heroPos} contre {spot.villainPos}
            </span>
          </div>

          <SolvedReplayer spot={spot} meta={index} heroCards={heroCards} />

          <div style={{ background: "var(--panel-2)", borderRadius: 10, padding: 14, fontSize: 12, marginBottom: 14 }}>
            <Row label="Déroulé" value={spot.line} />
            <Row label="Pot" value={`${spot.potBB} bb`} />
            <Row label="Tapis effectif" value={`${spot.effStackBB} bb`} />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ta main</span>
            {heroCards.map((c) => <MiniCard key={c} card={c} />)}
          </div>

          <div style={{ fontSize: 13, marginBottom: 10 }}>
            Quelle est ton équité contre <strong>la range globale de {spot.villainPos}</strong> ?
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <input
              type="text" inputMode="decimal" placeholder="ex : 62" value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !result && validate()}
              disabled={!!result}
              style={{
                width: 110, background: "var(--panel-2)", border: "1px solid var(--border)", color: "var(--text)",
                borderRadius: 8, padding: "9px 10px", fontSize: 15, textAlign: "center",
                fontFamily: "var(--font-ibm-plex-mono), monospace", opacity: result ? 0.6 : 1,
              }}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
            {!result
              ? <button onClick={validate} style={btn} disabled={!guess.trim()}>Valider</button>
              : <button onClick={newQuestion} style={btn}>Question suivante →</button>}
          </div>

          {result && (
            <div style={{
              borderRadius: 10, padding: 14, fontSize: 12,
              background: result.grade === "exact" ? "rgba(52,211,153,0.12)" : result.grade === "proche" ? "rgba(232,197,71,0.12)" : "rgba(224,100,90,0.12)",
              border: `1px solid ${result.grade === "exact" ? "rgba(52,211,153,0.35)" : result.grade === "proche" ? "rgba(232,197,71,0.35)" : "rgba(224,100,90,0.35)"}`,
            }}>
              <div style={{
                fontWeight: 700, marginBottom: 10,
                color: result.grade === "exact" ? "#34D399" : result.grade === "proche" ? "#E8C547" : "#E0645A",
              }}>
                {result.grade === "exact" ? "Exact" : result.grade === "proche" ? "Proche" : "Loin"}
                {` — ton estimation ${result.given.toFixed(1)}%, équité réelle ${combo[2].toFixed(1)}% (écart ${result.delta.toFixed(1)} pt)`}
              </div>

              <div style={{ color: "var(--text-muted)", lineHeight: 1.9 }}>
                <Row label="Sizing max en value"
                  strong={bMax != null}
                  color={bMax == null ? "#E0645A" : undefined}
                  value={bMax == null
                    ? "aucun — moins de 50% d'équité"
                    : allInPct != null && bMax * 100 >= allInPct
                      ? `jusqu'au tapis (${Math.round(allInPct)}% du pot)`
                      : `jusqu'à ${Math.round(bMax * 100)}% du pot`} />
                <Row label="Percentile dans ta range" value={`${combo[3].toFixed(1)}%`} />

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>
                    Seuil de value par sizing
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                      <thead>
                        <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                          <th style={{ padding: "4px 6px", fontWeight: 500 }}>Sizing</th>
                          <th style={{ padding: "4px 6px", fontWeight: 500 }}>MDF</th>
                          <th style={{ padding: "4px 6px", fontWeight: 500 }}>Équité requise</th>
                          <th style={{ padding: "4px 6px", fontWeight: 500 }}>Toi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {LADDER.map((pct) => {
                          const row = potOddsRow(pct);
                          const beyondStack = allInPct != null && pct > allInPct + 0.5;
                          const ok = equity >= row.valueBetEquity;
                          return (
                            <tr key={pct} style={{ borderTop: "1px solid var(--border)", opacity: beyondStack ? 0.4 : 1 }}>
                              <td style={{ padding: "4px 6px", color: "var(--text)" }}>{pct}%</td>
                              <td style={{ padding: "4px 6px" }}>{(row.mdf * 100).toFixed(1)}%</td>
                              <td style={{ padding: "4px 6px" }}>{(row.valueBetEquity * 100).toFixed(1)}%</td>
                              <td style={{ padding: "4px 6px", color: beyondStack ? "var(--text-muted)" : ok ? "#34D399" : "#E0645A", fontWeight: 600 }}>
                                {beyondStack ? "au-delà du tapis" : ok ? "value" : "trop gros"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
                    Ce que le solveur fait de cette main
                  </div>
                  {spot.actions.map((a, i) => {
                    const f = combo[4][i] || 0;
                    if (f < 0.005) return null;
                    return <Row key={i} label={actionLabel(a)} value={`${(f * 100).toFixed(1)}%`} strong={f > 0.5} />;
                  })}
                  {/* Une mise sous 50% d'équité contre la range globale ne peut pas être de la
                      value, par définition. Sans le dire, l'élève lit « le solveur mise » comme
                      « j'avais de la value » — exactement l'inverse de ce que l'exercice enseigne. */}
                  {(() => {
                    const betFreq = spot.actions.reduce((sum, a, i) => sum + (a.type === "R" ? (combo[4][i] || 0) : 0), 0);
                    if (equity >= 0.5 || betFreq < 0.03) return null;
                    return (
                      <div style={{ fontSize: 11, marginTop: 4, color: "#E8C547" }}>
                        Il mise {(betFreq * 100).toFixed(0)}% du temps avec {combo[2].toFixed(1)}% d&apos;équité :
                        c&apos;est un bluff, pas de la value.
                      </div>
                    );
                  })()}
                </div>

                <div style={{ marginTop: 10, fontSize: 11 }}>
                  Modèle théorique : il paie exactement sa MDF avec le haut de sa range, et tu bats tout
                  ce qu&apos;il couche. En jeu, adapte selon ce que tu sais de lui.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
