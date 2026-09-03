"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STAGES, PAYOUT_PCTS, generateStageQuestion } from "@/lib/poker/rpStages";
import { ELASTICITY_LEVELS } from "@/lib/poker/rpFramework";
import { PkoRpIcon } from "@/components/ToolIcons";
import sharkscopeLibrary from "@/data/sharkscopeLibrary.json";

const inputStyle = {
  width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
};

const primaryButtonStyle = {
  padding: "9px 18px", background: "var(--accent-gradient)", color: "#0B1210",
  border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
};

const ghostButtonStyle = {
  padding: "7px 14px", background: "var(--panel-2)", color: "var(--text)",
  border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, cursor: "pointer",
};

const TOL_EXACT = 2;
const TOL_CLOSE = 4;

function chipStyle(active) {
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

export default function RpTrainerPage() {
  const [tournamentId, setTournamentId] = useState(sharkscopeLibrary[0]?.id || "");
  const [pctPaid, setPctPaid] = useState(0.125);
  const [selected, setSelected] = useState(["fl50"]);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({ exact: 0, close: 0, total: 0 });

  const tournament = sharkscopeLibrary.find((t) => t.id === tournamentId);
  const totalEntries = tournament ? tournament.totalEntrants + tournament.reEntries : 0;

  const toggleStage = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const preview = useMemo(() => {
    if (!tournament) return {};
    const out = {};
    for (const st of STAGES) {
      out[st.id] = st.abs
        ? Math.min(st.abs, totalEntries)
        : st.atBubble
          ? Math.round(totalEntries * pctPaid) + 1
          : Math.round(totalEntries * st.fl);
    }
    return out;
  }, [tournament, totalEntries, pctPaid]);

  const handleNew = () => {
    if (!tournament || selected.length === 0) return;
    const stage = STAGES.find((s) => s.id === selected[Math.floor(Math.random() * selected.length)]);
    setQuestion(generateStageQuestion(tournament, stage, pctPaid));
    setAnswer("");
    setResult(null);
  };

  const handleValidate = () => {
    if (!question || answer === "") return;
    const given = parseFloat(answer.replace(",", "."));
    if (isNaN(given)) return;
    const delta = Math.abs(given - question.answer);
    const grade = delta <= TOL_EXACT ? "exact" : delta <= TOL_CLOSE ? "proche" : "loin";
    setResult({ given, delta, grade });
    setStats((s) => ({
      exact: s.exact + (grade === "exact" ? 1 : 0),
      close: s.close + (grade === "proche" ? 1 : 0),
      total: s.total + 1,
    }));
  };

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 780, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PkoRpIcon size={22} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>RP Trainer</span>
          <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Risk Premium par stade</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontFamily: "var(--font-ibm-plex-mono), monospace", color: "var(--text-muted)" }}>
            {stats.total > 0 ? `${stats.exact}/${stats.total} exact · ${stats.close} proche` : "—"}
          </span>
          <Link href="/memo" style={{ fontSize: 12, color: "var(--text-muted)" }}>Mémo</Link>
          <Link href="/pko-rp" style={{ fontSize: 12, color: "var(--text-muted)" }}>← PKO</Link>
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Tournoi</label>
            <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} style={inputStyle}>
              {sharkscopeLibrary.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.totalEntrants + t.reEntries} entrées)</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Structure de payout</label>
            <select value={pctPaid} onChange={(e) => setPctPaid(parseFloat(e.target.value))} style={inputStyle}>
              {PAYOUT_PCTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          Stades à travailler — la bulle se déplace avec la structure de payout.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {STAGES.map((st) => (
            <button key={st.id} onClick={() => toggleStage(st.id)} style={chipStyle(selected.includes(st.id))}
              title={`${preview[st.id]} joueurs restants`}>
              {st.label}
              <span style={{ opacity: 0.65, marginLeft: 6, fontSize: 10 }}>{preview[st.id]}j</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setSelected(STAGES.map((s) => s.id))} style={ghostButtonStyle}>Toutes</button>
          <button onClick={() => setSelected([])} style={ghostButtonStyle}>Aucune</button>
        </div>

        <button onClick={handleNew} style={primaryButtonStyle} disabled={selected.length === 0}>
          Nouvelle question
        </button>
        {selected.length === 0 && (
          <span style={{ fontSize: 11, color: "#E0645A", marginLeft: 12 }}>Sélectionne au moins un stade.</span>
        )}
      </div>

      {question && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{question.stage.label}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {question.tournament} · {question.playersLeft} joueurs restants
            </span>
          </div>
          <div style={{
            fontSize: 10, color: question.confidence.solid ? "var(--text-muted)" : "#E89A47",
            marginBottom: 14, lineHeight: 1.5,
          }}>
            <strong>{question.confidence.engine}</strong> — {question.confidence.note}
          </div>

          <div style={{ background: "var(--panel-2)", borderRadius: 10, padding: 14, fontSize: 12, marginBottom: 14 }}>
            {question.kind === "framework" ? (
              <>
                <Row label="Field restant" value={`${(question.fieldLeft * 100).toFixed(1)}%`} />
                <Row label="Average de la table" value={`${question.avgStackBB} BB`} />
                <Row label="Vilain" value={`${question.villainPos} · ${question.villainStackBB} BB · ${question.nKO} KO de base`} />
                <Row label="Toi" value={`${question.heroPos}${question.coversEveryoneBehind ? " — tu couvres tout le monde derrière" : ""}`} />
                <Row label="Type de spot" value={question.spotFamily === "allin" ? "all-in (k=4.6)" : "vs open raise (k=2.7)"} />
              </>
            ) : (
              <>
                <Row label="Table" value={`${question.playersLeft} joueurs`} />
                <Row label="Ton stack" value={`${question.heroStack} BB`} />
                <Row label="Vilain" value={`${question.villainStack} BB${question.heroCovers ? " (tu le couvres)" : " (il te couvre)"}`} />
                <Row label="Pool KO en circulation" value={question.vanilla ? "aucun (RP vanilla)" : `${Math.round(question.bountyPool)} €`} />
                <Row label="Prizepool restant" value={`${Math.round(question.payouts.reduce((a, b) => a + b, 0))} €`} />
              </>
            )}
          </div>

          <div style={{ fontSize: 13, marginBottom: 12 }}>
            {question.kind === "framework"
              ? "Quel est le Risk Premium de ce spot ?"
              : question.vanilla
                ? "Quel est le Risk Premium ICM de cette confrontation, sans aucune prime ?"
                : "Quel est le Risk Premium ICM + bounty de cette confrontation ?"}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <input
              type="text" inputMode="decimal" placeholder="ex: -12.5" value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !result && handleValidate()}
              disabled={!!result}
              style={{ ...inputStyle, width: 120, textAlign: "center", fontFamily: "var(--font-ibm-plex-mono), monospace", opacity: result ? 0.6 : 1 }}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
            {!result ? (
              <button onClick={handleValidate} style={primaryButtonStyle} disabled={!answer.trim()}>Valider</button>
            ) : (
              <button onClick={handleNew} style={primaryButtonStyle}>Question suivante →</button>
            )}
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
                {result.grade === "exact" ? "✓ Exact" : result.grade === "proche" ? "≈ Proche" : "✗ Loin"}
                {" — ta réponse "}{result.given.toFixed(1)}%, RP réel {question.answer.toFixed(1)}%
                {" (écart "}{result.delta.toFixed(1)} pt)
              </div>

              {question.kind === "framework" ? (
                <div style={{ color: "var(--text-muted)", lineHeight: 1.9 }}>
                  <Row label="1. α au field restant" value={question.alpha.toFixed(3)} />
                  <Row label="2. Starting stack en BB actuelles" value={`${question.avgStackBB} × ${(question.fieldLeft * 100).toFixed(0)}% = ${question.startingStackBB.toFixed(1)} BB`} />
                  <Row label="3. Valeur du KO" value={`${question.nKO} × ${question.alpha.toFixed(3)} × ${question.startingStackBB.toFixed(1)} = ${question.koBB.toFixed(1)} BB`} />
                  <Row label="4. r = KO / stack vilain" value={`${question.koBB.toFixed(1)} / ${question.villainStackBB} = ${question.r.toFixed(2)}`} />
                  <Row label="5. RP = −19% × ln(1 + 1.31r)" value={`${question.rpRaw.toFixed(1)}%`} />
                  {question.coversEveryoneBehind && (
                    <Row label="6. Tu couvres derrière : −5 pts" value={`${question.rp.toFixed(1)}%`} />
                  )}
                  <Row label="Multiplicateur de range" value={`×${question.M.toFixed(2)}`} strong />
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", lineHeight: 1.9 }}>
                  <Row label="Stacks" value={question.stacks.join(" · ")} />
                  <Row label="Confrontation" value={`toi ${question.heroStack} BB vs ${question.villainStack} BB`} />
                  <Row label="Jetons en jeu" value={`${Math.min(question.heroStack, question.villainStack)} BB (le plus petit des deux)`} />
                  <Row label={question.vanilla ? "Pression ICM pure" : "ICM + bounty"} value={`${question.answer.toFixed(1)}%`} strong />
                  <div style={{ marginTop: 8, fontSize: 11 }}>
                    {question.vanilla
                      ? "Sans prime, le RP est toujours positif : l'ICM ne fait que serrer. Le joueur couvert paie la prime la plus lourde — il risque son tournoi sans pouvoir prendre celle de l'adversaire."
                      : question.heroCovers
                        ? "Tu couvres : tu peux encaisser la moitié de sa prime, ce qui compense la pression ICM et peut faire passer le RP en négatif."
                        : "Il te couvre : tu risques ton tournoi sans pouvoir prendre sa prime. Aucun bounty ne vient adoucir l'ICM, le RP reste élevé."}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {question?.kind === "framework" && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.6 }}>
          Élasticités : {ELASTICITY_LEVELS.map((l) => `${l.level} (k=${l.k})`).join(" · ")} — détail dans le{" "}
          <Link href="/memo" style={{ color: "var(--accent)" }}>Mémo</Link>.
        </div>
      )}
    </div>
  );
}
