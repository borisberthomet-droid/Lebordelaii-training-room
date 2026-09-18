"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SimsEnPreparation from "@/components/SimsEnPreparation";
import RangeGrid from "@/components/RangeGrid";
import MiniCard from "@/components/MiniCard";
import SolvedReplayer from "@/components/SolvedReplayer";
import { BUCKETS, bucketFor } from "@/lib/poker/relativeStrength";
import { RangeBuilderIcon } from "@/components/ToolIcons";
import { recordSkillAttempt } from "@/lib/supabase/skillAttempts";
import { knownCards } from "@/lib/poker/scoring";
import { useSolvedSims, libelleSim, TOUTES } from "@/lib/useSolvedSims";

// Les simulations disponibles sont découvertes à l'exécution via public/solved/sims.json, que le
// script de build tient à jour. Écrire un nom de sim en dur ici obligerait à toucher au code à
// chaque nouvelle texture.

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
        fontFamily: "var(--font-ibm-plex-mono), monospace",
        color: strong ? "var(--accent)" : "var(--text)", fontWeight: strong ? 700 : 400,
      }}>{value}</span>
    </div>
  );
}

// Tirage d'un combo dans la range de hero, pondéré par sa fréquence d'arrivée au nœud : une main
// jouée 20% du temps doit sortir 5 fois moins souvent qu'une main jouée toujours.
function drawCombo(combos) {
  const total = combos.reduce((a, c) => a + c[1], 0);
  let r = Math.random() * total;
  for (const c of combos) { r -= c[1]; if (r <= 0) return c; }
  return combos[combos.length - 1];
}

const ACTION_LABEL = { F: "fold", C: "call", R: "raise", X: "check" };

// Lecture du spot, entièrement dérivée des chiffres affichés au-dessus.
//
// La distinction qui compte — et que la première version ratait — est de savoir si le FOLD fait
// partie du mélange. Mesuré sur les 151 789 combos du jeu de données :
//   partage AVEC le fold        : écart médian équité − cote = +1.8 pt   (vraie indifférence)
//   partage SANS le fold (c/r)  : écart médian = +43.4 pt                (main de value)
// Traiter les deux comme « le solveur hésite parce que c'est à la cote » était faux dans un cas
// sur cinq. On dit donc ce que le solveur fait, on donne les deux nombres, et on n'affirme une
// relation de cause à effet que là où elle tient.
function readOut(combo, spot) {
  const [, , equity, percentile, played] = combo;
  const odds = spot.potOddsPct;
  const foldIdx = spot.actions.findIndex((a) => a.type === "F");
  const callIdx = spot.actions.findIndex((a) => a.type === "C");
  const folds = foldIdx >= 0 ? played[foldIdx] || 0 : 0;
  const calls = callIdx >= 0 ? played[callIdx] || 0 : 0;
  const isMix = (f) => f > 0.05 && f < 0.95;
  const mixed = played.filter(isMix).length >= 2;
  const ecart = equity - odds;
  const chiffres = `${equity.toFixed(1)}% d'équité contre ${odds}% de cote`;

  // Contradiction franche entre la stratégie du solveur et la cote : payer presque toujours avec
  // une équité très en dessous. Ça n'arrive que dans les branches peu visitées (0 cas au-dessus
  // de 25% d'atteinte, 0.2 à 0.8% en dessous) : c'est la convergence du solveur qui manque, pas
  // une subtilité à apprendre. On le dit au lieu de faire semblant d'y voir une leçon.
  if (calls > 0.9 && ecart < -12) {
    return `À prendre avec des pincettes : le solveur paie ici alors que l'équité (${equity.toFixed(1)}%) est très en dessous de la cote (${odds}%). Ce nœud n'est atteint que ${spot.reachPct}% du temps, il est mal convergé. Ton percentile, lui, reste exact.`;
  }
  // Sur le turn il reste une street : la cote immédiate ne décide pas seule, l'équité implicite
  // et la position pèsent aussi. Ne pas le dire ferait passer un écart pour une contradiction.
  const suite = spot.street === 2 ? " Attention, il reste la river : la cote immédiate ne tranche pas à elle seule." : "";

  if (mixed && isMix(folds)) {
    return `Main d'indifférence : ${chiffres}. Le solveur partage entre payer et se coucher parce que les deux valent presque la même chose.${suite}`;
  }
  if (mixed) {
    return `Main de value : le solveur ne se couche pas, il choisit entre payer et relancer. ${chiffres} — la question n'est pas de continuer, mais de combien.`;
  }
  if (folds > 0.95) {
    return `Fold pur : ${chiffres}, il manque ${(-ecart).toFixed(1)} points. Ton percentile ne suffit pas — ici c'est la cote qui tranche.${suite}`;
  }
  if (percentile < 20) {
    return `Haut de ta range, action tranchée : ${chiffres}.`;
  }
  return `Action tranchée : ${chiffres}, soit ${ecart > 0 ? "+" : ""}${ecart.toFixed(1)} points d'écart.${suite}`;
}

