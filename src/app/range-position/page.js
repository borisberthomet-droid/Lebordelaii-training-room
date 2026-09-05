"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MiniCard from "@/components/MiniCard";
import { BUCKETS, bucketFor } from "@/lib/poker/relativeStrength";
import { RangeBuilderIcon } from "@/components/ToolIcons";

const SIM = "js6h3d-kc-2s";

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
  const folds = foldIdx >= 0 ? played[foldIdx] || 0 : 0;
  const isMix = (f) => f > 0.05 && f < 0.95;
  const mixed = played.filter(isMix).length >= 2;
  const ecart = equity - odds;
  const chiffres = `${equity.toFixed(1)}% d'équité contre ${odds}% de cote`;
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

export default function RangePositionPage() {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);
  const [streets, setStreets] = useState(["turn", "river"]);
  const [archetypes, setArchetypes] = useState([]);
  const [q, setQ] = useState(null);       // { spot, combo }
  const [answer, setAnswer] = useState(null);
  const [stats, setStats] = useState({ good: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/solved/${SIM}/index.json`)
      .then((r) => { if (!r.ok) throw new Error(`index introuvable (${r.status})`); return r.json(); })
      .then(setIndex)
      .catch((e) => setError(e.message));
  }, []);

  const allArchetypes = useMemo(() => {
    if (!index) return [];
    return [...new Set(index.spots.map((s) => s.archetype))].sort();
  }, [index]);

  useEffect(() => { if (allArchetypes.length && !archetypes.length) setArchetypes(allArchetypes); }, [allArchetypes]); // eslint-disable-line react-hooks/exhaustive-deps

  const pool = useMemo(() => {
    if (!index) return [];
    return index.spots.filter((s) => streets.includes(s.streetName) && archetypes.includes(s.archetype));
  }, [index, streets, archetypes]);

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const newQuestion = async () => {
    if (!pool.length) return;
    setLoading(true); setAnswer(null);
    try {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const res = await fetch(`/solved/${SIM}/${pick.id}.json`);
      if (!res.ok) throw new Error(`spot ${pick.id} introuvable`);
      const spot = await res.json();
      setQ({ spot, combo: drawCombo(spot.combos) });
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
  };

  if (error) {
    return (
      <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>
        <div style={{ fontSize: 14, color: "#E0645A" }}>Impossible de charger la simulation : {error}</div>
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
      </div>
    );
  }

  const spot = q?.spot;
  const combo = q?.combo;
  const heroCards = combo ? [combo[0].slice(0, 2), combo[0].slice(2, 4)] : null;

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 720, margin: "0 auto" }}>
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
        {!index ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chargement de la simulation…</div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.6 }}>
              Simulation HRC · flop {index.boardFlop.join(" ")} · {index.effectiveBB} bb effectifs ·
              blinds {index.blinds.sb}/{index.blinds.bb} ante {index.blinds.ante} · ICM de MTT.
              Le classement est calculé par équité face à la range réelle de l&apos;adversaire à ce nœud,
              turn et river énumérés exhaustivement.
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Street</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {["turn", "river"].map((s) => (
                <button key={s} onClick={() => toggle(streets, setStreets, s)} style={chip(streets.includes(s))}>
                  {s}
                  <span style={{ opacity: 0.65, marginLeft: 6, fontSize: 10 }}>
                    {index.spots.filter((x) => x.streetName === s).length}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Type de nœud</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {allArchetypes.map((a) => (
                <button key={a} onClick={() => toggle(archetypes, setArchetypes, a)} style={chip(archetypes.includes(a))}>
                  {a}
                  <span style={{ opacity: 0.65, marginLeft: 6, fontSize: 10 }}>
                    {index.spots.filter((x) => x.archetype === a).length}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button onClick={() => { setStreets(["turn", "river"]); setArchetypes(allArchetypes); }} style={ghost}>Tout</button>
              <button onClick={() => setArchetypes([])} style={ghost}>Aucun</button>
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
              {spot.streetName} · tu es {spot.heroPos} contre {spot.villainPos}
            </span>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>Board</span>
            {spot.board.map((c) => <MiniCard key={c} card={c} />)}
          </div>

          <div style={{ background: "var(--panel-2)", borderRadius: 10, padding: 14, fontSize: 12, marginBottom: 14 }}>
            <Row label="Déroulé" value={spot.line} />
            <Row label="Pot" value={`${spot.potBB} bb`} />
            <Row label="À payer" value={`${spot.toCallBB} bb — cote ${spot.potOddsPct}%`} />
            <Row label="Ta range ici" value={`${spot.combos.length} combos`} />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ta main</span>
            {heroCards.map((c) => <MiniCard key={c} card={c} />)}
          </div>

          <div style={{ fontSize: 13, marginBottom: 10 }}>
            Où te situes-tu dans <strong>ta propre range</strong> à ce nœud ?
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
                <Row label="Percentile dans ta range" value={`${combo[3].toFixed(1)}%`} strong />
                <Row label="Équité face à sa range" value={`${combo[2].toFixed(1)}%`} />
                <Row label="Cote du pot à battre" value={`${spot.potOddsPct}%`} />

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
              <button onClick={newQuestion} style={{ ...btn, marginTop: 12 }}>Question suivante →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
