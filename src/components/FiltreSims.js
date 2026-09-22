"use client";

import { libelleSim, TOUTES } from "@/lib/useSolvedSims";

// Les deux menus qui choisissent sur quoi l'élève s'entraîne, identiques dans les quatre
// exercices : le scénario (l'arbre du solveur) puis la texture (le board).
//
// Le menu des scénarios reste caché tant qu'il n'y en a qu'un — proposer un choix qui n'en est
// pas encombre la page. `compte` dit quel nombre de spots afficher : chaque exercice n'utilise
// pas les mêmes nœuds d'une même texture.

const selectStyle = {
  width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
};
const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 };

export default function FiltreSims({ etat, compte, onReset }) {
  const { sims, sim, setSim, scenarios, scenario, setScenario } = etat;
  if (!sims || !sims.length) return null;
  const total = sims.reduce((a, s) => a + (compte(s) || 0), 0);

  return (
    <div style={{ marginBottom: 12, display: "grid", gap: 10 }}>
      {scenarios.length > 1 && (
        <div>
          <label style={labelStyle}>Scénario</label>
          <select
            value={scenario}
            onChange={(e) => { setScenario(e.target.value); setSim(TOUTES); onReset?.(); }}
            style={selectStyle}
          >
            <option value={TOUTES}>Tous les scénarios</option>
            {scenarios.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      <div>
        <label style={labelStyle}>Texture</label>
        <select
          value={sim}
          onChange={(e) => { setSim(e.target.value); onReset?.(); }}
          style={selectStyle}
        >
          <option value={TOUTES}>
            Toutes les textures — {sims.length} boards, {total} spots
          </option>
          {sims.map((s) => <option key={s.name} value={s.name}>{libelleSim(s, compte(s))}</option>)}
        </select>
      </div>
    </div>
  );
}
