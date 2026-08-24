"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createSpot, deleteSpot, listSpots, updateSpot } from "@/lib/supabase/spots";
import {
  MOMENT_OPTIONS, ACCENT, PROFILE_COLORS, PROFILE_OPTIONS, generateSeats, selectStyle,
} from "@/lib/poker/constants";
import { comboKey } from "@/lib/poker/combos";
import { parsePastedRange, filterDominantCombos } from "@/lib/poker/rangeParser";
import { applyCutoff, parseWinamaxHH } from "@/lib/poker/hhParser";
import RangeGrid from "@/components/RangeGrid";
import CardPicker from "@/components/CardPicker";
import MiniCard from "@/components/MiniCard";
import TableView from "@/components/TableView";
import PageHeader from "@/components/PageHeader";
import Section from "@/components/Section";

const inputStyle = {
  width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "7px 9px", fontSize: 12,
};

const smallInputStyle = {
  width: "100%", background: "var(--panel-2)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)",
  color: "var(--text)", borderRadius: 6, padding: "4px 6px", fontSize: 11,
};

const primaryButtonStyle = {
  padding: "8px 16px", background: "var(--accent-gradient)", color: "#0B1210",
  border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
};

const ghostButtonStyle = {
  padding: "6px 12px", background: "var(--panel-2)", color: "var(--text)",
  border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, cursor: "pointer",
};

function toggleButtonStyle(active, activeColor = ACCENT) {
  return {
    padding: "5px 10px", fontSize: 11, borderRadius: 6, border: "1px solid var(--border)",
    background: active ? activeColor : "var(--panel-2)", color: active ? "#0B1210" : "var(--text)",
    cursor: "pointer",
  };
}

const FIELDS = [
  ["nom", "Nom du spot"],
  ["board", "Board (ex: As Kd 7h 2c 9s)"], ["potTotal", "Pot total (en BB)"],
  ["blindLevel", "Niveau de blind (ex: 400/800)"], ["averageBB", "Average du tournoi (en BB)"],
  ["timer", "Timer (secondes)"], ["buyIn", "Buy-in"], ["format", "Format (freezeout, PKO...)"],
  ["startingStack", "Starting stack"],
];

const EMPTY_FORM = {
  nom: '', koValue: '', ligne: '', consigne: '', explication: '', gtoWizardLink: '', timer: 30, buyIn: '', format: '', startingStack: '', palier: '',
  question: '', questionAnswer: '', questionAvis: '', villainInfo: '',
  board: '', blindLevel: '', averageBB: '', nbInscrits: '', potTotal: '',
  momentTournoi: MOMENT_OPTIONS[0], mode: 'theorique',
  heroCard1: 'Qc', heroCard2: 'Qd', villainCard1: 'As', villainCard2: 'Kd',
  numPlayers: 6, seats: generateSeats(6), replay: null,
};

