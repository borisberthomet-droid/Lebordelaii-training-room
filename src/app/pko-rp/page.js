"use client";

import { useState } from "react";
import Link from "next/link";
import { parseWinamaxHH, buildHHReplay } from "@/lib/poker/hhParser";
import { computeSeatRP } from "@/lib/poker/rpFromHH";
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

export default function PkoRpPage() {
  const [hhText, setHhText] = useState("");
  const [avgStackBB, setAvgStackBB] = useState("");
  const [fieldLeft, setFieldLeft] = useState(50);
  const [chipValue, setChipValue] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  const handleAnalyze = () => {
    setError("");
    setRows(null);
    if (!hhText.trim()) { setError("Colle une hand history d'abord."); return; }
    const parsed = parseWinamaxHH(hhText);
    const bb = buildHHReplay(hhText).bb;
    if (!parsed.seatsBase?.length || !bb) {
      setError("Hand history non reconnue — vérifie qu'il s'agit bien d'un export Winamax complet.");
      return;
    }
    const hero = parsed.seatsBase.find((s) => s.role === "hero");
    if (!hero) {
      setError("Impossible d'identifier le héros dans cette main (pas de \"Dealt to\").");
      return;
    }
    const cv = parseFloat(chipValue);
    const avg = parseFloat(avgStackBB);
    const heroStackBB = hero.stackBB;

    const built = parsed.seatsBase.map((seat) => {
      const bountyEuro = parseBountyEuro(seat.bounty);
      const bountyBB = cv > 0 ? bountyEuro / (cv * bb) : null;
      if (seat.role === "hero") {
        return { ...seat, bountyEuro, bountyBB, isHero: true };
      }
      const rp = avg > 0 && bountyBB != null
        ? computeSeatRP({ villainStackBB: seat.stackBB, villainBountyBB: bountyBB, heroStackBB, avgStackBB: avg, fieldLeftPct: fieldLeft })
        : null;
      return { ...seat, bountyEuro, bountyBB, isHero: false, rp };
    });
    setRows(built);
  };

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PkoRpIcon size={22} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>PKO — KO &amp; RP</span>
          <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Depuis une hand history</span>
        </div>
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Hand history Winamax (texte complet)</div>
        <textarea
          value={hhText} onChange={(e) => setHhText(e.target.value)} rows={6}
          style={{ ...inputStyle, fontFamily: "var(--font-ibm-plex-mono), monospace", marginBottom: 14 }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Stack moyen (BB)</label>
            <input type="number" min={0} value={avgStackBB} onChange={(e) => setAvgStackBB(e.target.value)} style={inputStyle} placeholder="ex: 40" />
          </div>
          <div>
            <label style={labelStyle}>% Field Left</label>
            <select value={fieldLeft} onChange={(e) => setFieldLeft(e.target.value === "TF" ? "TF" : Number(e.target.value))} style={inputStyle}>
              {FL_OPTIONS.map((v) => <option key={v} value={v}>{v === "TF" ? "Table finale" : `${v}%`}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Valeur d&apos;un jeton (€)</label>
            <input type="number" min={0} step="0.0001" value={chipValue} onChange={(e) => setChipValue(e.target.value)} style={inputStyle} placeholder="ex: 0.0005" />
          </div>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 14 }}>
          La valeur d&apos;un jeton (prizepool restant ÷ total des jetons en jeu) n&apos;est pas dans la hand history — indique-la pour convertir les bounties € en BB. Sans elle, les ratios KO/stack et le RP ne peuvent pas être calculés (le tableau restera limité aux stacks).
        </div>

        <button onClick={handleAnalyze} style={{
          padding: "9px 18px", background: "var(--accent-gradient)", color: "#0B1210",
          border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}>
          Analyser
        </button>

        {error && <div style={{ fontSize: 12, color: "#E0645A", marginTop: 12 }}>{error}</div>}
      </div>

      {rows && (
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
              {rows.map((r) => (
                <tr key={r.position} style={{ borderTop: "1px solid var(--border)", background: r.isHero ? "rgba(52,211,153,0.06)" : "transparent" }}>
                  <td style={{ padding: "8px" }}>{r.position}{r.isHero ? " (Héros)" : ""}</td>
                  <td style={{ padding: "8px", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{r.stackBB || "—"}</td>
                  <td style={{ padding: "8px", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{r.bountyEuro ? `${r.bountyEuro}€` : "—"}</td>
                  <td style={{ padding: "8px", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{r.bountyBB != null ? r.bountyBB.toFixed(1) : "—"}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
