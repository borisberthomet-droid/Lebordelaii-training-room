"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  listRangeSpots, listRangeCategories, createRangeSpot, deleteRangeSpot, insertRangeAttempt,
} from "@/lib/supabase/rangeSpots";
import { parsePastedRange } from "@/lib/poker/rangeParser";
import { compareRanges } from "@/lib/poker/rangeCompare";
import { ALL_CLASSES, getClassCombos } from "@/lib/poker/combos";
import RangeGrid from "@/components/RangeGrid";
import { RangeBuilderIcon } from "@/components/ToolIcons";
import PageHeader from "@/components/PageHeader";
import Section from "@/components/Section";

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

// Grille 13x13 statique (lecture seule) — utilisée pour la référence et pour la vue diff, où
// aucune interaction n'est nécessaire (contrairement à RangeGrid, faite pour l'édition).
function StaticGrid({ cellStyle, cellLabel }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(13, 1fr)", gap: 2, maxWidth: 480 }}>
      {ALL_CLASSES.map((cls) => (
        <div key={cls} style={{
          aspectRatio: "1/1", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontFamily: "var(--font-ibm-plex-mono), monospace", ...cellStyle(cls),
        }} title={cellLabel ? cellLabel(cls) : cls}>
          {cls}
        </div>
      ))}
    </div>
  );
}

function referenceCellStyle(weights) {
  return (cls) => {
    const combos = getClassCombos(cls);
    const avg = combos.reduce((s, { key }) => s + (weights[key] || 0), 0) / combos.length;
    return {
      background: avg <= 0 ? "var(--panel-2)" : `rgba(52,211,153,${0.08 + avg * 0.6})`,
      border: "1px solid var(--border)", color: avg > 0.4 ? "#fff" : "var(--text-muted)",
    };
  };
}

// diff > 0 : l'élève a plus bet que la référence sur cette classe (rouge) ; diff < 0 : moins (bleu).
function diffCellStyle(perClass) {
  return (cls) => {
    const { diff, absDiff } = perClass[cls];
    if (absDiff < 0.02) return { background: "var(--panel-2)", border: "1px solid var(--border)", color: "var(--text-muted)" };
    const rgb = diff > 0 ? "224,101,90" : "79,168,224";
    return { background: `rgba(${rgb},${0.15 + Math.min(absDiff, 1) * 0.7})`, border: "1px solid var(--border)", color: "#fff" };
  };
}

