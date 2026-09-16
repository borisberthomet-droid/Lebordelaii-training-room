"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SolvedReplayer from "@/components/SolvedReplayer";
import PivotDial from "@/components/PivotDial";
import { RangeDecompIcon } from "@/components/ToolIcons";
import {
  CATEGORIES, availableCategories, boardIsPaired, categorize, categoryLabel, decompose, decompositionError,
} from "@/lib/poker/handCategory";
import { attemptScore, skillFor } from "@/lib/poker/skillScore";
import { recordSkillAttempt } from "@/lib/supabase/skillAttempts";

// Décompose la range du DÉFENSEUR : l'élève mise, et estime la part de chaque catégorie de main
// (DP+, overpair, TP…) dans la range qui fait face à sa mise. C'est l'usage de Boris : savoir ce
// que la range adverse contient pour juger si un bluff passe. La correction donne donc aussi le
// fold réel du solveur, par catégorie, face au seuil de rentabilité du bluff.
//
// Aucun rebuild : les spots de « Où suis-je dans ma range » portent déjà la range pondérée du
// joueur qui fait face à la mise, avec sa stratégie combo par combo.

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

function Row({ label, value, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{
        fontFamily: "var(--font-ibm-plex-mono), monospace", textAlign: "right",
        color: strong ? "var(--accent)" : "var(--text)", fontWeight: strong ? 700 : 400,
      }}>{value}</span>
    </div>
  );
}

// Barre empilée d'une décomposition. Les segments sous 0.5% ne se voient pas et encombreraient
// le rendu : on les laisse de côté, la somme reste lisible dans le tableau.
function StackedBar({ pct, label }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", background: "var(--panel-2)" }}>
        {CATEGORIES.map((c) => (pct[c.id] || 0) >= 0.5 && (
          <div key={c.id} title={`${c.label} ${pct[c.id].toFixed(0)}%`}
            style={{ width: `${pct[c.id]}%`, background: c.color }} />
        ))}
      </div>
    </div>
  );
}

const MONO = "var(--font-ibm-plex-mono), monospace";

// Fold du défenseur, par catégorie et au total, lu dans la stratégie du solveur : chaque combo
// porte sa fréquence de fold (`played`, aligné sur `spot.actions`). Une relance compte comme une
// continuation — face à elle, un bluff perd sa mise exactement comme face à un call.
// Vérifié sur les 1012 spots : le total retrouve le `defendPct` calculé par le build à 0.15 point.
function foldsByCategory(spot) {
  const iFold = spot.actions.findIndex((a) => a.type === "F");
  if (iFold < 0) return null;
  const byCat = {};
  let fold = 0, total = 0;
  for (const c of spot.combos) {
    const cat = categorize([c[0].slice(0, 2), c[0].slice(2, 4)], spot.board);
    const f = c[1] * (c[4]?.[iFold] || 0);
    byCat[cat] ??= { fold: 0, total: 0 };
    byCat[cat].fold += f;
    byCat[cat].total += c[1];
    fold += f;
    total += c[1];
  }
  return {
    byCat,
    foldPct: total > 0 ? (fold / total) * 100 : 0,
    // Seuil d'un bluff pur : mise / (pot avant la mise + mise). `potBB` inclut déjà la mise.
    breakEvenPct: (spot.toCallBB / spot.potBB) * 100,
  };
}

