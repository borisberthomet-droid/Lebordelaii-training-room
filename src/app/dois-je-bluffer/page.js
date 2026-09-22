"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SimsEnPreparation from "@/components/SimsEnPreparation";
import FiltreSims from "@/components/FiltreSims";
import MiniCard from "@/components/MiniCard";
import RangeGrid from "@/components/RangeGrid";
import SolvedReplayer from "@/components/SolvedReplayer";
import MoletteCharniere from "@/components/MoletteCharniere";
import { PotOddsIcon } from "@/components/ToolIcons";
import { knownCards } from "@/lib/poker/scoring";
import { bucketFor } from "@/lib/poker/relativeStrength";
import { recordSkillAttempt } from "@/lib/supabase/skillAttempts";
import { lignesJouees, tirerPondere } from "@/lib/poker/tirage";
import { useSolvedSims } from "@/lib/useSolvedSims";

// « As AGG en bluff » : j'ai la main, je peux miser, et la question n'est pas de savoir si la main
// est bonne mais si elle est ASSEZ MAUVAISE pour partir en bluff.
//
// Le cadre est celui de Boris : à une taille donnée, la théorie autorise une part de bluffs
// B / (P + 2B) — un tiers de la range à taille pot. Ces bluffs se prennent par le BAS de la range.
// Une main de milieu de range qui part en bluff est donc un overbluff : elle a trop de valeur pour
// ça, et la range de mise se retrouve trop chargée en bluffs.
//
// D'où le tirage : seules les mains du bas de la range sont proposées. Une main de tête n'a rien à
// faire dans cet exercice, sa réponse serait « value » et la question n'aurait pas de sens.

// Part de la range à partir de laquelle une main est candidate au bluff. Le percentile se compte
// depuis le HAUT (0% = la meilleure main), donc « 40 et au-delà » = les 60% du bas.
const PERCENTILE_MINI = 40;

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
function tirerCombo(combos) {
  const total = combos.reduce((a, c) => a + c[1], 0);
  let r = Math.random() * total;
  for (const c of combos) { r -= c[1]; if (r <= 0) return c; }
  return combos[combos.length - 1];
}

// Part de bluffs que la théorie autorise à cette taille, exprimée en part de la range.
const partBluffTheorique = (pctPot) => (pctPot / 100) / (1 + 2 * (pctPot / 100));

const actionLabel = (a) =>
  a.type === "X" ? "check" : a.type === "R" ? `bet ${a.pctPot}% (${a.amountBB} bb)` : a.type === "F" ? "fold" : a.type;

// Textures utilisables ici : celles qui contiennent des spots où hero peut miser.
const A_DES_SPOTS = (s) => (s.value || 0) > 0;