export default function RangeBuilderPage() {
  const [authState, setAuthState] = useState("checking"); // checking | denied | ok
  const [isAdmin, setIsAdmin] = useState(false);

  const [spots, setSpots] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingSpots, setLoadingSpots] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("Toutes");
  const [selectedSpotId, setSelectedSpotId] = useState("");

  const [studentWeights, setStudentWeights] = useState({});
  const [result, setResult] = useState(null);

  // --- création de spot (admin) ---
  const [newCategory, setNewCategory] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [refWeights, setRefWeights] = useState({});
  const [refPasteText, setRefPasteText] = useState("");
  const [refPasteMinWeight, setRefPasteMinWeight] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const refresh = async () => {
    setLoadingSpots(true);
    try {
      const [s, c] = await Promise.all([listRangeSpots(), listRangeCategories()]);
      setSpots(s);
      setCategories(c);
    } finally {
      setLoadingSpots(false);
    }
  };

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthState("denied"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setIsAdmin(profile?.role === "admin");
      setAuthState("ok");
      await refresh();
    })();
  }, []);

  const filteredSpots = useMemo(
    () => (categoryFilter === "Toutes" ? spots : spots.filter((s) => s.category === categoryFilter)),
    [spots, categoryFilter]
  );

  const selectedSpot = spots.find((s) => s.id === selectedSpotId) || null;

  const selectSpot = (id) => {
    setSelectedSpotId(id);
    setStudentWeights({});
    setResult(null);
  };

  const handleCompare = async () => {
    if (!selectedSpot) return;
    const r = compareRanges(studentWeights, selectedSpot.referenceWeights);
    setResult(r);
    try {
      await insertRangeAttempt({ spotId: selectedSpot.id, studentWeights, accuracy: r.accuracy });
    } catch (e) {
      console.error("insertRangeAttempt", e);
    }
  };

  const applyRefPaste = () => {
    const minWeight = parseFloat(refPasteMinWeight) || 0;
    const parsed = parsePastedRange(refPasteText, minWeight);
    setRefWeights((prev) => ({ ...prev, ...parsed }));
  };

  const handleSaveSpot = async () => {
    if (!newCategory.trim() || !newLabel.trim()) { setSaveMsg("Catégorie et intitulé requis."); return; }
    if (!Object.values(refWeights).some((w) => w > 0)) { setSaveMsg("La range de référence est vide."); return; }
    setSaveMsg("Enregistrement…");
    try {
      await createRangeSpot({ category: newCategory.trim(), label: newLabel.trim(), referenceWeights: refWeights });
      setSaveMsg("Spot enregistré.");
      setNewLabel(""); setRefWeights({}); setRefPasteText("");
      await refresh();
    } catch (e) {
      setSaveMsg("Erreur : " + e.message);
    }
  };

  const handleDeleteSpot = async (id) => {
    await deleteRangeSpot(id);
    if (selectedSpotId === id) selectSpot("");
    await refresh();
  };

  if (authState === "checking") return null;
  if (authState === "denied") {
    return (
      <div style={{ minHeight: "100vh", padding: 20, maxWidth: 700, margin: "0 auto" }}>
        <PageHeader subtitle="Range Builder" />
        <Section>Connecte-toi pour accéder à cet outil.</Section>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <PageHeader
        subtitle={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RangeBuilderIcon size={18} /> Range Builder
          </span>
        }
      />

      {isAdmin && (
        <Section title="Créer un spot (admin)">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Catégorie</label>
              <input
                list="rb-categories" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                placeholder="ex: Cbet / Deux barrel" style={inputStyle}
              />
              <datalist id="rb-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Intitulé du spot</label>
              <input
                value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                placeholder="ex: BTN vs BB, 9♠5♥2♣, c-bet BTN" style={inputStyle}
              />
            </div>
          </div>

          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
            Colle la range de référence (format solveur — ex: "AA:1, AKs:0.5, JTs:0.33") pour la préremplir, ou dessine-la directement sur la grille.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <textarea
              value={refPasteText} onChange={(e) => setRefPasteText(e.target.value)} rows={3}
              style={{ ...inputStyle, fontFamily: "var(--font-ibm-plex-mono), monospace", flex: 1 }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                type="number" min={0} max={1} step="0.01" value={refPasteMinWeight}
                onChange={(e) => setRefPasteMinWeight(e.target.value)} placeholder="seuil min"
                style={{ ...inputStyle, width: 90 }}
              />
              <button onClick={applyRefPaste} style={ghostButtonStyle}>Appliquer</button>
            </div>
          </div>

          <RangeGrid comboWeights={refWeights} setComboWeights={setRefWeights} mode="admin" />

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={handleSaveSpot} style={primaryButtonStyle}>Enregistrer le spot</button>
            <button onClick={() => { setRefWeights({}); setRefPasteText(""); }} style={ghostButtonStyle}>Vider</button>
            {saveMsg && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{saveMsg}</span>}
          </div>
        </Section>
      )}

      <Section title="S'entraîner">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Catégorie</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={inputStyle}>
              <option value="Toutes">Toutes</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Spot</label>
            <select value={selectedSpotId} onChange={(e) => selectSpot(e.target.value)} style={inputStyle}>
              <option value="">— choisir —</option>
              {filteredSpots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {loadingSpots && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Chargement…</div>}
        {!loadingSpots && spots.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun spot pour l&apos;instant.</div>
        )}

        {selectedSpot && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{selectedSpot.label}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14 }}>
              {selectedSpot.category} — dessine la stratégie que tu penses correcte, puis compare.
              {isAdmin && (
                <button onClick={() => handleDeleteSpot(selectedSpot.id)} style={{ ...ghostButtonStyle, marginLeft: 10, fontSize: 10, padding: "3px 8px" }}>
                  Supprimer ce spot
                </button>
              )}
            </div>

            <RangeGrid comboWeights={studentWeights} setComboWeights={setStudentWeights} mode="admin" />

            <div style={{ marginTop: 14 }}>
              <button onClick={handleCompare} style={primaryButtonStyle}>Comparer</button>
            </div>

            {result && (
              <div style={{ marginTop: 20 }}>
                <div style={{
                  fontSize: 22, fontWeight: 700, marginBottom: 14,
                  color: result.accuracy >= 85 ? "var(--accent)" : result.accuracy >= 65 ? "#E8C547" : "#E0645A",
                }}>
                  {result.accuracy}% de similarité
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Référence</div>
                    <StaticGrid cellStyle={referenceCellStyle(selectedSpot.referenceWeights)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                      Écart <span style={{ color: "#E0645A" }}>rouge = tu sur-bet</span> / <span style={{ color: "#4FA8E0" }}>bleu = tu sous-bet</span>
                    </div>
                    <StaticGrid
                      cellStyle={diffCellStyle(result.perClass)}
                      cellLabel={(cls) => `${cls} — écart ${(result.perClass[cls].diff * 100).toFixed(0)}%`}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