export default function RangeDecompositionPage() {
  const [sims, setSims] = useState(null);
  const [sim, setSim] = useState(null);
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);
  const [streets, setStreets] = useState(["turn", "river"]);
  const [q, setQ] = useState(null);             // { spot, truth, folds }
  const [guess, setGuess] = useState({});
  const [reveal, setReveal] = useState(null);   // { error, note }
  const [stats, setStats] = useState({ n: 0, sumError: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/solved/sims.json")
      .then((r) => { if (!r.ok) throw new Error(`catalogue introuvable (${r.status})`); return r.json(); })
      .then((list) => {
        if (!list.length) throw new Error("aucune simulation construite");
        setSims(list);
        setSim(list[0].name);
      })
      .catch((e) => setError(e.message));
  }, []);

  // La remise à zéro se fait dans le gestionnaire du menu, pas ici : l'effet ne fait que charger.
  // `ignore` écarte la réponse d'une texture quittée entre-temps.
  useEffect(() => {
    if (!sim) return;
    let ignore = false;
    fetch(`/solved/${sim}/index.json`)
      .then((r) => { if (!r.ok) throw new Error(`index de ${sim} introuvable (${r.status})`); return r.json(); })
      .then((idx) => { if (!ignore) setIndex(idx); })
      .catch((e) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [sim]);

  const changeSim = (name) => {
    setSim(name); setIndex(null); setQ(null); setReveal(null);
  };

  const pool = useMemo(
    () => (index?.spots || []).filter((s) => streets.includes(s.streetName)),
    [index, streets]
  );

  const newQuestion = async () => {
    if (!pool.length) return;
    setLoading(true); setReveal(null);
    try {
      const meta = pool[Math.floor(Math.random() * pool.length)];
      const res = await fetch(`/solved/${sim}/${meta.id}.json`);
      if (!res.ok) throw new Error(`spot ${meta.id} introuvable`);
      const spot = await res.json();
      // Paires [clé, poids] gardées dans l'état : la molette trie la range une fois par spot, et
      // un tableau recréé à chaque rendu relancerait ce tri à chaque cran.
      const pairs = spot.combos.map((c) => [c[0], c[1]]);
      const truth = decompose(pairs, spot.board);
      setQ({ spot, pairs, truth, folds: foldsByCategory(spot) });
      setGuess(Object.fromEntries(availableCategories(spot.board).map((c) => [c.id, ""])));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const available = q ? availableCategories(q.spot.board) : [];
  const numbers = Object.fromEntries(available.map((c) => [c.id, Number(guess[c.id]) || 0]));
  const total = available.reduce((a, c) => a + numbers[c.id], 0);
  const complete = Math.abs(total - 100) < 0.05;

  const submit = () => {
    if (!q || reveal || !complete) return;
    const err = decompositionError(numbers, q.truth.pct);
    const scored = attemptScore("range-decomposition", null, { error: err });
    setReveal({ error: err, note: Math.round((scored?.score || 0) * 100) });
    setStats((s) => ({ n: s.n + 1, sumError: s.sumError + err }));
    recordSkillAttempt({
      exercise: "range-decomposition",
      outcome: { error: err },
      meta: { sim, spot: q.spot.id, street: q.spot.streetName },
    }).catch(() => {});
  };

  if (error) {
    return (
      <div style={{ padding: 20, width: "100%", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ fontSize: 14, color: "#E0645A", marginBottom: 8 }}>Impossible de charger la simulation : {error}</div>
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
      </div>
    );
  }

  const spot = q?.spot;
  const refError = skillFor("range-decomposition").refError;
  const paired = spot ? boardIsPaired(spot.board) : false;

  return (
    <div style={{ minHeight: "100vh", padding: 20, width: "100%", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RangeDecompIcon size={22} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>Décompose la range</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontFamily: MONO, color: "var(--text-muted)" }}>
            {stats.n ? `${stats.n} ranges · ${(stats.sumError / stats.n).toFixed(1)} pts d'erreur moyenne` : "—"}
          </span>
          <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
        {/* Objectif formulé par Boris, mot pour mot sur le fond : la décomposition n'est pas une fin,
            elle sert à situer la main charnière du défenseur. */}
        <div style={{
          background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)",
          borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12, lineHeight: 1.6,
        }}>
          <strong style={{ color: "var(--accent)" }}>Objectif</strong> — trouver la main charnière qui
          permet de savoir si ton adversaire va <strong>overcall</strong> ou <strong>overfold</strong> ce spot.
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
          Tu mises. Décompose la range qui fait face à ta mise, avant sa décision : c&apos;est elle
          qui dit si ton bluff passe. La référence est la range réelle du solveur à ce nœud.
        </div>

        {sims && sims.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Texture</label>
            <select value={sim || ""} onChange={(e) => changeSim(e.target.value)} style={{
              width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
              color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
            }}>
              {sims.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.fullBoard || s.board.join(" ")} — {s.effectiveBB} bb — {s.spots} spots
                </option>
              ))}
            </select>
          </div>
        )}

        {!index ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chargement de la simulation…</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {["turn", "river"].map((s) => (
                <button key={s}
                  onClick={() => setStreets((l) => l.includes(s) ? l.filter((x) => x !== s) : [...l, s])}
                  style={chip(streets.includes(s))}>
                  {s}
                  <span style={{ opacity: 0.65, marginLeft: 6, fontSize: 10 }}>
                    {index.spots.filter((x) => x.streetName === s).length}
                  </span>
                </button>
              ))}
              <button onClick={() => setStreets(["turn", "river"])} style={ghost}>Tout</button>
            </div>

            <button onClick={newQuestion} style={btn} disabled={!pool.length || loading}>
              {loading ? "…" : "Nouvelle range"}
            </button>
            <span style={{ fontSize: 11, color: pool.length ? "var(--text-muted)" : "#E0645A", marginLeft: 12 }}>
              {pool.length ? `${pool.length} spots disponibles` : "Aucun spot : élargis les filtres."}
            </span>
          </>
        )}
      </div>

      {spot && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{spot.archetype}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {spot.streetName} · tu es {spot.villainPos}, {spot.heroPos} défend
            </span>
          </div>

          <SolvedReplayer key={`replay-${sim}-${spot.id}`} spot={spot} meta={index} heroCards={null} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
            <div>
              <div style={{ background: "var(--panel-2)", borderRadius: 10, padding: 14, fontSize: 12, marginBottom: 14 }}>
                <Row label="Déroulé" value={spot.line} />
                <Row label="Pot" value={`${spot.potBB} bb`} />
                <Row label={`Range de ${spot.heroPos}`} value={`${q.truth.total.toFixed(0)} combos pondérés`} />
                <Row
                  label="Fréquence de ce nœud"
                  value={`${spot.reachPct}% ${spot.reachPct >= 25 ? "— bien convergé" : "— branche rare"}`}
                />
              </div>

              <div style={{ fontSize: 13, marginBottom: 6 }}>
                Quelle part de la range de <strong>{spot.heroPos}</strong> tombe dans chaque catégorie ?
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
                En pourcentage des combos pondérés, total 100. Les tirages comptent en Air, toute paire
                servie sous la plus haute carte du board est une underpair.
                {paired && <> Board pairé : la catégorie du haut devient <strong style={{ color: "var(--text)" }}>Trips+</strong>, la paire du board ne compte pas.</>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {CATEGORIES.map((c) => {
                  const on = available.some((a) => a.id === c.id);
                  const truth = q.truth.pct[c.id];
                  const gap = reveal && on ? numbers[c.id] - truth : null;
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, opacity: on ? 1 : 0.35 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, width: 86 }}>{categoryLabel(c, spot.board)}</span>
                      {on ? (
                        <input
                          type="number" min={0} max={100} step={1} inputMode="numeric"
                          value={guess[c.id] ?? ""} disabled={!!reveal}
                          onChange={(e) => setGuess((g) => ({ ...g, [c.id]: e.target.value }))}
                          style={{
                            width: 64, background: "var(--panel-2)", border: "1px solid var(--border)",
                            color: "var(--text)", borderRadius: 6, padding: "5px 8px", fontSize: 13, fontFamily: MONO,
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--text-muted)", width: 64 }}>impossible</span>
                      )}
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>%</span>
                      {reveal && on && (
                        <span style={{ fontSize: 12, fontFamily: MONO, marginLeft: "auto" }}>
                          <span style={{ color: "var(--text-muted)" }}>solveur </span>
                          <span style={{ fontWeight: 700 }}>{truth.toFixed(0)}%</span>
                          {/* Rouge = trop mis dans la catégorie, bleu = pas assez : le même code
                              que la grille d'écarts du Range Builder. */}
                          <span style={{
                            marginLeft: 8, display: "inline-block", minWidth: 40, textAlign: "right",
                            color: Math.abs(gap) < 2.5 ? "var(--text-muted)" : gap > 0 ? "#E0645A" : "#4FA8E0",
                          }}>
                            {gap > 0 ? "+" : ""}{gap.toFixed(0)}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {!reveal && (
                <>
                  <div style={{ fontSize: 11, fontFamily: MONO, marginBottom: 10, color: complete ? "var(--accent)" : "var(--text-muted)" }}>
                    Total {total.toFixed(0)}%
                    {!complete && (total < 100 ? ` — reste ${(100 - total).toFixed(0)}% à répartir` : ` — ${(total - 100).toFixed(0)}% de trop`)}
                  </div>
                  <button onClick={submit} style={{ ...btn, opacity: complete ? 1 : 0.5 }} disabled={!complete}>
                    Valider ma décomposition
                  </button>
                </>
              )}
            </div>

            <div>
              {!reveal ? (
                <StackedBar pct={numbers} label="Ta décomposition" />
              ) : (
                <div style={{
                  borderRadius: 10, padding: 14, fontSize: 12,
                  background: "rgba(52,211,153,0.08)", border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>{reveal.error.toFixed(1)} points de range mal répartis</span>
                    <span style={{ fontFamily: MONO, fontWeight: 700, color: "var(--accent)" }}>{reveal.note}/100</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
                    {/* Le zéro de la note est mesuré, pas choisi : voir REF_ERROR dans skillScore.js. */}
                    Un joueur qui répondrait toujours la même décomposition se trompe de {refError} points
                    en moyenne : c&apos;est le zéro de la note.
                  </div>

                  <StackedBar pct={numbers} label="Toi" />
                  <StackedBar pct={q.truth.pct} label="Solveur" />

                  {q.folds && (() => {
                    const { foldPct, breakEvenPct } = q.folds;
                    const ecart = foldPct - breakEvenPct;
                    return (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Et ton bluff ?</div>
                        <Row label="Ta mise" value={`${spot.toCallBB.toFixed(2)} bb dans ${(spot.potBB - spot.toCallBB).toFixed(2)} bb`} />
                        <Row label="Fold nécessaire (bluff pur)" value={`${breakEvenPct.toFixed(1)}%`} />
                        <Row label={`Fold réel de ${spot.heroPos}`} value={`${foldPct.toFixed(1)}%`} strong />
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
                          {/* Arithmétique exacte à la river : un bluff sans équité gagne le pot
                              quand l'autre se couche et perd sa mise sinon (une relance le fait
                              coucher, même perte qu'un call). À la turn, l'équité du bluff et la
                              river changent le calcul : on ne tranche pas. */}
                          {spot.street === 3
                            ? (ecart > 0
                              ? `Un bluff sans équité gagne des jetons ici : ${spot.heroPos} se couche ${ecart.toFixed(1)} points au-dessus du seuil.`
                              : `Un bluff sans équité perd des jetons ici : il manque ${(-ecart).toFixed(1)} points de fold.`)
                            : `Fold réel ${Math.abs(ecart).toFixed(1)} points ${ecart > 0 ? "au-dessus" : "en dessous"} du seuil. Il reste la river : ton bluff garde de l'équité et la suite du coup compte, ce seuil ne tranche pas seul.`}
                          {" "}Seuil en jetons, calculé sur toute la range sans les bloqueurs de ta main ; la sim étant en ICM, le vrai seuil est plus haut.
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                      Ce qui compose chaque catégorie
                      <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> · en % de la range entière</span>
                    </div>
                    {CATEGORIES.filter((c) => q.truth.pct[c.id] >= 0.5).map((c) => {
                      // Classes triées par poids, exprimées en part de la RANGE ENTIÈRE : on voit
                      // d'un coup d'œil ce qui fait le gros d'une catégorie.
                      const top = Object.entries(q.truth.classes[c.id])
                        .sort((a, b) => b[1] - a[1]).slice(0, 10);
                      const f = q.folds?.byCat[c.id];
                      return (
                        <div key={c.id} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                            <span style={{ fontSize: 11, fontWeight: 600 }}>{categoryLabel(c, spot.board)}</span>
                            <span style={{ fontSize: 11, fontFamily: MONO, color: "var(--text-muted)" }}>
                              {q.truth.pct[c.id].toFixed(0)}%
                              {/* Ce que la catégorie fait face à la mise : c'est là qu'on voit
                                  quelles mains ton bluff fait réellement coucher. */}
                              {f?.total > 0 && ` · se couche ${((f.fold / f.total) * 100).toFixed(0)}%`}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, fontFamily: MONO, color: "var(--text-muted)", lineHeight: 1.7 }}>
                            {/* Espace insécable : une classe ne doit jamais être séparée de son chiffre en fin de ligne. */}
                            {top.map(([cls, w]) => `${cls} ${((w / q.truth.total) * 100).toFixed(1)}`).join(" · ")}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={newQuestion} style={{ ...btn, marginTop: 8 }}>Range suivante →</button>
                </div>
              )}
            </div>
          </div>

          {/* Seulement après validation : la charnière révèle la composition de la range. La clé
              remet la molette sur la taille jouée à chaque nouveau spot. */}
          {reveal && (
            <PivotDial
              key={`pivot-${sim}-${spot.id}`}
              combos={q.pairs}
              board={spot.board}
              playedSizePct={(spot.toCallBB / (spot.potBB - spot.toCallBB)) * 100}
              pos={spot.heroPos}
            />
          )}
        </div>
      )}
    </div>
  );
}
