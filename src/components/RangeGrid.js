"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ACCENT_RGB, SUIT_COLOR, SUIT_SYMBOL } from "@/lib/poker/constants";
import { ALL_CLASSES, getClassCombos, getLineClasses } from "@/lib/poker/combos";
import { comboOverlapsCards } from "@/lib/poker/scoring";

function formatPct(w) {
  const pct = w * 100;
  return pct < 1 ? `${pct.toFixed(2)}%` : `${Math.round(pct)}%`;
}

function GridCell({
  cls, weight, expanded, onClickClass, onCloseClass, onCtrlClickClass, onDragStartClass, onDragEnterClass,
  comboWeights, onClickCombo, mode, excludedCards,
}) {
  const bg = weight <= 0 ? 'transparent' : `rgba(${ACCENT_RGB},${0.05 + weight * 0.55})`;
  const classFullyExcluded = excludedCards && excludedCards.length
    ? getClassCombos(cls).every(({ key }) => comboOverlapsCards(key, excludedCards)) : false;
  const showPct = mode === 'admin' && weight > 0;
  const touchTimer = useRef(null);
  const longPressFired = useRef(false);
  const clearTouchTimer = () => { if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; } };
  const closeTimer = useRef(null);
  const clearCloseTimer = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  return (
    <div
      onMouseDown={(e) => {
        if (classFullyExcluded || e.button !== 0) return;
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) onCtrlClickClass(cls);
        else onDragStartClass(cls);
      }}
      onMouseEnter={(e) => {
        clearCloseTimer();
        if (!classFullyExcluded && e.buttons === 1) onDragEnterClass(cls);
      }}
      onMouseLeave={() => {
        // Délai court : une case fait ~35px, donc le trajet souris vers le popup en dessous
        // traverse forcément un interstice hors de la case — un onMouseLeave immédiat refermait
        // le popup avant même d'avoir pu l'atteindre. Le délai laisse le temps de rentrer dedans
        // (le onMouseEnter ci-dessus annule alors ce timer).
        if (expanded) { clearCloseTimer(); closeTimer.current = setTimeout(() => onCloseClass(cls), 250); }
      }}
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
      title={classFullyExcluded ? `${cls} — impossible (cartes de Hero)` : `${cls}${showPct ? ` — ${formatPct(weight)} (moyenne de classe)` : ''} — glisser: remplir plusieurs cases · ctrl+clic: toute la ligne · clic droit: détail combos`}
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
            style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: 180 }}>
          <div style={{ fontFamily: "var(--font-space-grotesk), sans-serif", fontSize: 10, color: '#9C9691', marginBottom: 6 }}>
            {cls} — {mode === 'admin' ? 'poids par combo' : 'sélection par combo'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {getClassCombos(cls).map(({ pair, key }) => {
              const w = comboWeights[key] || 0;
              const excluded = comboOverlapsCards(key, excludedCards);
              return (
                <div key={key}
                  onClick={(e) => { e.stopPropagation(); if (!excluded) onClickCombo(key); }}
                  title={mode === 'admin' && w > 0 ? formatPct(w) : undefined}
                  style={{
                    background: excluded ? '#0A0C0E' : (w > 0 ? `rgba(${ACCENT_RGB},${0.05 + w * 0.55})` : '#1A1918'),
                    border: '1px solid #302D2A', borderRadius: 4, padding: '3px 2px',
                    textAlign: 'center', cursor: excluded ? 'not-allowed' : 'pointer', fontSize: 10,
                    opacity: excluded ? 0.35 : 1, fontFamily: "var(--font-ibm-plex-mono), monospace",
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

// mode: 'admin' (poids continus, molette) | 'play' (binaire, sélection élève) | 'reveal' (lecture seule + surbrillance du résultat)
export default function RangeGrid({ comboWeights, setComboWeights, mode, resultReveal, excludedCards }) {
  const [expandedClass, setExpandedClass] = useState(null);
  const [dragValue, setDragValue] = useState(null);

  useEffect(() => {
    const stop = () => setDragValue(null);
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const classWeight = useCallback((cls) => {
    const combos = getClassCombos(cls);
    const sum = combos.reduce((acc, { key }) => acc + (comboWeights[key] || 0), 0);
    return sum / combos.length;
  }, [comboWeights]);

  const setClassAll = (cls, value) => {
    setComboWeights(prev => {
      const next = { ...prev };
      getClassCombos(cls).forEach(({ key }) => { if (!comboOverlapsCards(key, excludedCards)) next[key] = value; });
      return next;
    });
  };

  const onClickClass = (cls) => setExpandedClass(prev => prev === cls ? null : cls);
  // Contrairement à onClickClass (qui bascule), ne ferme que si cette classe est encore celle
  // ouverte — évite qu'un timer de fermeture différée d'une case referme le popup d'une AUTRE
  // classe ouverte entre-temps.
  const onCloseClass = (cls) => setExpandedClass(prev => prev === cls ? null : prev);

  const onDragStartClass = (cls) => {
    const current = classWeight(cls);
    // En admin, un clic efface toujours (pratique pour repartir de zéro sur un poids importé du
    // solveur). En play/reveal, une sélection partielle faite via le popup détail-combo ne doit
    // pas être détruite par un simple clic : on complète la classe au lieu de la vider.
    const target = mode === 'admin' ? (current > 0 ? 0 : 1) : (current >= 1 ? 0 : 1);
    setDragValue(target);
    setClassAll(cls, target);
  };
  const onDragEnterClass = (cls) => { if (dragValue !== null) setClassAll(cls, dragValue); };

  const onCtrlClickClass = (cls) => {
    const lineClasses = getLineClasses(cls);
    const allKeys = lineClasses.flatMap(c => getClassCombos(c).map(x => x.key)).filter(k => !comboOverlapsCards(k, excludedCards));
    const allFull = allKeys.length > 0 && allKeys.every(k => (comboWeights[k] || 0) > 0);
    setComboWeights(prev => { const next = { ...prev }; allKeys.forEach(k => { next[k] = allFull ? 0 : 1; }); return next; });
  };

  const onClickCombo = (key) => setComboWeights(prev => ({ ...prev, [key]: prev[key] > 0 ? 0 : 1 }));

  return (
    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: 2, maxWidth: 480 }}>
      {expandedClass && (
        <div onClick={() => setExpandedClass(null)} onContextMenu={(e) => { e.preventDefault(); setExpandedClass(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 49, cursor: 'default' }} />
      )}
      {ALL_CLASSES.map(cls => {
        let cellBg = null;
        if (resultReveal) {
          const combos = getClassCombos(cls);
          const villainInClass = combos.some(c => c.key === resultReveal.villainKey);
          if (villainInClass) cellBg = resultReveal.found ? '#3FA05A' : '#C4544A';
        }
        return (
          <div key={cls} style={cellBg ? { outline: `2px solid ${cellBg}`, borderRadius: 3 } : undefined}>
            <GridCell cls={cls} weight={classWeight(cls)} expanded={expandedClass === cls}
              onClickClass={onClickClass} onCloseClass={onCloseClass} onCtrlClickClass={onCtrlClickClass}
              onDragStartClass={onDragStartClass} onDragEnterClass={onDragEnterClass}
              comboWeights={comboWeights} onClickCombo={onClickCombo}
              mode={mode} excludedCards={excludedCards} />
          </div>
        );
      })}
    </div>
  );
}
