"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseWinamaxHH, buildHHReplay } from "@/lib/poker/hhParser";
import { computeSeatRP } from "@/lib/poker/rpFromHH";
import { isHRCExport, computeHRCStats } from "@/lib/poker/hrcJson";
import { isSharkScopeExport, parseSharkScopeTournament } from "@/lib/poker/sharkscopeJson";
import { PkoRpIcon } from "@/components/ToolIcons";

const inputStyle = {
  width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
};

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 };

const FL_OPTIONS = [75, 50, 25, "TF"];

function parseBountyEuro(bountyStr) {
  if (!bountyStr) return 0;
  const m = String(bountyStr).match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

const pct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

// "500-1k +120" / "3.50k-7k +800" -> la BB en jetons (nombre après le "-", avant l'ante)
function parseBBFromLevelText(levelText) {
  if (!levelText) return null;
  const bbPart = String(levelText).split("-")[1];
  if (!bbPart) return null;
  const m = bbPart.match(/([\d.]+)(k)?/);
  if (!m) return null;
  let val = parseFloat(m[1]);
  if (isNaN(val)) return null;
  if (m[2]) val *= 1000;
  return val;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PkoRpPage() {
  const [shots, setShots] = useState([]); // [{ file, previewUrl, mediaType, base64 }]
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState(null);
  const [extractError, setExtractError] = useState("");
  const [input, setInput] = useState("");
  const [avgStackBB, setAvgStackBB] = useState("");
  const [fieldLeft, setFieldLeft] = useState(50);
  const [chipValue, setChipValue] = useState("");
  const [heroIndex, setHeroIndex] = useState(0);
  const [parsedType, setParsedType] = useState(null); // "winamax" | "hrc" | "sharkscope" | null
  const [winamaxRows, setWinamaxRows] = useState(null);
  const [hrcStats, setHrcStats] = useState(null);
  const [sharkscopeTournament, setSharkscopeTournament] = useState(null);
  const [error, setError] = useState("");
  const [knownStartingStack, setKnownStartingStack] = useState(null); // récupéré d'un screenshot extrait plus haut

  const handleAnalyze = () => {
    setError("");
    setWinamaxRows(null);
    setHrcStats(null);
    setSharkscopeTournament(null);
    setParsedType(null);
    if (!input.trim()) { setError("Colle une hand history ou un export JSON d'abord."); return; }

    let json = null;
    try { json = JSON.parse(input); } catch { /* pas du JSON, on tente le format texte Winamax */ }

    if (json && isHRCExport(json)) {
      const stats = computeHRCStats(json);
      if (!stats.players.length) { setError("Export HRC reconnu mais aucun joueur à la table."); return; }
      setParsedType("hrc");
      setHrcStats(stats);
      setHeroIndex(0);
      return;
    }

    if (json && isSharkScopeExport(json)) {
      const t = parseSharkScopeTournament(json);
      setParsedType("sharkscope");
      setSharkscopeTournament(t);
      // La vraie valeur du jeton ne peut se calculer que si on connaît le stack de
      // départ (pas dans cet export) — on réutilise celui d'un screenshot déjà extrait.
      if (knownStartingStack > 0 && t.stake > 0) {
        setChipValue(String(t.stake / knownStartingStack));
      }
      return;
    }

    const parsed = parseWinamaxHH(input);
    const bb = buildHHReplay(input).bb;
    if (!parsed.seatsBase?.length || !bb) {
      setError("Format non reconnu — colle soit une hand history Winamax complète, soit un export JSON HRC.");
      return;
    }
    const hero = parsed.seatsBase.find((s) => s.role === "hero");
    if (!hero) {
      setError('Impossible d\'identifier le héros dans cette main (pas de "Dealt to").');
      return;
    }
    const cv = parseFloat(chipValue);
    const avg = parseFloat(avgStackBB);
    const heroStackBB = hero.stackBB;

    const built = parsed.seatsBase.map((seat) => {
      const bountyEuro = parseBountyEuro(seat.bounty);
      const bountyBB = cv > 0 ? bountyEuro / (cv * bb) : null;
      if (seat.role === "hero") return { ...seat, bountyEuro, bountyBB, isHero: true };
      const rp = avg > 0 && bountyBB != null
        ? computeSeatRP({ villainStackBB: seat.stackBB, villainBountyBB: bountyBB, heroStackBB, avgStackBB: avg, fieldLeftPct: fieldLeft })
        : null;
      return { ...seat, bountyEuro, bountyBB, isHero: false, rp };
    });
    setParsedType("winamax");
    setWinamaxRows(built);
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    const withData = await Promise.all(files.map(async (file) => ({
      file, previewUrl: URL.createObjectURL(file), mediaType: file.type, base64: await fileToBase64(file),
    })));
    setShots((prev) => [...prev, ...withData]);
    setExtractResult(null);
    setExtractError("");
  };

  const removeShot = (i) => setShots((prev) => prev.filter((_, idx) => idx !== i));

  const handleExtract = async () => {
    if (!shots.length) { setExtractError("Ajoute au moins un screenshot d'abord."); return; }
    setExtracting(true);
    setExtractError("");
    setExtractResult(null);
    try {
      const res = await fetch("/api/extract-tournament-info", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images: shots.map((s) => ({ mediaType: s.mediaType, base64: s.base64 })) }),
      });
      const data = await res.json();
      if (!res.ok) { setExtractError(data.error || "Erreur inconnue"); return; }
      const ex = data.extracted;
      setExtractResult(ex);

      // Applique automatiquement ce qui peut l'être aux champs du calcul RP en dessous.
      if (ex.startingStackChips > 0) setKnownStartingStack(ex.startingStackChips);
      if (ex.buyInStaking > 0 && ex.startingStackChips > 0) {
        setChipValue(String(ex.buyInStaking / ex.startingStackChips));
      }
      const bb = parseBBFromLevelText(ex.currentLevel);
      if (ex.averageStackChips > 0 && bb > 0) {
        setAvgStackBB(String(Math.round((ex.averageStackChips / bb) * 10) / 10));
      }
    } catch (e) {
      setExtractError(e.message);
    } finally {
      setExtracting(false);
    }
  };

  const hrcRows = useMemo(() => {
    if (!hrcStats) return null;
    const avg = hrcStats.avgStackBB;
    const hero = hrcStats.players[heroIndex];
    if (!hero) return null;
    return hrcStats.players.map((p, i) => {
      if (i === heroIndex) return { ...p, isHero: true, seatLabel: `Siège ${i + 1}` };
      const rp = computeSeatRP({ villainStackBB: p.stackBB, villainBountyBB: p.koBB, heroStackBB: hero.stackBB, avgStackBB: avg, fieldLeftPct: fieldLeft });
      return { ...p, isHero: false, seatLabel: `Siège ${i + 1}`, rp };
    });
  }, [hrcStats, heroIndex, fieldLeft]);

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PkoRpIcon size={22} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>PKO — KO &amp; RP</span>
          <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Depuis une hand history ou un export HRC</span>
        </div>
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
      </div>

      <div style={{ background: "var(--panel)", border: "1px dashed var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Extraction depuis screenshots</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
          Screenshots des panneaux INFO / PAYOUT du client Winamax — la valeur du jeton et le stack moyen ci-dessous seront pré-remplis automatiquement.
        </div>
        <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} style={{ fontSize: 12, marginBottom: 10 }} />
        {shots.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {shots.map((s, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={s.previewUrl} alt="" style={{ height: 70, borderRadius: 6, border: "1px solid var(--border)" }} />
                <button onClick={() => removeShot(i)} style={{
                  position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%",
                  background: "#E0645A", color: "#fff", border: "none", fontSize: 11, cursor: "pointer", lineHeight: 1,
                }}>×</button>
              </div>
            ))}
          </div>
        )}
        <button onClick={handleExtract} disabled={extracting} style={{
          padding: "8px 16px", background: "var(--panel-2)", color: "var(--text)",
          border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, cursor: "pointer",
          opacity: extracting ? 0.6 : 1,
        }}>
          {extracting ? "Extraction…" : "Extraire"}
        </button>
        {extractError && <div style={{ fontSize: 12, color: "#E0645A", marginTop: 10 }}>{extractError}</div>}
        {extractResult && (
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginTop: 10 }}>
            ✓ {extractResult.tournamentName || "Structure"} — valeur du jeton
            {extractResult.buyInStaking > 0 && extractResult.startingStackChips > 0
              ? ` (${(extractResult.buyInStaking / extractResult.startingStackChips).toFixed(4)}€)` : ""}
            {" "}et stack moyen appliqués au formulaire ci-dessous.
          </div>
        )}
        {extractResult && (
          <pre style={{
            marginTop: 12, padding: 12, background: "var(--panel-2)", border: "1px solid var(--border)",
            borderRadius: 8, fontSize: 11, overflowX: "auto", fontFamily: "var(--font-ibm-plex-mono), monospace",
          }}>
            {JSON.stringify(extractResult, null, 2)}
          </pre>
        )}
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
          Hand history Winamax (texte complet) OU export JSON HRC — collé ici, le format est détecté automatiquement
        </div>
        <textarea
          value={input} onChange={(e) => setInput(e.target.value)} rows={6}
          style={{ ...inputStyle, fontFamily: "var(--font-ibm-plex-mono), monospace", marginBottom: 14 }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>% Field Left</label>
            <select value={fieldLeft} onChange={(e) => setFieldLeft(e.target.value === "TF" ? "TF" : Number(e.target.value))} style={inputStyle}>
              {FL_OPTIONS.map((v) => <option key={v} value={v}>{v === "TF" ? "Table finale" : `${v}%`}</option>)}
            </select>
          </div>
          {parsedType !== "hrc" && parsedType !== "sharkscope" && (
            <>
              <div>
                <label style={labelStyle}>Stack moyen (BB)</label>
                <input type="number" min={0} value={avgStackBB} onChange={(e) => setAvgStackBB(e.target.value)} style={inputStyle} placeholder="ex: 40" />
              </div>
              <div>
                <label style={labelStyle}>Valeur d&apos;un jeton (€)</label>
                <input type="number" min={0} step="0.0001" value={chipValue} onChange={(e) => setChipValue(e.target.value)} style={inputStyle} placeholder="ex: 0.0005" />
              </div>
            </>
          )}
          {parsedType === "hrc" && hrcStats && (
            <div>
              <label style={labelStyle}>Ton siège</label>
              <select value={heroIndex} onChange={(e) => setHeroIndex(Number(e.target.value))} style={inputStyle}>
                {hrcStats.players.map((_, i) => <option key={i} value={i}>Siège {i + 1}</option>)}
              </select>
            </div>
          )}
        </div>
        {parsedType !== "hrc" && parsedType !== "sharkscope" && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 14 }}>
            Format hand history texte : la valeur d&apos;un jeton et le stack moyen ne sont pas dans la HH — indique-les à la main
            {knownStartingStack > 0 ? ` (stack de départ connu : ${knownStartingStack} jetons, via un screenshot extrait plus haut).` : "."}
            {" "}Un export JSON HRC calcule tout automatiquement (structure de payout incluse).
          </div>
        )}
        {parsedType === "hrc" && hrcStats && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 14 }}>
            Export HRC détecté — {hrcStats.nbTotal} joueurs restants, {hrcStats.totalChips.toFixed(1)} jetons (BB) en jeu, {hrcStats.remainingTotalPrizes.toFixed(2)}€ de prizepool restant ({hrcStats.bountyType === "KO" ? "Mystery KO" : "PKO, facteur ×" + hrcStats.progressiveFactor}). Stack moyen et valeur des KO calculés automatiquement.
          </div>
        )}
        {parsedType === "sharkscope" && sharkscopeTournament && (
          <div style={{ background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--accent)" }}>
              Export SharkScope : {sharkscopeTournament.name}
            </div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              {sharkscopeTournament.totalEntrants} entrants + {sharkscopeTournament.reEntries} recaves · Guarantee {sharkscopeTournament.guarantee}€ · Prizepool réel {sharkscopeTournament.prizePool}€ · Buy-in {sharkscopeTournament.stake}€ + {sharkscopeTournament.rake}€ rake · {sharkscopeTournament.payoutTable.length} places payées
              <br />
              {knownStartingStack > 0
                ? `Valeur du jeton appliquée automatiquement (stack de départ ${knownStartingStack} connu via un screenshot).`
                : "Extrait d'abord un screenshot du panneau INFO (ci-dessus) pour connaître le stack de départ et calculer la valeur du jeton."}
              {" "}Colle ensuite une hand history de ce tournoi pour obtenir la grille RP — cet export ne contient pas les stacks des joueurs, seulement la structure de payout réelle.
            </div>
          </div>
        )}

        <button onClick={handleAnalyze} style={{
          padding: "9px 18px", background: "var(--accent-gradient)", color: "#0B1210",
          border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}>
          Analyser
        </button>

        {error && <div style={{ fontSize: 12, color: "#E0645A", marginTop: 12 }}>{error}</div>}
      </div>

      {(winamaxRows || hrcRows) && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11 }}>
                <th style={{ padding: "6px 8px" }}>Siège</th>
                <th style={{ padding: "6px 8px" }}>Stack (BB)</th>
                <th style={{ padding: "6px 8px" }}>Bounty (€)</th>
                <th style={{ padding: "6px 8px" }}>Bounty (BB)</th>
                <th style={{ padding: "6px 8px" }}>KO/Stack</th>
                <th style={{ padding: "6px 8px" }}>Bonus RP</th>
                <th style={{ padding: "6px 8px" }}>RP de base</th>
                <th style={{ padding: "6px 8px" }}>ChipLead adv.</th>
                <th style={{ padding: "6px 8px" }}>RP TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {(winamaxRows || hrcRows).map((r, i) => {
                const label = parsedType === "hrc" ? r.seatLabel : r.position;
                const stackBB = parsedType === "hrc" ? r.stackBB.toFixed(1) : r.stackBB;
                const bountyBB = parsedType === "hrc" ? r.koBB : r.bountyBB;
                const bountyEuro = r.bountyEuro;
                return (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)", background: r.isHero ? "rgba(52,211,153,0.06)" : "transparent" }}>
                    <td style={{ padding: "8px" }}>{label}{r.isHero ? " (Héros)" : ""}</td>
                    <td style={{ padding: "8px", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{stackBB || "—"}</td>
                    <td style={{ padding: "8px", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{bountyEuro ? `${bountyEuro}€` : "—"}</td>
                    <td style={{ padding: "8px", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{bountyBB != null ? bountyBB.toFixed(1) : "—"}</td>
                    {r.isHero ? (
                      <td colSpan={5} style={{ padding: "8px", color: "var(--text-muted)" }}>— référence —</td>
                    ) : (
                      <>
                        <td style={{ padding: "8px", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{r.rp?.ratio != null ? r.rp.ratio.toFixed(2) : "—"}</td>
                        <td style={{ padding: "8px", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{r.rp ? pct(r.rp.bonus) : "—"}</td>
                        <td style={{ padding: "8px", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{r.rp ? pct(r.rp.base) : "—"} <span style={{ color: "var(--text-muted)" }}>({r.rp?.category || "—"})</span></td>
                        <td style={{ padding: "8px", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{r.rp ? pct(r.rp.clAdvantage) : "—"} <span style={{ color: "var(--text-muted)" }}>({r.rp?.clCategory || "—"})</span></td>
                        <td style={{ padding: "8px", fontFamily: "var(--font-ibm-plex-mono), monospace", fontWeight: 700, color: "var(--accent)" }}>{r.rp ? pct(r.rp.total) : "—"}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
