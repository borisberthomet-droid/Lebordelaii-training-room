import Link from "next/link";
import { computeAnswer } from "@/lib/poker/potOdds";
import { BONUS_RP_THRESHOLDS, BONUS_RP_VALUES, RP_BASE_TABLE, CHIPLEAD_TABLE } from "@/lib/poker/rpFromHH";
import PageHeader from "@/components/PageHeader";
import Section from "@/components/Section";

const BET_SIZES = [25, 33, 40, 50, 66, 75, 80, 100, 125, 150, 200];

const th = { padding: "6px 10px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600 };
const td = { padding: "6px 10px", fontSize: 12, fontFamily: "var(--font-ibm-plex-mono), monospace", borderTop: "1px solid var(--border)" };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const pct = (v) => `${v.toFixed(1)}%`;

export default function MemoPage() {
  const rows = BET_SIZES.map((betPct) => {
    const spot = { pot: 100, bet: betPct };
    return {
      betPct,
      callEquity: computeAnswer({ ...spot, questionType: "call_equity" }),
      bluffFoldEquity: computeAnswer({ ...spot, questionType: "bluff_fold_equity" }),
      valueBetEquity: computeAnswer({ ...spot, questionType: "value_bet_equity" }),
    };
  });

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <PageHeader subtitle="Mémo — Tableaux de référence" />

      <Section title="Pot odds & fréquences théoriques (par % de pot misé)">
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
          Le ratio de bluff théorique optimal (% de bluffs dans une range de mise polarisée) est identique à l&apos;équité requise pour call — même équation vue des deux côtés.
          La fréquence de fold minimale (MDF, à droite) est le complément de la fold equity requise pour un bluff isolé.
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>% Pot misé</th>
                <th style={th}>Équité pour call<br />(= ratio de bluff)</th>
                <th style={th}>Fold equity requise<br />(bluff isolé)</th>
                <th style={th}>MDF<br />(défense minimale)</th>
                <th style={th}>Équité min. pour value bet<br />(vs range totale à MDF)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.betPct}>
                  <td style={{ ...td, fontWeight: 700 }}>{r.betPct}%</td>
                  <td style={td}>{pct(r.callEquity)}</td>
                  <td style={td}>{pct(r.bluffFoldEquity)}</td>
                  <td style={td}>{pct(100 - r.bluffFoldEquity)}</td>
                  <td style={{ ...td, color: "var(--accent)" }}>{pct(r.valueBetEquity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Bonus RP — ratio KO/Stack du vilain">
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
          Bounty du vilain ÷ son propre stack (même unité) → Bonus RP. Le seuil dépassé donne le palier SUIVANT, pas le palier atteint (ex: ratio 0.35 → -8%, pas -7%).
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {BONUS_RP_THRESHOLDS.map((t) => <th key={t} style={th}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                {BONUS_RP_VALUES.map((v, i) => (
                  <td key={i} style={{ ...td, color: "var(--accent)" }}>{(v * 100).toFixed(1)}%</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <Section title="RP de base — stack du vilain vs moyenne">
          <table style={tableStyle}>
            <thead>
              <tr><th style={th}>% Field Left</th><th style={th}>Bas (&lt;0.75×)</th><th style={th}>Moyen</th><th style={th}>Élevé (&gt;1.25×)</th></tr>
            </thead>
            <tbody>
              {Object.entries(RP_BASE_TABLE).map(([fl, row]) => (
                <tr key={fl}>
                  <td style={{ ...td, fontWeight: 700 }}>{fl}%</td>
                  <td style={td}>{(row.Bas * 100).toFixed(1)}%</td>
                  <td style={td}>{(row.Moyen * 100).toFixed(1)}%</td>
                  <td style={td}>{(row.Eleve * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="ChipLead advantage — héros couvre le vilain">
          <table style={tableStyle}>
            <thead>
              <tr><th style={th}>% Field Left</th><th style={th}>Moyen (≥1.5×)</th><th style={th}>Gros (≥3×)</th><th style={th}>Huge (≥5×)</th></tr>
            </thead>
            <tbody>
              {Object.entries(CHIPLEAD_TABLE).map(([fl, row]) => (
                <tr key={fl}>
                  <td style={{ ...td, fontWeight: 700 }}>{fl}%</td>
                  <td style={td}>{(row.Moyen * 100).toFixed(1)}%</td>
                  <td style={td}>{(row.Gros * 100).toFixed(1)}%</td>
                  <td style={td}>{(row.Huge * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
        RP TOTAL = Bonus RP + RP de base + ChipLead advantage. Ces trois tables n&apos;ont pas de côté &quot;vilain couvre héros&quot; dans les données source — un héros couvert a un RP calculé via l&apos;ICM réel dans <Link href="/pko-rp/trainer" style={{ color: "var(--accent)" }}>le RP Trainer</Link>, pas via ces tables.
      </div>
    </div>
  );
}