export default function AdminPage() {
  const [authState, setAuthState] = useState("checking"); // checking | denied | ok

  const [spots, setSpots] = useState([]);
  const [loadingSpots, setLoadingSpots] = useState(true);
  const [spotSearch, setSpotSearch] = useState("");
  const [spotSort, setSpotSort] = useState("date-desc");

  const [editingId, setEditingId] = useState(null);
  const [editWeights, setEditWeights] = useState({});
  const [pasteText, setPasteText] = useState("");
  const [pasteMinWeight, setPasteMinWeight] = useState("");
  const [competingPastes, setCompetingPastes] = useState([]);
  const [heroWeights, setHeroWeights] = useState({});
  const [heroPasteText, setHeroPasteText] = useState("");
  const [heroPasteMinWeight, setHeroPasteMinWeight] = useState("");
  const [hhText, setHhText] = useState("");
  const [hhMsg, setHhMsg] = useState("");
  const [parsedHH, setParsedHH] = useState(null);
  const [selectedNodeIdx, setSelectedNodeIdx] = useState(null);
  const [previewIdx, setPreviewIdx] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saveMsg, setSaveMsg] = useState("");

  const refreshSpots = async () => {
    setLoadingSpots(true);
    try { setSpots(await listSpots()); } finally { setLoadingSpots(false); }
  };

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) { setAuthState("denied"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") { setAuthState("denied"); return; }
      setAuthState("ok");
      await refreshSpots();
    })();
  }, []);

  const pastePreview = useMemo(() => {
    if (!pasteText.trim()) return { count: 0, weighted: 0 };
    const minWeight = parseFloat(pasteMinWeight) || 0;
    let weights = parsePastedRange(pasteText, minWeight);
    const competingParsed = competingPastes.filter(t => t.trim()).map(t => parsePastedRange(t, 0));
    if (competingParsed.length) weights = filterDominantCombos(weights, competingParsed);
    const values = Object.values(weights);
    return { count: values.length, weighted: values.reduce((sum, w) => sum + w, 0) };
  }, [pasteText, pasteMinWeight, competingPastes]);

  const referenceCombos = useMemo(() => {
    const values = Object.values(editWeights).filter(w => w > 0);
    return { count: values.length, weighted: values.reduce((sum, w) => sum + w, 0) };
  }, [editWeights]);

  const heroPastePreview = useMemo(() => {
    if (!heroPasteText.trim()) return { count: 0, weighted: 0 };
    const minWeight = parseFloat(heroPasteMinWeight) || 0;
    const weights = parsePastedRange(heroPasteText, minWeight);
    const values = Object.values(weights);
    return { count: values.length, weighted: values.reduce((sum, w) => sum + w, 0) };
  }, [heroPasteText, heroPasteMinWeight]);

  const heroCombos = useMemo(() => {
    const values = Object.values(heroWeights).filter(w => w > 0);
    return { count: values.length, weighted: values.reduce((sum, w) => sum + w, 0) };
  }, [heroWeights]);

  const visibleSpots = useMemo(() => {
    const q = spotSearch.trim().toLowerCase();
    const filtered = q ? spots.filter(s => s.nom.toLowerCase().includes(q)) : spots;
    const sorted = [...filtered];
    switch (spotSort) {
      case "name-asc": sorted.sort((a, b) => a.nom.localeCompare(b.nom)); break;
      case "name-desc": sorted.sort((a, b) => b.nom.localeCompare(a.nom)); break;
      case "date-asc": sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      case "mode": sorted.sort((a, b) => a.mode.localeCompare(b.mode) || a.nom.localeCompare(b.nom)); break;
      default: sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // date-desc
    }
    return sorted;
  }, [spots, spotSearch, spotSort]);

  if (authState === "checking") {
    return <div style={{ padding: 20, fontSize: 13, color: "var(--text-muted)" }}>Vérification…</div>;
  }
  if (authState === "denied") {
    return (
      <div style={{ padding: 20, fontSize: 13, color: "var(--text-muted)" }}>
        Réservé au coach. <Link href="/" style={{ color: "var(--accent)" }}>Retour à l&apos;accueil</Link>
      </div>
    );
  }

  const handlePaste = () => {
    const minWeight = parseFloat(pasteMinWeight) || 0;
    const rawWeights = parsePastedRange(pasteText, 0);
    const weights = parsePastedRange(pasteText, minWeight);
    const competingParsed = competingPastes.filter(t => t.trim()).map(t => parsePastedRange(t, 0));
    setEditWeights(prev => {
      const merged = { ...prev };
      // Tout combo mentionné dans le texte collé repart de zéro (même s'il existait déjà avec
      // un autre poids depuis un import précédent), pour que relever le seuil ou ajouter un
      // sizing concurrent purge vraiment les entrées obsolètes au lieu de les laisser trainer.
      for (const key of Object.keys(rawWeights)) delete merged[key];
      Object.assign(merged, weights);
      return competingParsed.length ? filterDominantCombos(merged, competingParsed) : merged;
    });
  };

  const addCompetingPaste = () => setCompetingPastes(prev => [...prev, '']);
  const updateCompetingPaste = (idx, value) => setCompetingPastes(prev => prev.map((t, i) => i === idx ? value : t));
  const removeCompetingPaste = (idx) => setCompetingPastes(prev => prev.filter((_, i) => i !== idx));

  const handleHeroPaste = () => {
    const minWeight = parseFloat(heroPasteMinWeight) || 0;
    const weights = parsePastedRange(heroPasteText, minWeight);
    setHeroWeights(prev => ({ ...prev, ...weights }));
  };

  const handleAnalyzeHH = () => {
    if (!hhText.trim()) { setHhMsg('Colle une hand history avant.'); return; }
    const parsed = parseWinamaxHH(hhText);
    setForm(f => ({ ...f, ...parsed, replay: parsed.replay }));
    if (parsed.replay && parsed.replay.steps.length) {
      setParsedHH({ seatsBase: parsed.seatsBase, steps: parsed.replay.steps, initialStacks: parsed.replay.initialStacks, initialPot: parsed.replay.initialPot, initialStreetCommit: parsed.replay.initialStreetCommit, bb: parsed.replay.bb });
      setSelectedNodeIdx(parsed.replay.steps.length - 1);
      setPreviewIdx(parsed.replay.steps.length - 1);
    }
    if (parsed.villainCard1 && parsed.villainCard2) {
      const key = comboKey([parsed.villainCard1, parsed.villainCard2]);
      setEditWeights(prev => ({ ...prev, [key]: 1 }));
    }
    setHhMsg("Hand history analysée. Navigue action par action ci-dessous avec les flèches, puis valide le nœud où tu veux arrêter l'exercice. Vérifie le vilain détecté avant de sauvegarder.");
  };

  const handleSelectNode = (idx) => {
    if (!parsedHH) return;
    setSelectedNodeIdx(idx);
    const cutoff = applyCutoff(parsedHH.steps, idx);
    setForm(f => ({
      ...f,
      board: cutoff.board.join(' '),
      ligne: cutoff.ligne,
      seats: f.seats.map(s => ({ ...s, action: cutoff.actionByPlayer[s.name] || '' })),
      replay: { initialStacks: parsedHH.initialStacks, initialPot: parsedHH.initialPot, initialStreetCommit: parsedHH.initialStreetCommit, bb: parsedHH.bb, steps: parsedHH.steps.slice(0, idx + 1) },
    }));
  };

  const resetEditor = () => {
    setEditingId(null);
    setEditWeights({});
    setPasteText('');
    setPasteMinWeight('');
    setCompetingPastes([]);
    setHeroWeights({});
    setHeroPasteText('');
    setHeroPasteMinWeight('');
    setHhText('');
    setHhMsg('');
    setParsedHH(null);
    setSelectedNodeIdx(null);
    setPreviewIdx(null);
    setForm({ ...EMPTY_FORM, seats: generateSeats(6) });
  };

  const setNumPlayers = (n) => setForm(f => ({ ...f, numPlayers: n, seats: generateSeats(n) }));

  const updateSeat = (idx, patch) => setForm(f => ({ ...f, seats: f.seats.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  const setSeatRole = (idx, role) => setForm(f => ({
    ...f,
    seats: f.seats.map((s, i) => ({ ...s, role: i === idx ? (s.role === role ? null : role) : (s.role === role ? null : s.role) })),
  }));
  const setSeatDealer = (idx) => setForm(f => ({ ...f, seats: f.seats.map((s, i) => ({ ...s, dealer: i === idx })) }));

  const handleSaveSpot = async () => {
    if (!form.nom.trim()) { setSaveMsg('Donne un nom au spot avant de sauvegarder.'); return; }
    let heroCombo = '';
    let villainKey = '';
    if (form.mode === 'exploit') {
      if (form.heroCard1 === form.heroCard2) { setSaveMsg('Les deux cartes de Hero doivent être différentes.'); return; }
      if (form.villainCard1 === form.villainCard2) { setSaveMsg('Les deux cartes du combo vilain doivent être différentes.'); return; }
      heroCombo = form.heroCard1 + form.heroCard2;
      villainKey = comboKey([form.villainCard1, form.villainCard2]);
      if (!(editWeights[villainKey] > 0)) {
        setSaveMsg("⚠️ Le combo de vilain n'a aucun poids dans la grille de référence — le score sera toujours 0 pour ce spot. Colle/édite la range de référence avant de sauvegarder.");
        return;
      }
    } else {
      const hasDrawable = Object.values(editWeights).some(w => w > 0);
      if (!hasDrawable) {
        setSaveMsg("⚠️ La grille de référence est vide — aucun combo n'est tirable pour vilain. Colle/édite la range avant de sauvegarder.");
        return;
      }
    }
    const heroHasDrawable = Object.values(heroWeights).some(w => w > 0);
    const payload = {
      nom: form.nom, koValue: form.koValue, ligne: form.ligne, consigne: form.consigne, explication: form.explication, gtoWizardLink: form.gtoWizardLink,
      question: form.question, questionAnswer: form.question.trim() ? form.questionAnswer : '', questionAvis: form.question.trim() ? form.questionAvis : '',
      villainInfo: form.mode === 'exploit' ? form.villainInfo : '',
      mode: form.mode, heroCombo, villainCombo: villainKey, timer: parseInt(form.timer, 10) || 30,
      buyIn: form.buyIn, format: form.format, startingStack: form.startingStack, palier: form.palier,
      board: form.board, blindLevel: form.blindLevel, averageBB: form.averageBB, nbInscrits: form.nbInscrits,
      potTotal: form.potTotal, momentTournoi: form.momentTournoi, seats: form.seats, replay: form.replay || null,
      weights: editWeights, heroWeights: form.mode === 'theorique' ? heroWeights : {},
    };
    try {
      if (editingId) await updateSpot(editingId, payload);
      else await createSpot(payload);
      const base = editingId ? 'Spot mis à jour.' : 'Spot sauvegardé.';
      setSaveMsg(form.mode === 'theorique' && !heroHasDrawable
        ? base + ' ⚠️ Range Hero vide — sa main sera tirée totalement au hasard pour ce spot.'
        : base);
      resetEditor();
      refreshSpots();
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (e) {
      setSaveMsg('Erreur : ' + e.message);
    }
  };

  const handleEditSpot = (spot) => {
    setEditingId(spot.id);
    setEditWeights(spot.weights || {});
    setHeroWeights(spot.heroWeights || {});
    setPasteText(''); setPasteMinWeight(''); setCompetingPastes([]);
    setHeroPasteText(''); setHeroPasteMinWeight('');
    setHhText(''); setHhMsg(''); setParsedHH(null); setSelectedNodeIdx(null); setPreviewIdx(null);
    const heroCard1 = spot.heroCombo ? spot.heroCombo.slice(0, 2) : 'Qc';
    const heroCard2 = spot.heroCombo ? spot.heroCombo.slice(2, 4) : 'Qd';
    const villainCard1 = spot.villainCombo && spot.villainCombo.length === 4 ? spot.villainCombo.slice(0, 2) : 'As';
    const villainCard2 = spot.villainCombo && spot.villainCombo.length === 4 ? spot.villainCombo.slice(2, 4) : 'Kd';
    setForm({
      nom: spot.nom || '', koValue: spot.koValue || '', ligne: spot.ligne || '', consigne: spot.consigne || '', explication: spot.explication || '', gtoWizardLink: spot.gtoWizardLink || '', timer: spot.timer || 30,
      question: spot.question || '', questionAnswer: spot.questionAnswer || '', questionAvis: spot.questionAvis || '',
      villainInfo: spot.villainInfo || '',
      buyIn: spot.buyIn || '', format: spot.format || '', startingStack: spot.startingStack || '', palier: spot.palier || '',
      board: spot.board || '', blindLevel: spot.blindLevel || '', averageBB: spot.averageBB || '', nbInscrits: spot.nbInscrits || '',
      potTotal: spot.potTotal ?? '', momentTournoi: spot.momentTournoi || MOMENT_OPTIONS[0], mode: spot.mode,
      heroCard1, heroCard2, villainCard1, villainCard2,
      numPlayers: (spot.seats || []).length || 6, seats: spot.seats && spot.seats.length ? spot.seats : generateSeats(6),
      replay: spot.replay || null,
    });
    setSaveMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSpot = async (id) => {
    await deleteSpot(id);
    setSpots(prev => prev.filter(s => s.id !== id));
    if (editingId === id) resetEditor();
  };

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 1180, margin: "0 auto" }}>
      <PageHeader subtitle="Éditeur admin" right={<Link href="/train" style={{ fontSize: 12, color: "var(--text-muted)" }}>S&apos;entraîner</Link>} />

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 380px', minWidth: 320 }}>
          <Section title="Importer un spot">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Hand History (Winamax)</div>
            <textarea value={hhText} onChange={e => setHhText(e.target.value)} rows={4}
              placeholder="Colle ici le texte complet de la hand history..."
              style={{ ...inputStyle, fontSize: 11, fontFamily: "var(--font-ibm-plex-mono), monospace" }} />
            <button onClick={handleAnalyzeHH} style={{ ...ghostButtonStyle, marginTop: 8 }}>
              Analyser la Hand History
            </button>
            {hhMsg && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>{hhMsg}</div>}

            {parsedHH && parsedHH.steps.length > 0 && (() => {
              const maxIdx = parsedHH.steps.length - 1;
              const bb = parsedHH.bb;
              const current = previewIdx != null && previewIdx >= 0 ? parsedHH.steps[previewIdx] : null;
              const cutoff = previewIdx != null && previewIdx >= 0 ? applyCutoff(parsedHH.steps, previewIdx) : { board: [], ligne: '', actionByPlayer: {} };
              const stacksChips = current ? current.stacksChips : parsedHH.initialStacks;
              const potChips = current ? current.potChips : parsedHH.initialPot;
              const previewSeats = form.seats.map(s => ({
                ...s,
                stackBB: bb ? Math.round(((stacksChips[s.name] ?? 0) / bb) * 10) / 10 : s.stackBB,
                stackChips: stacksChips[s.name] ?? null,
                action: cutoff.actionByPlayer[s.name] || '',
              }));
              const previewSpot = {
                ...form, seats: previewSeats, board: cutoff.board.join(' '),
                potTotal: bb ? Math.round((potChips / bb) * 10) / 10 : form.potTotal,
              };
              const streetsPresent = [...new Set(parsedHH.steps.map(s => s.street))];
              const jumpToStreet = (street) => { const i = parsedHH.steps.findIndex(s => s.street === street); if (i >= 0) setPreviewIdx(i); };
              const isConfirmed = selectedNodeIdx === previewIdx;

              return (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Navigue action par action pour choisir ton nœud d&apos;arrêt :</div>
                  <TableView spot={previewSpot} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setPreviewIdx(i => Math.max(-1, i - 1))} disabled={previewIdx <= -1} style={{ ...ghostButtonStyle, opacity: previewIdx <= -1 ? 0.4 : 1 }}>←</button>
                    {['PRE-FLOP', 'FLOP', 'TURN', 'RIVER'].map(s => (
                      <button key={s} disabled={!streetsPresent.includes(s)} onClick={() => jumpToStreet(s)}
                        style={{ ...toggleButtonStyle(current && current.street === s), opacity: streetsPresent.includes(s) ? 1 : 0.3 }}>
                        {s}
                      </button>
                    ))}
                    <button onClick={() => setPreviewIdx(i => Math.min(maxIdx, i + 1))} disabled={previewIdx >= maxIdx} style={{ ...ghostButtonStyle, opacity: previewIdx >= maxIdx ? 0.4 : 1 }}>→</button>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    {!current ? "Avant l'action (mains distribuées)" : current.player ? `${current.player} : ${current.label}` : `Le ${current.street.toLowerCase()} tombe`}
                  </div>
                  <button onClick={() => handleSelectNode(previewIdx)} disabled={isConfirmed} style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none',
                    background: isConfirmed ? 'var(--panel-2)' : 'var(--accent-gradient)', color: isConfirmed ? '#6FCF97' : '#0B1210',
                    cursor: isConfirmed ? 'default' : 'pointer',
                  }}>
                    {isConfirmed ? "✓ Nœud d'arrêt confirmé" : "Arrêter l'exercice ici — utiliser ce nœud"}
                  </button>
                </div>
              );
            })()}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Ou coller une range (classes ou combo par combo)</div>
              <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={2}
                style={{ ...inputStyle, fontFamily: "var(--font-ibm-plex-mono), monospace" }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <button onClick={handlePaste} style={ghostButtonStyle}>Importer la range</button>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Poids min.
                  <input type="number" min={0} max={1} step={0.01} placeholder="0"
                    value={pasteMinWeight} onChange={e => setPasteMinWeight(e.target.value)}
                    style={{ ...inputStyle, width: 64, padding: '4px 6px' }} />
                </label>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                Export brut de solveur (combo par combo) : les fréquences quasi nulles gonflent le nombre de combos importés. Mets un seuil (ex. 0.1) pour ne garder que les combos avec un poids significatif.
              </div>
              {pasteText.trim() && (
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, fontWeight: 600 }}>
                  {pastePreview.count} combo{pastePreview.count !== 1 ? 's' : ''} seraient importés avec ce seuil
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {pastePreview.weighted.toFixed(1)} combo{pastePreview.weighted >= 2 || pastePreview.weighted < 1 ? 's' : ''} réel{pastePreview.weighted >= 2 || pastePreview.weighted < 1 ? 's' : ''} (pondéré par la fréquence)</span>
                </div>
              )}

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Sizings concurrents (optionnel) — colle la range d&apos;autres sizings au même nœud pour exclure de la range ci-dessus les combos qui y sont en réalité plus fréquents (résidu de stratégie mixée).
                </div>
                {competingPastes.map((text, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
                    <textarea value={text} onChange={e => updateCompetingPaste(i, e.target.value)} rows={2}
                      style={{ ...inputStyle, fontFamily: "var(--font-ibm-plex-mono), monospace" }} />
                    <button onClick={() => removeCompetingPaste(i)} style={{ ...ghostButtonStyle, padding: '6px 10px', flexShrink: 0 }}>×</button>
                  </div>
                ))}
                <button onClick={addCompetingPaste} style={ghostButtonStyle}>+ Ajouter un sizing concurrent</button>
              </div>
            </div>
          </Section>

          <Section
            title="Grille de référence"
            action={
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {referenceCombos.count} combo{referenceCombos.count !== 1 ? 's' : ''}
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}> · {referenceCombos.weighted.toFixed(1)} réel{referenceCombos.weighted >= 2 || referenceCombos.weighted < 1 ? 's' : ''}</span>
              </span>
            }
          >
            <RangeGrid comboWeights={editWeights} setComboWeights={setEditWeights} mode="admin" excludedCards={form.mode === 'exploit' ? [form.heroCard1, form.heroCard2] : []} />
          </Section>

          {form.mode === 'theorique' && (
            <Section
              title="Range Hero (ouverture)"
              action={
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {heroCombos.count} combo{heroCombos.count !== 1 ? 's' : ''}
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}> · {heroCombos.weighted.toFixed(1)} réel{heroCombos.weighted >= 2 || heroCombos.weighted < 1 ? 's' : ''}</span>
                </span>
              }
            >
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                La main de Hero sera tirée au hasard dans cette range (pondérée par la fréquence) plutôt que sur les 1326 combos possibles — pour rester cohérente avec la position/l&apos;action de ce spot. Laisse vide pour un tirage 100% aléatoire.
              </div>
              <textarea value={heroPasteText} onChange={e => setHeroPasteText(e.target.value)} rows={2}
                style={{ ...inputStyle, fontFamily: "var(--font-ibm-plex-mono), monospace" }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <button onClick={handleHeroPaste} style={ghostButtonStyle}>Importer la range</button>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Poids min.
                  <input type="number" min={0} max={1} step={0.01} placeholder="0"
                    value={heroPasteMinWeight} onChange={e => setHeroPasteMinWeight(e.target.value)}
                    style={{ ...inputStyle, width: 64, padding: '4px 6px' }} />
                </label>
              </div>
              {heroPasteText.trim() && (
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, fontWeight: 600 }}>
                  {heroPastePreview.count} combo{heroPastePreview.count !== 1 ? 's' : ''} seraient importés avec ce seuil
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {heroPastePreview.weighted.toFixed(1)} réel{heroPastePreview.weighted >= 2 || heroPastePreview.weighted < 1 ? 's' : ''}</span>
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <RangeGrid comboWeights={heroWeights} setComboWeights={setHeroWeights} mode="admin" excludedCards={[]} />
              </div>
            </Section>
          )}
        </div>

        <div style={{ flex: '1 1 380px', minWidth: 320 }}>
          <Section title="Mode & table">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Mode</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['theorique', 'Théorique'], ['exploit', 'Exploit']].map(([v, label]) => (
                    <button key={v} onClick={() => setForm(f => ({ ...f, mode: v }))} style={{ ...toggleButtonStyle(form.mode === v), flex: 1, padding: '6px 8px' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Joueurs</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <button key={n} onClick={() => setNumPlayers(n)} style={{ ...toggleButtonStyle(form.numPlayers === n), width: 28, padding: '5px 0' }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {form.mode === 'exploit' && (
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Main de Hero</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <CardPicker card={form.heroCard1} onChange={c => setForm(f => ({ ...f, heroCard1: c }))} />
                    <CardPicker card={form.heroCard2} onChange={c => setForm(f => ({ ...f, heroCard2: c }))} />
                    <MiniCard card={form.heroCard1} /><MiniCard card={form.heroCard2} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Combo réel de vilain</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <CardPicker card={form.villainCard1} onChange={c => setForm(f => ({ ...f, villainCard1: c }))} />
                    <CardPicker card={form.villainCard2} onChange={c => setForm(f => ({ ...f, villainCard2: c }))} />
                    <MiniCard card={form.villainCard1} /><MiniCard card={form.villainCard2} />
                  </div>
                </div>
                <div style={{ flex: '1 1 100%' }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Infos sur l&apos;adversaire (stats HUD, reads, historique... affiché à l&apos;élève avant et pendant l&apos;exercice)
                  </label>
                  <textarea value={form.villainInfo} onChange={e => setForm(f => ({ ...f, villainInfo: e.target.value }))} rows={3}
                    placeholder="Ex: 45/12/3 sur 800 mains, très calling station postflop, ne bluff quasiment jamais la river..."
                    style={inputStyle} />
                </div>
              </div>
            )}
            {form.mode === 'theorique' && (
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                Hero et le combo de vilain seront tirés au hasard à chaque tentative.
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Sièges</label>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ fontWeight: 500, padding: '0 4px 6px 0' }}>Pos</th>
                      <th style={{ fontWeight: 500, padding: '0 4px 6px' }}>BB</th>
                      <th style={{ fontWeight: 500, padding: '0 4px 6px' }}>Action</th>
                      <th style={{ fontWeight: 500, padding: '0 4px 6px' }}>KO€</th>
                      <th style={{ fontWeight: 500, padding: '0 4px 6px' }} colSpan={3}>Rôle</th>
                      <th style={{ fontWeight: 500, padding: '0 0 6px 4px' }}>Profil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.seats.map((seat, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '4px 4px 4px 0' }}>
                          <input value={seat.position} onChange={e => updateSeat(idx, { position: e.target.value })} style={{ ...smallInputStyle, width: 46 }} />
                        </td>
                        <td style={{ padding: 4 }}>
                          <input value={seat.stackBB} onChange={e => updateSeat(idx, { stackBB: e.target.value })} style={{ ...smallInputStyle, width: 40 }} />
                        </td>
                        <td style={{ padding: 4 }}>
                          <input value={seat.action} onChange={e => updateSeat(idx, { action: e.target.value })} style={{ ...smallInputStyle, width: 64 }} />
                        </td>
                        <td style={{ padding: 4 }}>
                          <input value={seat.bounty} onChange={e => updateSeat(idx, { bounty: e.target.value })} style={{ ...smallInputStyle, width: 42 }} />
                        </td>
                        <td style={{ padding: 4 }}>
                          <button onClick={() => setSeatRole(idx, 'hero')} style={{ ...toggleButtonStyle(seat.role === 'hero'), padding: '3px 6px' }}>H</button>
                        </td>
                        <td style={{ padding: 4 }}>
                          <button onClick={() => setSeatRole(idx, 'villain')} style={{ ...toggleButtonStyle(seat.role === 'villain', '#E0645A'), padding: '3px 6px' }}>V</button>
                        </td>
                        <td style={{ padding: 4 }}>
                          <button onClick={() => setSeatDealer(idx)} style={{ ...toggleButtonStyle(seat.dealer, '#ECEEF1'), padding: '3px 6px' }}>D</button>
                        </td>
                        <td style={{ padding: '4px 0 4px 4px' }}>
                          <select value={seat.profile} onChange={e => updateSeat(idx, { profile: e.target.value })}
                            style={{ ...smallInputStyle, width: 88, borderColor: seat.profile ? PROFILE_COLORS[seat.profile] : 'var(--border)', color: seat.profile ? PROFILE_COLORS[seat.profile] : 'var(--text)' }}>
                            <option value="">—</option>
                            {PROFILE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          <Section title="Détails du spot">
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Moment du tournoi</label>
              <select value={form.momentTournoi} onChange={e => setForm(f => ({ ...f, momentTournoi: e.target.value }))} style={{ ...selectStyle, ...inputStyle }}>
                {MOMENT_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {FIELDS.map(([field, label]) => (
                <div key={field}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{label}</label>
                  <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nombre d&apos;inscrits au tournoi</label>
              <input value={form.nbInscrits} onChange={e => setForm(f => ({ ...f, nbInscrits: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {[5000, 1000, 500, 200].map(n => (
                  <button key={n} onClick={() => setForm(f => ({ ...f, nbInscrits: String(n) }))} style={ghostButtonStyle}>{n}</button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Consigne du spot (affichée à l&apos;élève avant et pendant l&apos;exercice — ex: &quot;Dessine la range de bet de notre adversaire&quot;)
              </label>
              <textarea value={form.consigne} onChange={e => setForm(f => ({ ...f, consigne: e.target.value }))} rows={2}
                placeholder="Ex: Dessine la range de bet de notre adversaire sur cette river."
                style={inputStyle} />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Explication du coach (affichée à l&apos;élève après sa tentative — la range de référence, elle, reste toujours cachée)
              </label>
              <textarea value={form.explication} onChange={e => setForm(f => ({ ...f, explication: e.target.value }))} rows={4}
                placeholder="Ex: On défend large ici car le stack de vilain est trop court pour qu'il puisse nous punir en 4bet, et notre équité en défense est excellente contre son range de squeeze..."
                style={inputStyle} />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Lien GTOWizard (optionnel — affiché à l&apos;élève après sa tentative, jamais avant)
              </label>
              <input value={form.gtoWizardLink} onChange={e => setForm(f => ({ ...f, gtoWizardLink: e.target.value }))}
                placeholder="https://gtowizard.com/..." style={inputStyle} />
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Question de prédiction (optionnel — posée à l&apos;élève avant qu&apos;il valide sa sélection)
              </label>
              <input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                placeholder="Ex: Pensez-vous que l'AVG reg va overbluff ce spot ?" style={inputStyle} />
              {form.question.trim() && (
                <>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>Bonne réponse :</span>
                    {[['oui', 'Oui'], ['non', 'Non']].map(([v, label]) => (
                      <button key={v} onClick={() => setForm(f => ({ ...f, questionAnswer: v }))} style={toggleButtonStyle(form.questionAnswer === v)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <textarea value={form.questionAvis} onChange={e => setForm(f => ({ ...f, questionAvis: e.target.value }))} rows={3}
                    placeholder="L'avis du coach, affiché après que l'élève a répondu..."
                    style={{ ...inputStyle, marginTop: 8 }} />
                </>
              )}
            </div>
          </Section>

          <Section title="Aperçu & sauvegarde">
            {editingId && (
              <div style={{ marginBottom: 10, fontSize: 12, color: ACCENT, fontWeight: 600 }}>
                ✎ Édition de &quot;{form.nom || '…'}&quot;
              </div>
            )}
            <TableView spot={form} heroCardsOverride={form.mode === 'exploit' ? [form.heroCard1, form.heroCard2] : undefined} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={handleSaveSpot} style={primaryButtonStyle}>
                {editingId ? 'Mettre à jour le spot' : 'Sauvegarder le spot'}
              </button>
              {editingId && (
                <button onClick={resetEditor} style={ghostButtonStyle}>Annuler l&apos;édition</button>
              )}
            </div>
            {saveMsg && <div style={{ marginTop: 10, fontSize: 12, color: saveMsg.startsWith('⚠️') || saveMsg.startsWith('Erreur') ? '#E0645A' : '#6FCF97' }}>{saveMsg}</div>}
          </Section>
        </div>
      </div>

      <Section title="Spots existants" action={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{spots.length} spot{spots.length !== 1 ? 's' : ''}</span>}>
        {!loadingSpots && spots.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input value={spotSearch} onChange={e => setSpotSearch(e.target.value)} placeholder="Rechercher par nom…"
              style={{ ...inputStyle, flex: '1 1 200px' }} />
            <select value={spotSort} onChange={e => setSpotSort(e.target.value)} style={{ ...selectStyle, ...inputStyle, flex: '0 1 170px' }}>
              <option value="date-desc">Plus récents d&apos;abord</option>
              <option value="date-asc">Plus anciens d&apos;abord</option>
              <option value="name-asc">Nom (A→Z)</option>
              <option value="name-desc">Nom (Z→A)</option>
              <option value="mode">Mode (théorique/exploit)</option>
            </select>
          </div>
        )}
        {loadingSpots ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chargement…</div> :
          spots.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun spot créé pour l&apos;instant.</div> :
          visibleSpots.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun spot ne correspond à &quot;{spotSearch}&quot;.</div> :
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {visibleSpots.map(s => (
              <div key={s.id} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.nom}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{s.mode === 'exploit' ? 'Exploit' : 'Théorique'} · {s.timer}s</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => handleEditSpot(s)} style={{ padding: '5px 10px', background: editingId === s.id ? ACCENT : 'var(--panel)', color: editingId === s.id ? '#0B1210' : 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}>Éditer</button>
                  <Link href={`/play/${s.id}`} style={{ padding: '5px 10px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}>Jouer</Link>
                  <button onClick={() => handleDeleteSpot(s.id)} style={{ padding: '5px 10px', background: 'transparent', color: '#C4544A', border: '1px solid #C4544A', borderRadius: 6, fontSize: 11 }}>Suppr.</button>
                </div>
              </div>
            ))}
          </div>
        }
      </Section>
    </div>
  );
}
