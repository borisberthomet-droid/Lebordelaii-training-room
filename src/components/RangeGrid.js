"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ACCENT_RGB, SUIT_COLOR, SUIT_SYMBOL, SUITS } from "@/lib/poker/constants";
import {
  ALL_CLASSES, getClassCombos, getLineClasses,
  EMPTY_SUIT_FILTER, comboMatchesSuitFilter, suitFilterIsActive,
} from "@/lib/poker/combos";
import { comboOverlapsCards } from "@/lib/poker/scoring";

function formatPct(w) {
  const pct = w * 100;
  return pct < 1 ? `${pct.toFixed(2)}%` : `${Math.round(pct)}%`;
}

// --- Barre de filtres par couleur -------------------------------------------------------------
// Restreint les combos que les clics remplissent, sans rien masquer de la range déjà dessinée.
function SuitFilterBar({ filter, setFilter }) {
  const active = suitFilterIsActive(filter);
  const toggle = (family, suit) => setFilter((f) => {
    const list = f[family];
    return { ...f, [family]: list.includes(suit) ? list.filter((s) => s !== suit) : [...list, suit] };
  });

  const modeBtn = (mode, label) => (
    <button key={mode} type="button" onClick={() => setFilter((f) => ({ ...f, mode }))}
      style={{
        padding: '4px 12px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
        border: '1px solid #302D2A',
        background: filter.mode === mode ? '#3A3733' : 'transparent',
        color: filter.mode === mode ? '#ECEEF1' : '#7A736D',
        fontWeight: filter.mode === mode ? 600 : 400,
      }}>{label}</button>
  );

  const suitBtn = (family, suit) => {
    const on = filter[family].includes(suit);
    const sym = SUIT_SYMBOL[suit];
    return (
      <button key={family + suit} type="button" onClick={() => toggle(family, suit)}
        title={`${family === 'suited' ? 'Assortis' : 'Dépareillés'} ${sym}`}
        style={{
          width: family === 'suited' ? 34 : 24, height: 24, lineHeight: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${on ? '#8E867E' : '#302D2A'}`, borderRadius: 5, cursor: 'pointer',
          background: on ? 'rgba(255,255,255,0.10)' : 'transparent',
          color: SUIT_COLOR[suit], fontSize: 13, opacity: on ? 1 : 0.55, padding: 0,
        }}>
        {family === 'suited' ? `${sym}${sym}` : sym}
      </button>
    );
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 8,
      padding: '8px 10px', background: '#1A1918', border: '1px solid #302D2A', borderRadius: 6,
    }}>
      <div style={{ display: 'flex', gap: 4 }}>{modeBtn('include', 'Include')}{modeBtn('exclude', 'Exclude')}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: '#7A736D', marginRight: 2 }}>Dépareillés</span>
        {SUITS.map((s) => suitBtn('offsuit', s))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: '#7A736D', marginRight: 2 }}>Assortis</span>
        {SUITS.map((s) => suitBtn('suited', s))}
      </div>
      {active && (
        <button type="button" onClick={() => setFilter(EMPTY_SUIT_FILTER)}
          style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 10, background: 'transparent', color: '#E8A83C', border: '1px solid #302D2A', borderRadius: 5, cursor: 'pointer' }}>
          Tout réinitialiser
        </button>
      )}
      {active && (
        <div style={{ flexBasis: '100%', fontSize: 10, color: '#E8A83C' }}>
          Filtre actif : tes clics ne remplissent que les combos {filter.mode === 'exclude' ? 'NON ' : ''}visés.
        </div>
      )}
    </div>
  );
}

function GridCell({
  cls, col, row, weight, expanded, onClickClass, onCtrlClickClass, onDragStartClass, onDragEnterClass,
  comboWeights, onComboDragStart, onComboDragEnter, mode, excludedCards, suitFilter,
}) {
  const bg = weight <= 0 ? 'transparent' : `rgba(${ACCENT_RGB},${0.05 + weight * 0.55})`;
  const classFullyExcluded = excludedCards && excludedCards.length
    ? getClassCombos(cls).every(({ key }) => comboOverlapsCards(key, excludedCards)) : false;
  const showPct = mode === 'admin' && weight > 0;
  const touchTimer = useRef(null);
  const longPressFired = useRef(false);
  const clearTouchTimer = () => { if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; } };

  // Le popup fait 180 px pour des cases de ~35 px : collé à gauche il sortait de la grille sur
  // les dernières colonnes, et il paraissait « décalé » partout ailleurs. On l'ancre selon la
  // colonne, et on le fait basculer au-dessus sur les dernières lignes.
  const anchor = col <= 2 ? { left: 0 }
    : col >= 10 ? { right: 0 }
    : { left: '50%', transform: 'translateX(-50%)' };
  const vertical = row >= 9 ? { bottom: '110%' } : { top: '110%' };

  return (
    <div
      onMouseDown={(e) => {
        if (classFullyExcluded || e.button !== 0) return;
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) onCtrlClickClass(cls);
        else onDragStartClass(cls);
      }}
      onMouseEnter={(e) => { if (!classFullyExcluded && e.buttons === 1) onDragEnterClass(cls); }}
      onContextMenu={(e) => { e.preventDefault(); if (!classFullyExcluded) onClickClass(cls); }}
      onTouchStart={() => {
        if (classFullyExcluded) return;
        longPressFired.current = false;
        clearTouchTimer();
        touchTimer.current = setTimeout(() => { longPressFired.current = true; onClickClass(cls); }, 450);
      }}
      onTouchMove={clearTouchTimer}
      onTouchEnd={(e) => {
        clearTouchTimer();
        // Empêche le tap-click synthétique déclenché après le relâchement d'un appui long
        // (sans quoi le popup qui vient de s'ouvrir se referme aussitôt).
        if (longPressFired.current) e.preventDefault();
      }}
      style={{
        fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 11,
        cursor: classFullyExcluded ? 'not-allowed' : 'pointer', userSelect: 'none', WebkitTouchCallout: 'none', aspectRatio: '1/1',
        position: 'relative', minWidth: 0, opacity: classFullyExcluded ? 0.4 : 1,
      }}
      title={classFullyExcluded ? `${cls} — impossible (cartes déjà connues)` : `${cls}${showPct ? ` — ${formatPct(weight)} (moyenne de classe)` : ''} — maintenir et glisser: remplir plusieurs cases · ctrl+clic: toute la ligne · clic droit: détail combos`}
    >
      {/* Le fond/texte est découpé (overflow:hidden) séparément de la case elle-même : sans ça,
          ce même overflow:hidden coupait aussi le popup détail-combo positionné juste en dessous. */}
      <div style={{
        position: 'absolute', inset: 0, background: bg, border: '1px solid #302D2A', borderRadius: 3,
        color: classFullyExcluded ? '#302D2A' : (weight > 0.4 ? '#FFFFFF' : (weight > 0 ? '#E8A83C' : '#ECEEF1')),
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, overflow: 'hidden',
      }}>
        <span>{cls}</span>
        {showPct && (
          <span style={{ fontSize: 7, lineHeight: 1, color: 'rgba(255,255,255,0.6)' }}>
            {formatPct(weight)}
          </span>
        )}
      </div>
      {expanded && (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          style={{
            position: 'absolute', ...vertical, ...anchor, zIndex: 50, background: '#211F1D',
            border: '1px solid #302D2A', borderRadius: 6, padding: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: 180,
          }}>
          <div style={{ fontFamily: "var(--font-space-grotesk), sans-serif", fontSize: 10, color: '#9C9691', marginBottom: 6 }}>
            {cls} — {mode === 'admin' ? 'poids par combo' : 'sélection par combo'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {getClassCombos(cls).map(({ pair, key }) => {
              const w = comboWeights[key] || 0;
              const excluded = comboOverlapsCards(key, excludedCards);
              const filteredOut = !excluded && !comboMatchesSuitFilter(key, suitFilter);
              const locked = excluded || filteredOut;
              return (
                <div key={key}
                  onMouseDown={(e) => {
                    if (locked || e.button !== 0) return;
                    e.preventDefault(); e.stopPropagation();
                    onComboDragStart(key);
                  }}
                  onMouseEnter={(e) => { if (!locked && e.buttons === 1) onComboDragEnter(key); }}
                  title={excluded ? 'Carte déjà connue' : filteredOut ? 'Écarté par le filtre de couleur' : (mode === 'admin' && w > 0 ? formatPct(w) : undefined)}
                  style={{
                    background: excluded ? '#0A0C0E' : (w > 0 ? `rgba(${ACCENT_RGB},${0.05 + w * 0.55})` : '#1A1918'),
                    border: `1px solid ${filteredOut ? '#242220' : '#302D2A'}`, borderRadius: 4, padding: '3px 2px',
                    textAlign: 'center', cursor: locked ? 'not-allowed' : 'pointer', fontSize: 10,
                    opacity: excluded ? 0.35 : filteredOut ? 0.3 : 1,
                    userSelect: 'none', fontFamily: "var(--font-ibm-plex-mono), monospace",
                  }}>
                  {pair.map((c, idx) => <span key={idx} style={{ color: SUIT_COLOR[c[1]] }}>{c[0]}{SUIT_SYMBOL[c[1]]}</span>)}
                  {mode === 'admin' && w > 0 && (
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>{formatPct(w)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// mode: 'admin' (poids continus) | 'play' (binaire, sélection élève) | 'reveal' (lecture seule + surbrillance du résultat)
export default function RangeGrid({ comboWeights, setComboWeights, mode, resultReveal, excludedCards, showFilters = true }) {
  const [expandedClass, setExpandedClass] = useState(null);
  const [dragValue, setDragValue] = useState(null);
  const [suitFilter, setSuitFilter] = useState(EMPTY_SUIT_FILTER);

  useEffect(() => {
    const stop = () => setDragValue(null);
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  // Échap ferme le détail des combos. Il n'y a plus de fermeture automatique à la sortie de la
  // souris : le voile plein écran qui s'ouvrait avec le popup passait au-dessus de la case, le
  // navigateur envoyait un mouseleave, et le popup se refermait tout seul en une fraction de
  // seconde — sauf si on bougeait la souris jusque dans le popup, ce qui annulait le minuteur.
  // De l'extérieur ça donnait exactement « ça ne marche pas ». Fermeture désormais explicite :
  // clic à côté, nouveau clic droit, ou Échap.
  useEffect(() => {
    if (!expandedClass) return;
    const onKey = (e) => { if (e.key === 'Escape') setExpandedClass(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedClass]);

  const paintable = useCallback(
    (key) => !comboOverlapsCards(key, excludedCards) && comboMatchesSuitFilter(key, suitFilter),
    [excludedCards, suitFilter]
  );

  const classWeight = useCallback((cls) => {
    const combos = getClassCombos(cls);
    const sum = combos.reduce((acc, { key }) => acc + (comboWeights[key] || 0), 0);
    return sum / combos.length;
  }, [comboWeights]);

  // Moyenne sur les seuls combos que le clic va réellement toucher : sans ça, avec un filtre
  // actif, cliquer une classe déjà pleine « à carreau » relirait la classe entière (presque
  // vide) et redemanderait un remplissage au lieu d'effacer.
  const paintableClassWeight = useCallback((cls) => {
    const combos = getClassCombos(cls).filter(({ key }) => paintable(key));
    if (!combos.length) return null;
    return combos.reduce((acc, { key }) => acc + (comboWeights[key] || 0), 0) / combos.length;
  }, [comboWeights, paintable]);

  const setClassAll = (cls, value) => {
    setComboWeights(prev => {
      const next = { ...prev };
      getClassCombos(cls).forEach(({ key }) => { if (paintable(key)) next[key] = value; });
      return next;
    });
  };

  const onClickClass = (cls) => setExpandedClass(prev => prev === cls ? null : cls);

  const onDragStartClass = (cls) => {
    const current = paintableClassWeight(cls);
    if (current === null) return; // tout est exclu ou filtré : rien à peindre
    // En admin, un clic efface toujours (pratique pour repartir de zéro sur un poids importé du
    // solveur). En play/reveal, une sélection partielle faite via le popup détail-combo ne doit
    // pas être détruite par un simple clic : on complète la classe au lieu de la vider.
    const target = mode === 'admin' ? (current > 0 ? 0 : 1) : (current >= 1 ? 0 : 1);
    setDragValue(target);
    setClassAll(cls, target);
  };
  const onDragEnterClass = (cls) => { if (dragValue !== null) setClassAll(cls, dragValue); };

  const onCtrlClickClass = (cls) => {
    const allKeys = getLineClasses(cls).flatMap(c => getClassCombos(c).map(x => x.key)).filter(paintable);
    const allFull = allKeys.length > 0 && allKeys.every(k => (comboWeights[k] || 0) > 0);
    setComboWeights(prev => { const next = { ...prev }; allKeys.forEach(k => { next[k] = allFull ? 0 : 1; }); return next; });
  };

  // Même logique de glissé dans le détail des combos que sur la grille : on maintient et on
  // balaie les quatre cases au lieu de les cliquer une par une.
  const setCombo = (key, value) => setComboWeights(prev => ({ ...prev, [key]: value }));
  const onComboDragStart = (key) => {
    const target = (comboWeights[key] || 0) > 0 ? 0 : 1;
    setDragValue(target);
    setCombo(key, target);
  };
  const onComboDragEnter = (key) => { if (dragValue !== null) setCombo(key, dragValue); };

  const editable = mode !== 'reveal';

  return (
    <div>
      {showFilters && editable && <SuitFilterBar filter={suitFilter} setFilter={setSuitFilter} />}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: 2, maxWidth: 480 }}>
        {expandedClass && (
          <div onClick={() => setExpandedClass(null)} onContextMenu={(e) => { e.preventDefault(); setExpandedClass(null); }}
            style={{ position: 'fixed', inset: 0, zIndex: 49, cursor: 'default' }} />
        )}
        {ALL_CLASSES.map((cls, i) => {
          let cellBg = null;
          if (resultReveal) {
            const villainInClass = getClassCombos(cls).some(c => c.key === resultReveal.villainKey);
            if (villainInClass) cellBg = resultReveal.found ? '#3FA05A' : '#C4544A';
          }
          return (
            <div key={cls} style={cellBg ? { outline: `2px solid ${cellBg}`, borderRadius: 3 } : undefined}>
              <GridCell cls={cls} col={i % 13} row={Math.floor(i / 13)}
                weight={classWeight(cls)} expanded={expandedClass === cls}
                onClickClass={onClickClass} onCtrlClickClass={onCtrlClickClass}
                onDragStartClass={onDragStartClass} onDragEnterClass={onDragEnterClass}
                comboWeights={comboWeights} onComboDragStart={onComboDragStart} onComboDragEnter={onComboDragEnter}
                mode={mode} excludedCards={excludedCards} suitFilter={suitFilter} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