export default function DoisJeBlufferPage() {
  const etat = useSolvedSims(A_DES_SPOTS);
  const { sims, indexes, prets, rassembler, error, setError, empty } = etat;
  const [streets, setStreets] = useState(["turn", "river"]);
  const [situations, setSituations] = useState(["Après son check", "Premier de parole"]);
  const [q, setQ] = useState(null);         // { spot, combo, meta, sim }
  const [answer, setAnswer] = useState(null);
  const [stats, setStats] = useState({ good: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  const tousSpots = useMemo(() => rassembler((idx) => idx.valueSpots), [rassembler]);

  const pool = useMemo(
    () => lignesJouees(tousSpots.filter((s) => streets.includes(s.streetName) && situations.includes(s.situation))),
    [tousSpots, streets, situations]
  );

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const nouvelle = async () => {
    if (!pool.length) return;
    setLoading(true); setAnswer(null);
    try {
      // Un nœud peut n'avoir aucune main de bas de range (une range de mise déjà filtrée, par
      // exemple). On retente plutôt que d'afficher une question vide.
      for (let essai = 0; essai < 6; essai++) {
        const pick = tirerPondere(pool);
        const res = await fetch(`/solved/${pick.sim}/v${pick.id}.json`);
        if (!res.ok) throw new Error(`spot ${pick.id} introuvable`);
        const spot = await res.json();
        const candidats = spot.combos.filter((c) => c[3] >= PERCENTILE_MINI);
        if (!candidats.length) continue;
        setQ({ spot, combo: tirerCombo(candidats), meta: indexes[pick.sim], sim: pick.sim });
        return;
      }
      setError("aucune main de bas de range trouvée sur ces filtres");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const repondre = (choix) => {
    if (!q || answer) return;
    const { spot, combo } = q;
    const freqMise = spot.actions.reduce((s, a, i) => s + (a.type === "R" ? (combo[4][i] || 0) : 0), 0);
    const verite = freqMise > 0.5 ? "bluff" : "check";
    const ok = choix === verite;
    setAnswer({ choix, verite, freqMise, ok });
    setStats((s) => ({ good: s.good + (ok ? 1 : 0), total: s.total + 1 }));
    recordSkillAttempt({
      exercise: "bluff-check",
      outcome: { correct: ok },
      meta: { sim: q.sim, spot: spot.id, street: spot.streetName, percentile: combo[3] },
    }).catch(() => {});
  };

  if (empty) return <SimsEnPreparation title="Dois-je bluffer ?" />;

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
  // Taille de référence : celle que le solveur emploie le plus avec CETTE main, à défaut la plus
  // petite mise proposée à ce nœud. Calcul direct plutôt que mémorisé — il vient après les sorties
  // anticipées de la fonction, où un hook n'aurait pas sa place.
  const tailleRef = (() => {
    if (!spot) return null;
    let best = null;
    spot.actions.forEach((a, i) => {
      if (a.type !== "R" || a.pctPot == null) return;
      const f = combo[4][i] || 0;
      if (!best || f > best.f || (f === best.f && a.pctPot < best.pctPot)) best = { pctPot: a.pctPot, f };
    });
    return best ? best.pctPot : null;
  })();

  return (
    <div style={{ minHeight: "100vh", padding: 20, width: "100%", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PotOddsIcon size={22} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>Dois-je bluffer ?</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>as AGG, en bluff</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontFamily: "var(--font-ibm-plex-mono), monospace", color: "var(--text-muted)" }}>
            {stats.total ? `${stats.good}/${stats.total}` : "—"}
          </span>
          <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{
          background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)",
          borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12, lineHeight: 1.6,
        }}>
          <strong style={{ color: "var(--accent)" }}>Objectif</strong> — savoir si ta main est assez
          basse dans ta range pour partir en bluff. À taille pot, la théorie n&apos;autorise qu&apos;un tiers
          de bluffs : une main de milieu de range qui mise est un <strong>overbluff</strong>.
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
          Seules les mains du bas de ta range te sont proposées — au-delà du {PERCENTILE_MINI}e percentile.
          Les mains de tête relèvent de <Link href="/value-equity" style={{ color: "var(--accent)" }}>Quelle est ton équité ?</Link>.
        </div>

        <FiltreSims etat={etat} compte={(s) => s.value} onReset={() => { setQ(null); setAnswer(null); }} />

        {!prets ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chargement de la simulation…</div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Street</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {["turn", "river"].map((s) => (
                <button key={s} onClick={() => toggle(streets, setStreets, s)} style={chip(streets.includes(s))}>
                  {s}
                  <span style={{ opacity: 0.65, marginLeft: 6, fontSize: 10 }}>
                    {tousSpots.filter((x) => x.streetName === s).length}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Situation</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {["Après son check", "Premier de parole"].map((s) => (
                <button key={s} onClick={() => toggle(situations, setSituations, s)} style={chip(situations.includes(s))}>
                  {s}
                </button>
              ))}
              <button onClick={() => { setStreets(["turn", "river"]); setSituations(["Après son check", "Premier de parole"]); }} style={ghost}>
                Tout
              </button>
            </div>

            <button onClick={nouvelle} style={btn} disabled={!pool.length || loading}>
              {loading ? "…" : "Nouvelle main"}
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
            <span style={{ fontSize: 14, fontWeight: 700 }}>{spot.situation}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {spot.streetName} · tu es {spot.heroPos} contre {spot.villainPos}
            </span>
          </div>

          <SolvedReplayer key={`replay-${q.sim}-${spot.id}`} spot={spot} meta={q.meta} heroCards={heroCards} />

          <div style={{ background: "var(--panel-2)", borderRadius: 10, padding: 14, fontSize: 12, marginBottom: 14 }}>
            <Row label="Déroulé" value={spot.line} />
            <Row label="Pot" value={`${spot.potBB} bb`} />
            <Row label="Tapis effectif" value={`${spot.effStackBB} bb`} />
            <Row label="Tailles proposées"
              value={spot.actions.filter((a) => a.type === "R").map((a) => `${a.pctPot}%`).join(" · ") || "—"} />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ta main</span>
            {heroCards.map((c) => <MiniCard key={c} card={c} />)}
          </div>

          <div style={{ fontSize: 13, marginBottom: 10 }}>
            Tu peux miser. <strong>Bluffes-tu cette main</strong>, ou tu checkes ?
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {[{ id: "bluff", label: "Je bluffe" }, { id: "check", label: "Je checke" }].map((b) => {
              const choisi = answer && answer.choix === b.id;
              const vrai = answer && answer.verite === b.id;
              const bg = !answer ? "var(--panel-2)"
                : vrai ? "rgba(52,211,153,0.18)"
                : choisi ? "rgba(224,100,90,0.18)" : "var(--panel-2)";
              const border = !answer ? "var(--border)" : vrai ? "var(--accent)" : choisi ? "#E0645A" : "var(--border)";
              return (
                <button key={b.id} onClick={() => repondre(b.id)} disabled={!!answer} style={{
                  padding: "10px 18px", borderRadius: 8, border: `1px solid ${border}`, background: bg,
                  color: "var(--text)", cursor: answer ? "default" : "pointer", fontSize: 13, fontWeight: 600,
                }}>
                  {b.label}
                </button>
              );
            })}
          </div>

          {answer && (
            <div style={{
              borderRadius: 10, padding: 14, fontSize: 12,
              background: answer.ok ? "rgba(52,211,153,0.12)" : "rgba(224,100,90,0.12)",
              border: `1px solid ${answer.ok ? "rgba(52,211,153,0.35)" : "rgba(224,100,90,0.35)"}`,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: answer.ok ? "#34D399" : "#E0645A" }}>
                {answer.ok ? "Exact" : `Raté — le solveur ${answer.verite === "bluff" ? "mise" : "checke"} cette main`}
              </div>

              <div style={{ color: "var(--text-muted)", lineHeight: 1.9 }}>
                <Row label="Percentile dans ta range" value={`${combo[3].toFixed(1)}% — ${bucketFor(combo[3]).label}`} strong />
                <Row label="Équité contre sa range" value={`${combo[2].toFixed(1)}%`} />
                {tailleRef != null && (
                  <Row label={`Bluffs autorisés à ${tailleRef}% du pot`}
                    value={`${(partBluffTheorique(tailleRef) * 100).toFixed(0)}% de ta range`} />
                )}

                {/* La lecture que Boris veut faire faire : comparer la place de la main dans la
                    range à la part de bluffs que la taille autorise. Au-dessus de la charnière,
                    miser revient à bluffer avec une main qui a trop de valeur pour ça. */}
                {tailleRef != null && (
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    {(() => {
                      const part = partBluffTheorique(tailleRef) * 100;
                      const charniere = 100 - part;
                      return combo[3] >= charniere
                        ? `Ta main est à ${combo[3].toFixed(0)}%, la charnière de bluff à ${charniere.toFixed(0)}% : elle est bien dans la zone de bluff.`
                        : `Ta main est à ${combo[3].toFixed(0)}%, la charnière de bluff à ${charniere.toFixed(0)}% : la bluffer, c'est un overbluff — elle a trop de valeur pour ça.`;
                    })()}
                  </div>
                )}

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
                    Ce que le solveur fait de cette main
                  </div>
                  {spot.actions.map((a, i) => {
                    const f = combo[4][i] || 0;
                    if (f < 0.005) return null;
                    return <Row key={i} label={actionLabel(a)} value={`${(f * 100).toFixed(1)}%`} strong={f > 0.5} />;
                  })}
                </div>
              </div>

              {/* La range qui mise vraiment à ce nœud : c'est là qu'on voit quels bluffs le
                  solveur choisit, et lesquels il laisse checker. */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>
                  La range qui mise à ce nœud
                </div>
                <RangeGrid
                  comboWeights={Object.fromEntries(spot.combos.map((c) => [
                    c[0],
                    c[1] * spot.actions.reduce((s, a, i) => s + (a.type === "R" ? (c[4][i] || 0) : 0), 0),
                  ]))}
                  setComboWeights={() => {}}
                  mode="reveal"
                  excludedCards={knownCards([], spot.board.join(" "))}
                  resultReveal={{ villainKey: combo[0], found: answer.ok }}
                  showFilters={false}
                />
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
                  Poids = fréquence de mise du solveur, toutes tailles confondues. Le cadre marque ta main.
                </div>
              </div>

              <MoletteCharniere
                key={`bluff-${q.sim}-${spot.id}`}
                combos={spot.combos}
                board={spot.board}
                mode="bluff"
                playedSizePct={tailleRef}
                heroKey={combo[0]}
              />

              <button onClick={nouvelle} style={{ ...btn, marginTop: 12 }}>Main suivante →</button>
            </div>
          )}
        </div>
      )}

      {!spot && sims && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Tire une main pour commencer.
        </div>
      )}
    </div>
  );
}
