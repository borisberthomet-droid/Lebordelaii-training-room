"use client";

import { useState } from "react";
import Link from "next/link";
import {
  POT_ODDS_ROWS, potOddsRow, bluffCombosFor,
  ELASTICITY_LEVELS, ELASTICITY_RP_STEPS, rangeMultiplier,
  RP_MAX_BY_KO_RATIO, KO_VALUE_BY_FIELD,
  riskPremiumFromRatio, RP_RATIO_STEPS, ALPHA_REFERENCE,
  CALL_THRESHOLD_OPEN_SHOVE, CALL_THRESHOLD_RESTEAL, VILLAIN_TIGHTENING,
} from "@/lib/poker/memoTables";
import { BONUS_RP_THRESHOLDS, BONUS_RP_VALUES, RP_BASE_TABLE, CHIPLEAD_TABLE } from "@/lib/poker/rpFromHH";
import PageHeader from "@/components/PageHeader";
import Section from "@/components/Section";

const th = { padding: "6px 10px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" };
const td = { padding: "6px 10px", fontSize: 12, fontFamily: "var(--font-ibm-plex-mono), monospace", borderTop: "1px solid var(--border)", whiteSpace: "nowrap" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const scroll = { overflowX: "auto" };
const note = { fontSize: 11, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 };
const inputStyle = {
  background: "var(--panel-2)", border: "1px solid var(--border)", color: "var(--text)",
  borderRadius: 8, padding: "7px 9px", fontSize: 13, width: 110,
  fontFamily: "var(--font-ibm-plex-mono), monospace",
};

const pc = (v, d = 1) => `${(v * 100).toFixed(d)}%`;

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "9px 20px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
      background: active ? "var(--accent-gradient)" : "var(--panel-2)",
      color: active ? "#0B1210" : "var(--text)",
      border: active ? "none" : "1px solid var(--border)",
    }}>{children}</button>
  );
}

function SubTitle({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", margin: "18px 0 8px" }}>{children}</div>;
}

// Petit graphe en ligne, sans dépendance : les données sont peu nombreuses et la forme
// compte plus que la précision de lecture (les valeurs exactes sont dans les tables à côté).
function LineChart({ series, xLabels, yMin, yMax, yFormat, height = 180 }) {
  // padR généreux : les labels de l'axe X sont centrés sur leur point, donc le dernier
  // déborde de la moitié de sa largeur s'il n'y a pas de marge (ex. "TF 3000" tronqué).
  const w = 520, h = height, padL = 44, padR = 34, padT = 10, padB = 26;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const n = xLabels.length;
  const xAt = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const ticks = [yMin, yMin + (yMax - yMin) / 2, yMax];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", maxWidth: w, height: "auto" }} role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={yAt(t)} x2={w - padR} y2={yAt(t)} stroke="var(--border)" strokeWidth="1" />
          <text x={padL - 6} y={yAt(t) + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{yFormat(t)}</text>
        </g>
      ))}
      {xLabels.map((lb, i) => (
        <text key={i} x={xAt(i)} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{lb}</text>
      ))}
      {series.map((s) => (
        <g key={s.label}>
          <polyline
            points={s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ")}
            fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          />
          {s.values.map((v, i) => <circle key={i} cx={xAt(i)} cy={yAt(v)} r="3.5" fill={s.color} />)}
        </g>
      ))}
    </svg>
  );
}

