"use client";

import { ACCENT, ACCENT_RGB } from "@/lib/poker/constants";

// Étoile de compétences. Un axe non mesuré est tracé en pointillés et tiré à zéro : l'absence de
// donnée ne doit pas ressembler à une note basse, ni à une note.

const R = 96;
const CX = 160;
const CY = 152;
const RINGS = [25, 50, 75, 100];

function point(i, n, value) {
  const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
  const r = (R * Math.max(0, Math.min(100, value))) / 100;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

function polygon(values, n) {
  return values.map((v, i) => point(i, n, v).join(",")).join(" ");
}

export default function SkillRadar({ axes }) {
  const n = axes.length;
  const values = axes.map((a) => (a.measured && a.score != null ? a.score : 0));

  return (
    <svg viewBox="0 0 320 300" style={{ width: "100%", maxWidth: 360, display: "block", margin: "0 auto" }}>
      {/* Toile de fond : anneaux et rayons */}
      {RINGS.map((ring) => (
        <polygon key={ring} points={polygon(axes.map(() => ring), n)}
          fill="none" stroke="var(--border)" strokeWidth="1" />
      ))}
      {axes.map((a, i) => {
        const [x, y] = point(i, n, 100);
        return <line key={a.id} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />;
      })}
      {RINGS.slice(0, 3).map((ring) => {
        const [, y] = point(0, n, ring);
        return (
          <text key={ring} x={CX + 4} y={y + 3} fontSize="8" fill="var(--text-muted)"
            fontFamily="var(--font-ibm-plex-mono), monospace">{ring}</text>
        );
      })}

      {/* Surface des compétences */}
      <polygon points={polygon(values, n)}
        fill={`rgba(${ACCENT_RGB},0.22)`} stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" />

      {axes.map((a, i) => {
        const [x, y] = point(i, n, values[i]);
        const [lx, ly] = point(i, n, 128);
        const anchor = Math.abs(lx - CX) < 12 ? "middle" : lx > CX ? "start" : "end";
        const dim = !a.measured;
        return (
          <g key={a.id}>
            <circle cx={x} cy={y} r={dim ? 2 : 3.5}
              fill={dim ? "var(--border)" : ACCENT}
              stroke={dim ? "var(--border)" : ACCENT} strokeWidth="1" />
            <text x={lx} y={ly - 2} textAnchor={anchor} fontSize="10"
              fill={dim ? "var(--text-muted)" : "var(--text)"} fontWeight={dim ? 400 : 600}>
              {a.label}
            </text>
            <text x={lx} y={ly + 10} textAnchor={anchor} fontSize="9"
              fill={dim ? "var(--border)" : "var(--text-muted)"}
              fontFamily="var(--font-ibm-plex-mono), monospace">
              {a.measured && a.score != null ? a.score : "—"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