// Textures utilisables par cet exercice : celles qui contiennent des spots où hero fait face à
// une mise. Fonction définie ici, hors du composant, pour rester stable d'un rendu à l'autre.
const A_DES_SPOTS = (s) => (s.spots || 0) > 0;

export default function RangePositionPage() {
  const { sims, sim, setSim, indexes, prets, rassembler, error, empty } = useSolvedSims(A_DES_SPOTS);
  // Deux sens pour la même question. À un nœud, hero est TOUJOURS celui qui fait face à la mise,
  // donc le défenseur : seule la formulation change, la bonne réponse est la même.
  //   "moi" — je défends, où est MA main dans MA range ?
  //   "lui" — j'attaque, où est SA main dans SA range de défense ? C'est ce sens qui dit si mes
  //           bluffs passent et si l'adversaire respecte sa MDF.
  const [mode, setMode] = useState("moi");
  const [streets, setStreets] = useState(["turn", "river"]);
  // null = tous les types de nœud. Une liste figée devrait être recalculée à chaque changement
  // de texture ; ce sentinelle évite de remettre l'état à jour depuis un effet.
  const [archetypesChoisis, setArchetypesChoisis] = useState(null);
  const [q, setQ] = useState(null);       // { spot, combo, meta, sim }
  const [answer, setAnswer] = useState(null);
  const [stats, setStats] = useState({ good: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  const tousSpots = useMemo(() => rassembler((idx) => idx.spots), [rassembler]);
  // Blindes, tapis et flop d'affichage : toutes les textures d'un même scénario les partagent.
  const apercu = sim === TOUTES ? Object.values(indexes)[0] : indexes[sim];
  const allArchetypes = useMemo(() => [...new Set(tousSpots.map((s) => s.archetype))].sort(), [tousSpots]);
  const archetypes = archetypesChoisis ?? allArchetypes;

  const pool = useMemo(
    () => tousSpots.filter((s) => streets.includes(s.streetName) && archetypes.includes(s.archetype)),
    [tousSpots, streets, archetypes]
  );

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const toggleArchetype = (a) =>
    setArchetypesChoisis(archetypes.includes(a) ? archetypes.filter((x) => x !== a) : [...archetypes, a]);

  const newQuestion = async () => {
    if (!pool.length) return;
    setLoading(true); setAnswer(null);
    try {
      // Chaque spot porte sa texture d'origine : c'est elle qui dit où chercher le fichier et
      // quelles blindes afficher, puisque l'élève peut s'entraîner sur toutes les textures.
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const res = await fetch(`/solved/${pick.sim}/${pick.id}.json`);
      if (!res.ok) throw new Error(`spot ${pick.id} introuvable`);
      const spot = await res.json();
      setQ({ spot, combo: drawCombo(spot.combos), meta: indexes[pick.sim], sim: pick.sim });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const submit = (bucketId) => {
    if (!q || answer) return;
    const truth = bucketFor(q.combo[3]).id;
    setAnswer({ given: bucketId, truth, ok: bucketId === truth });
    setStats((s) => ({ good: s.good + (bucketId === truth ? 1 : 0), total: s.total + 1 }));
    // Alimente la fiche joueur. Jamais bloquant : un enregistrement raté ne doit pas
    // interrompre l'exercice.
    recordSkillAttempt({
      exercise: "range-position",
      outcome: { correct: bucketId === truth },
      meta: { sim: q.sim, spot: q.spot.id, street: q.spot.streetName, archetype: q.spot.archetype },
    }).catch(() => {});
  };

  if (empty) return <SimsEnPreparation title="Où suis-je dans ma range ?" />;

  if (error) {
    return (
      <div style={{ padding: 20, width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ fontSize: 14, color: "#E0645A" }}>Impossible de charger la simulation : {error}</div>
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
      </div>
    );
  }

  const spot = q?.spot;
  const combo = q?.combo;
  const heroCards = combo ? [combo[0].slice(0, 2), combo[0].slice(2, 4)] : null;

  return (
    <div style={{ minHeight: "100vh", padding: 20, width: "100%", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RangeBuilderIcon size={22} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>Où suis-je dans ma range ?</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontFamily: "var(--font-ibm-plex-mono), monospace", color: "var(--text-muted)" }}>
            {stats.total ? `${stats.good}/${stats.total}` : "—"}
          </span>
          <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Quelle range situer</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <button onClick={() => { setMode("moi"); setAnswer(null); }} style={chip(mode === "moi")}>
            Ma main dans ma range
          </button>
          <button onClick={() => { setMode("lui"); setAnswer(null); }} style={chip(mode === "lui")}>
            Sa main dans sa range de défense
          </button>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
          {mode === "moi"
            ? "Tu fais face à une mise. Situe ta main dans ta propre range de défense."
            : "C'est toi qui attaques. Situe la main de ton adversaire dans SA range de défense : c'est ce qui dit si tes bluffs passent, et s'il respecte sa MDF."}
        </div>

        {sims && sims.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Texture</label>
            <select value={sim} onChange={(e) => { setSim(e.target.value); setQ(null); setAnswer(null); }} style={{
              width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
              color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
            }}>
              <option value={TOUTES}>
                Toutes les textures — {sims.length} boards, {sims.reduce((a, s) => a + (s.spots || 0), 0)} spots
              </option>
              {sims.map((s) => <option key={s.name} value={s.name}>{libelleSim(s, s.spots)}</option>)}
            </select>
          </div>
        )}

        {!prets ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chargement des simulations…</div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.6 }}>
              {apercu && <>
                Simulations de solveur · {sim === TOUTES ? `${sims.length} textures` : `flop ${apercu.boardFlop.join(" ")}`} ·
                {" "}{apercu.effectiveBB} bb de départ · blinds {apercu.blinds.sb}/{apercu.blinds.bb} ante {apercu.blinds.ante}.
                {" "}
              </>}
              Le classement est calculé par équité face à la range réelle de l&apos;adversaire à ce nœud,
              turn et river énumérés exhaustivement.
            </div>

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

            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Type de nœud</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {allArchetypes.map((a) => (
                <button key={a} onClick={() => toggleArchetype(a)} style={chip(archetypes.includes(a))}>
                  {a}
                  <span style={{ opacity: 0.65, marginLeft: 6, fontSize: 10 }}>
                    {tousSpots.filter((x) => x.archetype === a).length}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button onClick={() => { setStreets(["turn", "river"]); setArchetypesChoisis(null); }} style={ghost}>Tout</button>
              <button onClick={() => setArchetypesChoisis([])} style={ghost}>Aucun</button>
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
            <span style={{ fontSize: 14, fontWeight: 700 }}>{spot.archetype}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {spot.streetName} · {mode === "moi"
                ? `tu es ${spot.heroPos} contre ${spot.villainPos}`
                : `tu es ${spot.villainPos}, tu attaques — ${spot.heroPos} défend`}
            </span>
          </div>

          {spot.sequence
            ? <SolvedReplayer spot={spot} meta={q.meta} heroCards={heroCards} />
            : (
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>Board</span>
                {spot.board.map((c) => <MiniCard key={c} card={c} />)}
              </div>
            )}

          <div style={{ background: "var(--panel-2)", borderRadius: 10, padding: 14, fontSize: 12, marginBottom: 14 }}>
            <Row label="Déroulé" value={spot.line} />
            <Row label="Pot" value={`${spot.potBB} bb`} />
            <Row label="À payer" value={`${spot.toCallBB} bb — cote ${spot.potOddsPct}%`} />
            <Row label="Taille de la range ici" value={`${spot.weightTotal} combos pondérés`} />
            <Row
              label="Fréquence de ce nœud"
              value={`${spot.reachPct}% ${spot.reachPct >= 25 ? "— stratégie bien convergée" : "— branche rare, stratégie approximative"}`}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {mode === "moi" ? "Ta main" : `La main de ${spot.heroPos}`}
            </span>
            {heroCards.map((c) => <MiniCard key={c} card={c} />)}
          </div>

          <div style={{ fontSize: 13, marginBottom: 10 }}>
            {mode === "moi"
              ? <>Où te situes-tu dans <strong>ta propre range</strong> à ce nœud ?</>
              : <>Où cette main se situe-t-elle dans <strong>la range de défense de {spot.heroPos}</strong> ?</>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {BUCKETS.map((b) => {
              const chosen = answer && answer.given === b.id;
              const isTruth = answer && answer.truth === b.id;
              const bg = !answer ? "var(--panel-2)"
                : isTruth ? "rgba(52,211,153,0.18)"
                : chosen ? "rgba(224,100,90,0.18)" : "var(--panel-2)";
              const border = !answer ? "var(--border)"
                : isTruth ? "var(--accent)" : chosen ? "#E0645A" : "var(--border)";
              return (
                <button key={b.id} onClick={() => submit(b.id)} disabled={!!answer}
                  style={{
                    padding: "10px 14px", borderRadius: 8, border: `1px solid ${border}`, background: bg,
                    color: "var(--text)", cursor: answer ? "default" : "pointer", fontSize: 12, fontWeight: 600,
                    display: "flex", flexDirection: "column", gap: 2, alignItems: "center", minWidth: 96,
                  }}>
                  {b.label}
                  <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 400 }}>{b.range}</span>
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
                {answer.ok ? "Exact" : `Raté — c'était ${BUCKETS.find((b) => b.id === answer.truth).label}`}
              </div>
              <div style={{ color: "var(--text-muted)", lineHeight: 1.9 }}>
                <Row label={mode === "moi" ? "Percentile dans ta range" : `Percentile dans la range de ${spot.heroPos}`}
                  value={`${combo[3].toFixed(1)}%`} strong />
                <Row label="Équité de cette main" value={`${combo[2].toFixed(1)}%`} />
                <Row label="Cote du pot à battre" value={`${spot.potOddsPct}%`} />

                {/* Le cœur de la question « est-ce que mes bluffs passent » : comparer ce que la
                    range DOIT défendre à ce qu'elle défend vraiment. Un écart négatif signifie
                    qu'un bluff est rentable contre elle. */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
                    Défense de la range de {spot.heroPos}
                  </div>
                  <Row label="MDF théorique" value={`${spot.mdfPct}%`} />
                  <Row label="Ce que le solveur défend" value={`${spot.defendPct}%`} />
                  <Row label="Taille de la mise" value={`${((spot.toCallBB / (spot.potBB - spot.toCallBB)) * 100).toFixed(0)}% du pot`} />
                  <div style={{ fontSize: 11, marginTop: 4, color: "var(--text-muted)" }}>
                    {/* On donne les deux nombres et l'écart, rien de plus. Deux tentatives
                        d'explication générale ont été mesurées puis abandonnées : ni la street ni
                        la taille de mise n'expliquent l'écart de façon fiable une fois agrégé sur
                        l'arbre. La seule régularité nette apparaît à ranges identiques, où
                        l'écart se referme quand la mise grossit (−27 pts à 25% du pot, −0.2 pt à
                        281%) — c'est le cas polarisé, celui où la MDF mord vraiment. */}
                    Écart de {(spot.defendPct - spot.mdfPct).toFixed(1)} points. La MDF est un
                    repère, pas une obligation : elle ne mord que face à une range polarisée, et
                    sur cette sim le solveur défend en dessous presque partout.
                  </div>
                </div>

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
                    Ce que le solveur fait de cette main
                  </div>
                  {spot.actions.map((a, i) => {
                    const f = combo[4][i] || 0;
                    if (f < 0.005) return null;
                    return (
                      <Row key={i}
                        label={`${ACTION_LABEL[a.type] || a.type}${a.amountBB ? ` ${a.amountBB} bb` : ""}`}
                        value={`${(f * 100).toFixed(1)}%`}
                        strong={f > 0.5}
                      />
                    );
                  })}
                </div>

                <div style={{ marginTop: 8, fontSize: 11 }}>
                  {/* Commentaire dérivé des chiffres affichés, jamais d'une intuition : une main
                      partagée entre deux actions est une main d'indifférence, et c'est visible en
                      comparant son équité à la cote du pot. Dire « pourtant payée » d'une main
                      couchée la majorité du temps serait faux. */}
                  {readOut(combo, spot)}
                </div>
              </div>

              {/* La range du solveur, après coup : c'est là qu'on voit ce que la range contient
                  vraiment, et à quelle fréquence chaque combo y arrive. */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>
                  La range de {spot.heroPos} à ce nœud
                </div>
                <RangeGrid
                  comboWeights={Object.fromEntries(spot.combos.map((c) => [c[0], c[1]]))}
                  setComboWeights={() => {}}
                  mode="reveal"
                  excludedCards={knownCards([], spot.board.join(" "))}
                  resultReveal={{ villainKey: combo[0], found: answer.ok }}
                  showFilters={false}
                />
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
                  Les pourcentages sont les fréquences du solveur. Clic droit sur une case pour le
                  détail combo par combo. Le cadre marque la main tirée.
                </div>
              </div>

              <button onClick={newQuestion} style={{ ...btn, marginTop: 12 }}>Question suivante →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