function Legend({ series }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 11, marginTop: 8 }}>
      {series.map((s) => (
        <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 3, borderRadius: 2, background: s.color, display: "inline-block" }} />
          <span style={{ color: "var(--text-muted)" }}>{s.label}</span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- POT ODDS

function PotOddsTab() {
  const [comboBetPct, setComboBetPct] = useState("66");
  const [comboValue, setComboValue] = useState("20");

  const bp = parseFloat(comboBetPct);
  const vc = parseFloat(comboValue);
  const comboOk = !isNaN(bp) && bp > 0 && !isNaN(vc) && vc > 0;
  const comboAlpha = comboOk ? potOddsRow(bp).alpha : null;
  const comboBluffs = comboOk ? bluffCombosFor(bp, vc) : null;

  return (
    <>
      <Section title="Table complète — par taille de mise">
        <div style={note}>
          Tout est calculé à partir de la mise (B) et du pot (P), donc valable pour n&apos;importe quel sizing, y compris ceux hors des tables classiques.
          Vérifié à l&apos;identique contre les tableaux de référence sur 33 / 50 / 70 / 100 / 150%.
        </div>
        <div style={scroll}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>Bet size</th>
                <th style={th}>Cote<br /><span style={{ fontWeight: 400 }}>(P+B)/B</span></th>
                <th style={th}>Équité nécessaire<br /><span style={{ fontWeight: 400 }}>B/(P+2B)</span></th>
                <th style={th}>MDF<br /><span style={{ fontWeight: 400 }}>P/(P+B)</span></th>
                <th style={th}>MFF<br /><span style={{ fontWeight: 400 }}>B/(P+B)</span></th>
                <th style={th}>Équité min. value bet<br /><span style={{ fontWeight: 400 }}>1−(MDF/2)</span></th>
                <th style={th}>Alpha<br /><span style={{ fontWeight: 400 }}>bluffs / value</span></th>
              </tr>
            </thead>
            <tbody>
              {POT_ODDS_ROWS.map((r) => (
                <tr key={r.betPct}>
                  <td style={{ ...td, fontWeight: 700 }}>{r.betPct}%</td>
                  <td style={{ ...td, color: "#E0645A" }}>{r.cote.toFixed(1)}:1</td>
                  <td style={{ ...td, color: "#E8C547" }}>{pc(r.callEquity, 1)}</td>
                  <td style={{ ...td, color: "#6FCF97" }}>{pc(r.mdf, 1)}</td>
                  <td style={{ ...td, color: "#E89A47" }}>{pc(r.mff, 1)}</td>
                  <td style={{ ...td, color: "#4FA8E0" }}>{pc(r.valueBetEquity, 1)}</td>
                  <td style={{ ...td, color: "var(--accent)", fontWeight: 700 }}>{r.alpha.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ ...note, marginTop: 12, marginBottom: 0 }}>
          <strong style={{ color: "var(--text)" }}>Alpha ≠ équité nécessaire.</strong> Alpha = bluffs <em>par combo de value</em> (ratio bluff:value) ;
          l&apos;équité nécessaire = part des bluffs <em>dans toute la range de mise</em> (bluffs/(value+bluffs)). Ex. en bet pot : alpha 0.50 (1 bluff pour 2 value) = 33% de bluffs dans la range.
        </div>
      </Section>

      <Section title="Calcul en combos">
        <div style={note}>
          Combos de bluff = combos de value × alpha. Marche dans les deux sens : construire ta propre range, ou vérifier si celle du vilain est équilibrée.
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Bet size (% du pot)</label>
            <input value={comboBetPct} onChange={(e) => setComboBetPct(e.target.value)} style={inputStyle} inputMode="decimal" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Combos de value</label>
            <input value={comboValue} onChange={(e) => setComboValue(e.target.value)} style={inputStyle} inputMode="decimal" />
          </div>
        </div>
        {comboOk && (
          <div style={{ background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)", marginBottom: 6, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
              {comboBluffs.toFixed(1)} combos de bluff
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
              alpha = {bp}/(100+{bp}) = {comboAlpha.toFixed(3)} · {vc} × {comboAlpha.toFixed(3)} = {comboBluffs.toFixed(1)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
              Range totale : {vc} value + {comboBluffs.toFixed(1)} bluffs = {(vc + comboBluffs).toFixed(1)} combos, soit {pc(comboBluffs / (vc + comboBluffs), 1)} de bluffs.
            </div>
          </div>
        )}
      </Section>
    </>
  );
}

// -------------------------------------------------------------------- PKO

function PkoTab() {
  const elasticitySeries = ELASTICITY_LEVELS.map((l) => ({
    label: `Niv. ${l.level} (k=${l.k}) — ${l.label}`,
    color: l.color,
    values: ELASTICITY_RP_STEPS.map((rp) => rangeMultiplier(l.k, rp)),
  }));

  const koSeries = [{
    label: "Valeur du KO (starting stacks)",
    color: "#E8C547",
    values: KO_VALUE_BY_FIELD.map((d) => d.value),
  }];

  const rpMaxSeries = [{
    label: "RP Max en table finale",
    color: "#E8C547",
    values: RP_MAX_BY_KO_RATIO.map((d) => d.rpMax),
  }];

  const rpCurveSeries = [{
    label: "RP = −19% × ln(1 + 1.31r)",
    color: "#E8C547",
    values: RP_RATIO_STEPS.map((r) => riskPremiumFromRatio(r)),
  }];

  return (
    <>
      <Section title="Élasticité — multiplicateur de range selon le Risk Premium">
        <div style={note}>
          M = e<sup>k × |RP|</sup>. Le niveau k dépend du type de spot. Ex. RP −15% en niveau 3 (k=4.0) → range ×{rangeMultiplier(4, 0.15).toFixed(2)}.
        </div>
        <div style={scroll}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>Niveau</th>
                <th style={th}>k</th>
                <th style={th}>Type de spot</th>
                {ELASTICITY_RP_STEPS.map((rp) => <th key={rp} style={th}>RP −{(rp * 100).toFixed(0)}%</th>)}
              </tr>
            </thead>
            <tbody>
              {ELASTICITY_LEVELS.map((l) => (
                <tr key={l.level}>
                  <td style={{ ...td, fontWeight: 700, color: l.color }}>{l.level}</td>
                  <td style={td}>{l.k}</td>
                  <td style={{ ...td, fontFamily: "inherit", color: "var(--text-muted)" }}>{l.label}</td>
                  {ELASTICITY_RP_STEPS.map((rp) => (
                    <td key={rp} style={td}>×{rangeMultiplier(l.k, rp).toFixed(2)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14 }}>
          <LineChart
            series={elasticitySeries}
            xLabels={ELASTICITY_RP_STEPS.map((rp) => `−${(rp * 100).toFixed(0)}%`)}
            yMin={1} yMax={5.5} yFormat={(v) => `×${v.toFixed(1)}`}
          />
          <Legend series={elasticitySeries} />
        </div>
      </Section>

      <Section title="RP Max en table finale — selon le poids du pool KO">
        <div style={note}>
          Ratio = Σ primes sur les têtes ÷ payouts restants. <strong style={{ color: "var(--text)" }}>Se lit en direct, ne se déduit pas du format</strong> :
          un PKO 50/50 démarre à 100% mais arrive en TF vers 27–50%, le pool KO fondant plus vite que le régulier.
          Plus le pool KO pèse, plus il comprime la pression ICM. RP Max le plus élevé : face au joueur qui te couvre.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, alignItems: "start" }}>
          <div style={scroll}>
            <table style={tableStyle}>
              <thead>
                <tr><th style={th}>Ratio KO / régulier</th><th style={th}>RP Max</th></tr>
              </thead>
              <tbody>
                {RP_MAX_BY_KO_RATIO.map((d) => (
                  <tr key={d.ratio}>
                    <td style={{ ...td, fontWeight: d.highlight ? 700 : 400 }}>
                      {d.ratio}%{d.note ? <span style={{ color: "var(--text-muted)" }}> ({d.note})</span> : ""}
                    </td>
                    <td style={{ ...td, color: "var(--accent)", fontWeight: d.highlight ? 700 : 400 }}>{d.rpMax}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <LineChart
              series={rpMaxSeries}
              xLabels={RP_MAX_BY_KO_RATIO.map((d) => `${d.ratio}%`)}
              yMin={0} yMax={21} yFormat={(v) => `${v.toFixed(0)}%`}
            />
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
              Zone typique d&apos;une TF de PKO : ratio 30–50%.
            </div>
          </div>
        </div>
      </Section>

      <Section title="Valeur d'un KO selon la taille du field en table finale">
        <div style={note}>
          Valeur encaissable d&apos;un KO de base, en starting stacks. Courbe universelle : identique quel que soit le nombre d&apos;inscrits, seule la position de la TF change.
          La valeur explose en fin de tournoi.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, alignItems: "start" }}>
          <table style={tableStyle}>
            <thead>
              <tr><th style={th}>Field en TF</th><th style={th}>Valeur (starting stacks)</th><th style={th}>≈ jetons</th></tr>
            </thead>
            <tbody>
              {KO_VALUE_BY_FIELD.map((d) => (
                <tr key={d.field}>
                  <td style={{ ...td, fontWeight: 700 }}>{d.field}</td>
                  <td style={{ ...td, color: "var(--accent)" }}>{d.value.toFixed(3)}</td>
                  <td style={td}>{d.chips.toLocaleString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <LineChart
              series={koSeries}
              xLabels={KO_VALUE_BY_FIELD.map((d) => `TF ${d.field}`)}
              yMin={0.3} yMax={1.05} yFormat={(v) => v.toFixed(2)}
            />
          </div>
        </div>
      </Section>

      <Section title="Seuils de call selon la valeur du KO">
        <div style={note}>
          Équité requise pour caller, sans KO puis avec un KO de 10 BB (KO de base à mi-tournoi).
          Plus le shove est deep, moins le même KO pèse : il faut un gros KO pour bouger le seuil.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {[CALL_THRESHOLD_OPEN_SHOVE, CALL_THRESHOLD_RESTEAL].map((t) => (
            <div key={t.title}>
              <SubTitle>{t.title}</SubTitle>
              <table style={tableStyle}>
                <thead>
                  <tr><th style={th}>Spot</th><th style={th}>Sans KO</th><th style={th}>KO 10 BB</th><th style={th}>Δ</th></tr>
                </thead>
                <tbody>
                  {t.rows.map((r) => (
                    <tr key={r.spot}>
                      <td style={{ ...td, fontFamily: "inherit" }}>{r.spot}</td>
                      <td style={td}>{r.noKo}%</td>
                      <td style={{ ...td, color: "var(--accent)" }}>{r.atKo10}%</td>
                      <td style={{ ...td, color: "#E89A47" }}>−{(r.noKo - r.atKo10).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Resserrement du vilain qui porte des bounties">
        <div style={note}>
          Range d&apos;agression du vilain selon le nombre de primes sur sa tête. Il sait qu&apos;il sera callé plus large, donc il s&apos;engage plus fort.
          L&apos;effet grandit avec la profondeur : il a plus à protéger.
        </div>
        <div style={scroll}>
          <table style={tableStyle}>
            <thead>
              <tr><th style={th}>Spot</th><th style={th}>0 KO</th><th style={th}>1 KO</th><th style={th}>2 KO</th><th style={th}>3 KO</th><th style={th}>Effet relatif / KO</th></tr>
            </thead>
            <tbody>
              {VILLAIN_TIGHTENING.map((v) => {
                const at = (ko) => v.points.find((p) => p.ko === ko);
                return (
                  <tr key={v.spot}>
                    <td style={{ ...td, fontFamily: "inherit", fontWeight: 700 }}>{v.spot}</td>
                    {[0, 1, 2, 3].map((ko) => {
                      const p = at(ko);
                      return <td key={ko} style={td}>{p ? `${p.pct}%` : "—"}</td>;
                    })}
                    <td style={{ ...td, color: "#E89A47" }}>{v.relative}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="La chaîne de calcul">
        <div style={{
          background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14,
          fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 12, lineHeight: 2, marginBottom: 12,
        }}>
          <div><span style={{ color: "var(--text-muted)" }}>1.</span> valeur du KO (BB) = N_KO × α(FL) × starting stack (BB actuels)</div>
          <div><span style={{ color: "var(--text-muted)" }}>2.</span> r = valeur du KO / stack du vilain</div>
          <div><span style={{ color: "var(--text-muted)" }}>3.</span> RP = −19% × ln(1 + 1.31 × r)</div>
          <div><span style={{ color: "var(--text-muted)" }}>4.</span> M = e<sup>k × |RP|</sup></div>
        </div>
        <div style={{ ...note, marginBottom: 0 }}>
          N_KO = bounty du vilain ÷ bounty initiale du tournoi. Starting stack en BB actuels ≈ average de la table × field restant.
          <br /><strong style={{ color: "var(--text)" }}>Zone de validité : 100% → ~30% field restant (hors ICM).</strong> En dessous, la pression ICM
          s&apos;ajoute et il faut le calcul exact (<Link href="/pko-rp/trainer" style={{ color: "var(--accent)" }}>RP Trainer</Link>).
        </div>
      </Section>

      <Section title="Étape 1 — α(FL) : valeur d'un KO de base">
        <div style={note}>
          Fraction du starting stack qu&apos;un KO de base rapporte, selon le % de field restant.
          <strong style={{ color: "var(--text)" }}> α est universel</strong> : identique de 100 à 3000 inscrits, seule la structure du tournoi le change.
          Il monte au fil du tournoi parce que le prizepool restant fond (les moitiés de primes encaissées sortent) alors que les jetons en circulation restent constants.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, alignItems: "start" }}>
          <table style={tableStyle}>
            <thead>
              <tr><th style={th}>Field restant</th><th style={th}>α (encaissable)</th></tr>
            </thead>
            <tbody>
              {ALPHA_REFERENCE.map((d) => (
                <tr key={d.fl}>
                  <td style={{ ...td, fontWeight: d.shortcut ? 700 : 400 }}>
                    {d.fl}%{d.limit ? <span style={{ color: "#E89A47" }}> ← limite hors-ICM</span> : ""}
                  </td>
                  <td style={{
                    ...td, fontWeight: d.shortcut ? 700 : 400,
                    color: d.postItm ? "var(--text-muted)" : "var(--accent)",
                  }}>
                    {d.alpha.toFixed(2)}{d.postItm ? " *" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <div style={{
              background: "var(--panel-2)", border: "1px solid var(--accent)", borderRadius: 10,
              padding: 14, fontSize: 13, marginBottom: 12,
            }}>
              <strong style={{ color: "var(--accent)" }}>Raccourci in-game</strong><br />
              <span style={{ color: "var(--text-muted)" }}>À mi-tournoi, 1 KO de base ≈ <strong style={{ color: "var(--text)" }}>0.3 × starting stack</strong>.</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
              <strong style={{ color: "#E89A47" }}>*</strong> Sous ~20% FL, ces valeurs viennent du calcul observable, pas du générateur :
              une fois l&apos;ITM passée, une partie des payouts est déjà versée, le pool restant est plus petit,
              donc le KO vaut <em>encore plus</em>. Le générateur suppose le prizepool régulier intact et sous-estime
              (0.41 au lieu de 0.43 à 10% FL, 0.48 au lieu de 0.60 à 3%).
            </div>
          </div>
        </div>
      </Section>

      <Section title="Étape 3 — Du ratio bounty au Risk Premium">
        <div style={note}>
          <strong style={{ color: "var(--text)" }}>RP = −19% × ln(1 + 1.31 × r)</strong>, validée sur 6 spots solver de r=0.29 à r=2.38.
          La relation est logarithmique : elle se tasse quand r monte. À r=238%, une extrapolation linéaire prédirait −38%, le solveur donne −27%.
          <strong style={{ color: "var(--text)" }}> Ne jamais linéariser.</strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, alignItems: "start" }}>
          <table style={tableStyle}>
            <thead>
              <tr><th style={th}>r = KO / stack vilain</th><th style={th}>Risk Premium</th></tr>
            </thead>
            <tbody>
              {RP_RATIO_STEPS.map((r) => (
                <tr key={r}>
                  <td style={{ ...td, fontWeight: 700 }}>{(r * 100).toFixed(0)}%</td>
                  <td style={{ ...td, color: "var(--accent)" }}>{riskPremiumFromRatio(r).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <LineChart
              series={rpCurveSeries}
              xLabels={RP_RATIO_STEPS.map((r) => `${(r * 100).toFixed(0)}%`)}
              yMin={-32} yMax={0} yFormat={(v) => `${v.toFixed(0)}%`}
            />
          </div>
        </div>
      </Section>

      <Section title="Les deux régimes de décision">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <div>
            <SubTitle>Régime 1 — tu clôtures l&apos;action</SubTitle>
            <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Dernier à parler, ex. BB face à un jam.
              <div style={{
                background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 8,
                padding: 10, margin: "8px 0", fontFamily: "var(--font-ibm-plex-mono), monospace",
                fontSize: 12, color: "var(--accent)",
              }}>
                seuil = à payer / (pot final + KO en BB)
              </div>
              Pas de RP, pas de coefficient. <strong style={{ color: "var(--text)" }}>Le malus « couvert » n&apos;existe pas ici</strong> —
              même couvert par toute la table, le calcul est le même. Les dilatations peuvent être énormes (×4 et plus).
            </div>
          </div>
          <div>
            <SubTitle>Régime 2 — des joueurs restent à parler</SubTitle>
            <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Ex. BTN face à un jam, avec SB/BB derrière. Chaîne complète r → RP → M.
              <div style={{
                background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 8,
                padding: 10, margin: "8px 0", fontFamily: "var(--font-ibm-plex-mono), monospace",
                fontSize: 12, color: "var(--accent)",
              }}>
                tu couvres tout le monde derrière → RP − 5 pts
              </div>
              Le RP de la formule correspond au cas « couvert par des joueurs derrière ».
              Le vrai coût d&apos;être couvert n&apos;est pas le stack, c&apos;est le <strong style={{ color: "var(--text)" }}>risque d&apos;isolation</strong>.
            </div>
          </div>
        </div>
        <SubTitle>Pattern : l&apos;inversion call → shove</SubTitle>
        <div style={note}>
          Quand hero est couvert, la dilatation part en iso-shove, pas en call (5 réplications indépendantes).
          Le flat invite les stacks derrière à voler le KO ou à isoler ; le shove verrouille la capture en heads-up.
        </div>
        <table style={{ ...tableStyle, maxWidth: 360 }}>
          <thead>
            <tr><th style={th}>Bounty vilain</th><th style={th}>Call</th><th style={th}>Iso-shove</th></tr>
          </thead>
          <tbody>
            <tr><td style={{ ...td, fontWeight: 700 }}>1 KO</td><td style={td}>16.3%</td><td style={td}>3.5%</td></tr>
            <tr><td style={{ ...td, fontWeight: 700 }}>3 KO</td><td style={{ ...td, color: "var(--text-muted)" }}>4.8%</td><td style={{ ...td, color: "var(--accent)", fontWeight: 700 }}>28.7%</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Tables RP — méthode par paliers">
        <SubTitle>Bonus RP — ratio KO/Stack du vilain</SubTitle>
        <div style={note}>
          Bounty du vilain ÷ son propre stack. Le seuil dépassé donne le palier SUIVANT, pas le palier atteint (ex. ratio 0.35 → −8%, pas −7%).
        </div>
        <div style={scroll}>
          <table style={tableStyle}>
            <thead>
              <tr>{BONUS_RP_THRESHOLDS.map((t) => <th key={t} style={th}>{t}</th>)}</tr>
            </thead>
            <tbody>
              <tr>{BONUS_RP_VALUES.map((v, i) => <td key={i} style={{ ...td, color: "var(--accent)" }}>{(v * 100).toFixed(1)}%</td>)}</tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginTop: 8 }}>
          <div>
            <SubTitle>RP de base — stack du vilain vs moyenne</SubTitle>
            <table style={tableStyle}>
              <thead>
                <tr><th style={th}>% FL</th><th style={th}>Bas (&lt;0.75×)</th><th style={th}>Moyen</th><th style={th}>Élevé (&gt;1.25×)</th></tr>
              </thead>
              <tbody>
                {Object.entries(RP_BASE_TABLE).map(([fl, row]) => (
                  <tr key={fl}>
                    <td style={{ ...td, fontWeight: 700 }}>{fl}%</td>
                    <td style={td}>{pc(row.Bas)}</td>
                    <td style={td}>{pc(row.Moyen)}</td>
                    <td style={td}>{pc(row.Eleve)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <SubTitle>ChipLead advantage — héros couvre le vilain</SubTitle>
            <table style={tableStyle}>
              <thead>
                <tr><th style={th}>% FL</th><th style={th}>Moyen (≥1.5×)</th><th style={th}>Gros (≥3×)</th><th style={th}>Huge (≥5×)</th></tr>
              </thead>
              <tbody>
                {Object.entries(CHIPLEAD_TABLE).map(([fl, row]) => (
                  <tr key={fl}>
                    <td style={{ ...td, fontWeight: 700 }}>{fl}%</td>
                    <td style={td}>{pc(row.Moyen)}</td>
                    <td style={td}>{pc(row.Gros)}</td>
                    <td style={td}>{pc(row.Huge)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...note, marginTop: 14, marginBottom: 0 }}>
          RP TOTAL = Bonus RP + RP de base + ChipLead advantage. Ces trois tables n&apos;ont pas de côté &quot;vilain couvre héros&quot; :
          un héros couvert a un RP positif, calculé via l&apos;ICM réel dans <Link href="/pko-rp/trainer" style={{ color: "var(--accent)" }}>le RP Trainer</Link>, pas via ces paliers.
        </div>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------- PAGE

export default function MemoPage() {
  const [tab, setTab] = useState("potodds");

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <PageHeader subtitle="Mémo — Tableaux de référence" />

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <TabButton active={tab === "potodds"} onClick={() => setTab("potodds")}>Pot Odds</TabButton>
        <TabButton active={tab === "pko"} onClick={() => setTab("pko")}>PKO</TabButton>
      </div>

      {tab === "potodds" ? <PotOddsTab /> : <PkoTab />}
    </div>
  );
}
