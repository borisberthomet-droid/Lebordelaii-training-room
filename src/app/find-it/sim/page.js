"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SimsEnPreparation from "@/components/SimsEnPreparation";
import Logo from "@/components/Logo";
import MiniCard from "@/components/MiniCard";
import RangeGrid from "@/components/RangeGrid";
import SolvedReplayer from "@/components/SolvedReplayer";
import { scoreAttempt, knownCards } from "@/lib/poker/scoring";
import { recordSkillAttempt } from "@/lib/supabase/skillAttempts";
import { useSolvedSims, libelleSim, TOUTES } from "@/lib/useSolvedSims";

// Find It sur simulation résolue. Même exercice que le Find It classique — reconstruire la range
// adverse — mais la référence n'est plus une range dessinée à la main : c'est celle que le
// solveur a réellement à ce nœud, après l'action qu'on vient de voir.
//
// L'élève est celui qui FAIT FACE à la mise ; la range à retrouver est celle de celui qui vient
// de miser. C'est la question qu'on se pose vraiment à la table.

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

// Tirage pondéré : une main que le vilain ne mise qu'un quart du temps doit sortir quatre fois
// moins souvent, sinon l'élève apprend une range plate qui n'existe pas.
function drawWeighted(entries) {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
  return entries[entries.length - 1][0];
}

// Textures utilisables ici : celles qui contiennent des ranges de mise à reconstruire.
const A_DES_SPOTS = (s) => (s.findIt || 0) > 0;

