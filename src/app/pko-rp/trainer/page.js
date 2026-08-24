"use client";

import { useState } from "react";
import Link from "next/link";
import { generateFinalTableQuestion, generateBountyValueQuestion } from "@/lib/poker/rpTrainer";
import { PkoRpIcon } from "@/components/ToolIcons";
import sharkscopeLibrary from "@/data/sharkscopeLibrary.json";

const inputStyle = {
  width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
};

const pct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

const STAGES = [
  { value: "early", label: "Early game", hint: "Loin de la bulle — RP dominé par la valeur du bounty, pression ICM négligeable." },
  { value: "mid", label: "Mid game", hint: "Encore loin des places payées — même logique qu'Early, stacks plus resserrés." },
  { value: "bubble", label: "Bulle", hint: "Juste avant les ITM — ICM réel, mais approximatif (petit groupe simulé, pas le vrai field complet)." },
  { value: "itm", label: "ITM", hint: "Déjà dans les places payées — ICM réel, approximatif tant que le field réel est grand." },
  { value: "finalTable", label: "Table finale", hint: "ICM+bounty exact (Malmuth-Weitzman) sur les vrais joueurs restants." },
];

export default function RpTrainerPage() {
  const [tournamentId, setTournamentId] = useState(sharkscopeLibrary[0]?.id || "");
  const [stage, setStage] = useState("early");
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  const tournament = sharkscopeLibrary.find((t) => t.id === tournamentId);
  const stageMeta = STAGES.find((s) => s.value === stage);
  const isFinalTable = stage === "finalTable";

  const handleNewQuestion = () => {
    if (!tournament) return;
    const q = isFinalTable ? generateFinalTableQuestion(tournament) : generateBountyValueQuestion(tournament, stage);
    setQuestion(q);
    setAnswer("");
    setResult(null);
  };

  const handleValidate = () => {
    if (!question || answer === "") return;
    const given = parseFloat(answer);
    const correct = question.detail.rp * 100;
    const delta = Math.abs(given - correct);
    const grade = delta <= 2 ? "correct" : delta <= 5 ? "proche" : "loin";
    setResult({ given, correct, delta, grade });
    setStats((s) => ({ correct: s.correct + (grade === "correct" ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PkoRpIcon size={22} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>RP Trainer</span>
          <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{stageMeta.label}</span>
        </div>
        <Link href="/pko-rp" style={{ fontSize: 12, color: "var(--text-muted)" }}>← PKO KO &amp; RP</Link>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Tournoi</label>
            <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} style={inputStyle}>
              {sharkscopeLibrary.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Stade</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)} style={inputStyle}>
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14 }}>
          {stageMeta.hint}
        </div>
        <button onClick={handleNewQuestion} style={{
          padding: "9px 18px", background: "var(--accent-gradient)", color: "#0B1210",
          border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}>
          Nouvelle question
        </button>
        <span style={{ marginLeft: 14, fontSize: 12, color: "var(--text-muted)" }}>
          Score : {stats.correct}/{stats.total}
        </span>
      </div>

      {question && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            {question.tournamentName} — {stageMeta.label}
            {question.playersRemaining ? ` (${question.playersRemaining} joueurs restants)` : ""}
            {isFinalTable ? ` (${question.seatCount} joueurs)` : ""}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14, fontSize: 13 }}>
            <div style={{ background: "var(--panel-2)", borderRadius: 8, padding: 12 }}>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 4 }}>Toi (héros)</div>
              <div style={{ fontWeight: 700, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{question.heroStackBB} BB</div>
            </div>
            <div style={{ background: "var(--panel-2)", borderRadius: 8, padding: 12 }}>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 4 }}>Vilain</div>
              <div style={{ fontWeight: 700, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
                {question.villainStackBB} BB · bounty {question.villainBountyBB} BB
                {question.villainBountyEuro ? ` (${question.villainBountyEuro}€)` : ""}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
            Tu pousses tout ton stack, le vilain peut caller. Quel est ton Risk Premium (en %) sur cette confrontation ?
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <input
              type="number" step="0.1" value={answer} onChange={(e) => setAnswer(e.target.value)}
              placeholder="ex: -12.5" style={{ ...inputStyle, maxWidth: 140 }}
              onKeyDown={(e) => e.key === "Enter" && handleValidate()}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
            <button onClick={handleValidate} style={{
              padding: "9px 18px", background: "var(--panel-2)", color: "var(--text)",
              border: "1px solid var(--border)", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>
              Valider
            </button>
          </div>

          {result && (
            <div style={{
              background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 10,
              padding: 14, fontSize: 12,
            }}>
              <div style={{
                fontWeight: 700, marginBottom: 10,
                color: result.grade === "correct" ? "var(--accent)" : result.grade === "proche" ? "#E0A85C" : "#E0645A",
              }}>
                {result.grade === "correct" ? "✓ Correct" : result.grade === "proche" ? "≈ Proche" : "✗ Loin"}
                {" — ta réponse "}{pct(result.given)}{", RP réel "}{pct(result.correct)}
              </div>
              {isFinalTable ? (
                <div style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>
                  Jetons en jeu (le plus petit des deux stacks) : {question.detail.atRisk.toFixed(1)} BB<br />
                  Équité $ maintenant : {question.detail.eqNow.toFixed(1)}<br />
                  Équité $ si tu gagnes : {question.detail.eqWin.toFixed(1)} ({question.detail.gainPerChip.toFixed(2)} $/jeton gagné)<br />
                  Équité $ si tu perds : {question.detail.eqLose.toFixed(1)} ({question.detail.lossPerChip.toFixed(2)} $/jeton perdu)<br />
                  RP = 1 − (gain/jeton ÷ perte/jeton) = {pct(result.correct)}
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>
                  Bounty du vilain : {question.villainBountyEuro}€<br />
                  Valeur du jeton à ce stade ({question.playersRemaining} restants) : {question.chipValueBB.toFixed(4)} €/BB (sur base 100 BB de départ, hypothèse pédagogique)<br />
                  Bounty converti (50% cash immédiat) : {question.villainBountyBB} BB<br />
                  RP = −(bounty BB ÷ stack du vilain) = −({question.villainBountyBB} ÷ {question.villainStackBB}) = {pct(result.correct)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