export default function FindItSimPage() {
  const { sims, sim, setSim, indexes, prets, rassembler, error, empty } = useSolvedSims(A_DES_SPOTS);
  const [streets, setStreets] = useState(["turn", "river"]);
  const [q, setQ] = useState(null);          // { spot, villainWeights, heroCards, villainKey }
  const [selection, setSelection] = useState({});
  const [reveal, setReveal] = useState(null);
  const [stats, setStats] = useState({ found: 0, total: 0, somme: 0 });
  const [loading, setLoading] = useState(false);

  const tousSpots = useMemo(() => rassembler((idx) => idx.findItSpots), [rassembler]);

  const pool = useMemo(
    () => tousSpots.filter((s) => streets.includes(s.streetName)),
    [tousSpots, streets]
  );

  const nouveau = async () => {
    if (!pool.length) return;
    setLoading(true); setReveal(null); setSelection({});
    try {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const [spot, ref] = await Promise.all([
        fetch(`/solved/${pick.sim}/${pick.id}.json`).then((r) => r.json()),
        fetch(`/solved/${pick.sim}/r${pick.id}.json`).then((r) => r.json()),
      ]);
      const villainWeights = Object.fromEntries(ref.villainCombos);
      // La main de l'élève est tirée dans SA range au nœud, celle du vilain dans la range à
      // deviner — et les deux ne peuvent pas partager une carte.
      const heroKey = drawWeighted(spot.combos.map((c) => [c[0], c[1]]));
      const heroCards = [heroKey.slice(0, 2), heroKey.slice(2, 4)];
      const possibles = ref.villainCombos.filter(
        ([k]) => !heroCards.includes(k.slice(0, 2)) && !heroCards.includes(k.slice(2, 4))
      );
      setQ({ spot, villainWeights, heroCards, villainKey: drawWeighted(possibles), meta: indexes[pick.sim], sim: pick.sim });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const valider = () => {
    if (!q || reveal) return;
    const selected = Object.entries(selection).filter(([, v]) => v > 0).map(([k]) => k);
    const { found, score } = scoreAttempt(selected, q.villainWeights, q.villainKey);
    const poids = Object.values(q.villainWeights);
    setReveal({
      found, score, selectedCount: selected.length,
      referenceCount: poids.length,
      referenceWeighted: poids.reduce((a, b) => a + b, 0),
    });
    setStats((s) => ({ found: s.found + (found ? 1 : 0), total: s.total + 1, somme: s.somme + score }));
    recordSkillAttempt({
      exercise: "find-it", outcome: { ratio: score / 100 },
      meta: { sim: q.sim, spot: q.spot.id, found, selectedCount: selected.length, source: "solveur" },
    }).catch(() => {});
  };

  if (empty) return <SimsEnPreparation title="Find It — sur simulation" />;

  if (error) {
    return (
      <div style={{ padding: 20, width: "100%", maxWidth: 780, margin: "0 auto" }}>
        <div style={{ fontSize: 14, color: "#E0645A", marginBottom: 8 }}>{error}</div>
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
      </div>
    );
  }

  const spot = q?.spot;
  const exclues = spot ? knownCards(q.heroCards, spot.board.join(" ")) : [];

  return (
    <div style={{ minHeight: "100vh", padding: 20, width: "100%", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={24} showWordmark={false} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>Find It — sur simulation</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontFamily: "var(--font-ibm-plex-mono), monospace", color: "var(--text-muted)" }}>
            {stats.total ? `${stats.found}/${stats.total} trouvés · ${Math.round(stats.somme / stats.total)} de moyenne` : "—"}
          </span>
          <Link href="/find-it" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Find It</Link>
          <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>Accueil</Link>
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
          La range à retrouver est celle du <strong style={{ color: "var(--text)" }}>solveur</strong>, pas une
          range dessinée à la main : c&apos;est exactement ce que ton adversaire mise à ce nœud.
        </div>

        {sims && sims.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Texture</label>
            <select value={sim} onChange={(e) => { setSim(e.target.value); setQ(null); setReveal(null); setSelection({}); }} style={{
              width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
              color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
            }}>
              <option value={TOUTES}>
                Toutes les textures — {sims.length} boards, {sims.reduce((a, s) => a + (s.findIt || 0), 0)} spots
              </option>
              {sims.map((s) => <option key={s.name} value={s.name}>{libelleSim(s, s.findIt)}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {["turn", "river"].map((s) => (
            <button key={s} onClick={() => setStreets((l) => l.includes(s) ? l.filter((x) => x !== s) : [...l, s])}
              style={chip(streets.includes(s))}>
              {s}
              <span style={{ opacity: 0.65, marginLeft: 6, fontSize: 10 }}>
                {tousSpots.filter((x) => x.streetName === s).length}
              </span>
            </button>
          ))}
          <button onClick={() => setStreets(["turn", "river"])} style={ghost}>Tout</button>
        </div>

        <button onClick={nouveau} style={btn} disabled={!pool.length || loading}>
          {loading ? "…" : "Nouveau spot"}
        </button>
        <span style={{ fontSize: 11, color: pool.length ? "var(--text-muted)" : "#E0645A", marginLeft: 12 }}>
          {pool.length ? `${pool.length} spots disponibles` : "Aucun spot : élargis les filtres."}
        </span>
      </div>

      {spot && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{spot.archetype}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {spot.streetName} · tu es {spot.heroPos} — retrouve la range de {spot.villainPos}
            </span>
          </div>

          <SolvedReplayer spot={spot} meta={q.meta} heroCards={q.heroCards} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, alignItems: "start" }}>
            <div>
              <div style={{ background: "var(--panel-2)", borderRadius: 10, padding: 14, fontSize: 12, marginBottom: 14 }}>
                <Row label="Déroulé" value={spot.line} />
                <Row label="Pot" value={`${spot.potBB} bb`} />
                <Row label="À payer" value={`${spot.toCallBB} bb — cote ${spot.potOddsPct}%`} />
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ta main</span>
                {q.heroCards.map((c) => <MiniCard key={c} card={c} />)}
              </div>

              {!reveal ? (
                <>
                  <div style={{ fontSize: 13, marginBottom: 10 }}>
                    Sélectionne les combos avec lesquels <strong>{spot.villainPos}</strong> mise ici.
                  </div>
                  <button onClick={valider} style={btn}
                    disabled={!Object.values(selection).some((v) => v > 0)}>
                    Valider ma range
                  </button>
                </>
              ) : (
                <div style={{
                  borderRadius: 10, padding: 14, fontSize: 12,
                  background: reveal.found ? "rgba(52,211,153,0.12)" : "rgba(224,100,90,0.12)",
                  border: `1px solid ${reveal.found ? "rgba(52,211,153,0.35)" : "rgba(224,100,90,0.35)"}`,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, color: reveal.found ? "#34D399" : "#E0645A" }}>
                    {reveal.found
                      ? `Trouvé — ${reveal.score}/100`
                      : "Raté — sa main n'était pas dans ta sélection"}
                  </div>
                  <div style={{ color: "var(--text-muted)", lineHeight: 1.9 }}>
                    <Row label="Sa main" value={`${q.villainKey.slice(0, 2)} ${q.villainKey.slice(2, 4)}`} strong />
                    <Row label="Ta sélection" value={`${reveal.selectedCount} combos`} />
                    <Row label="Sa vraie range" value={`${reveal.referenceCount} combos, ${reveal.referenceWeighted.toFixed(0)} pondérés`} />
                    <div style={{ marginTop: 8, fontSize: 11 }}>
                      {/* Le score ne récompense pas le volume : une sélection large contenant la
                          bonne main est diluée par toutes celles que le solveur ne mise pas. */}
                      Le score est la densité moyenne de ta sélection dans sa range. Sélectionner
                      large pour être sûr de tomber dessus fait donc baisser la note.
                    </div>
                  </div>
                  <button onClick={nouveau} style={{ ...btn, marginTop: 12 }}>Spot suivant →</button>
                </div>
              )}
            </div>

            <div>
              <RangeGrid
                comboWeights={reveal ? q.villainWeights : selection}
                setComboWeights={reveal ? () => {} : setSelection}
                mode={reveal ? "reveal" : "play"}
                excludedCards={exclues}
                resultReveal={reveal ? { villainKey: q.villainKey, found: reveal.found } : undefined}
              />
              {reveal && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                  La grille affiche maintenant la range réelle du solveur. Le cadre vert ou rouge
                  marque la main qu&apos;il avait.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
