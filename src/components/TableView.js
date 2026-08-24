"use client";

import { useState } from "react";
import { ACCENT, getSeatPos, getChipPos } from "@/lib/poker/constants";

const BOARD_BG = { s: '#454B57', h: '#C0392B', d: '#2E6DA4', c: '#2F7A4F' };

// Couleurs façon dénomination réelle : blanc / rouge / bleu / vert / or, selon la taille de la mise
function chipColorForAmount(bb) {
  if (bb < 5) return '#ECEEF1';
  if (bb < 15) return '#D64545';
  if (bb < 40) return '#3F8FD1';
  if (bb < 100) return '#3FA05A';
  return '#E8A83C';
}
const CHIP_TEXT_COLOR = { '#ECEEF1': '#1A1918', '#D64545': '#FFFFFF', '#3F8FD1': '#FFFFFF', '#3FA05A': '#FFFFFF', '#E8A83C': '#1A1918' };

// Tuile de mise plate et colorée (même esprit que les cartes), la taille grandit avec le montant
function BetTag({ amountBB }) {
  const color = chipColorForAmount(amountBB || 0);
  const textColor = CHIP_TEXT_COLOR[color] || '#1A1918';
  const tier = amountBB < 5 ? 0 : amountBB < 15 ? 1 : amountBB < 40 ? 2 : amountBB < 100 ? 3 : 4;
  const dims = [
    { minWidth: 28, height: 18, fs: 10 },
    { minWidth: 32, height: 20, fs: 11 },
    { minWidth: 36, height: 22, fs: 11 },
    { minWidth: 40, height: 24, fs: 12 },
    { minWidth: 44, height: 26, fs: 13 },
  ][tier];
  return (
    <div style={{
      ...dims, borderRadius: 6, background: color, color: textColor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontFamily: "var(--font-ibm-plex-mono), monospace",
      boxShadow: '0 3px 10px rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.1)', padding: '0 5px',
    }}>
      {amountBB}
    </div>
  );
}

function BoardCard({ card }) {
  const rank = card[0], suit = card[1];
  return (
    <div style={{
      width: 44, height: 58, borderRadius: 8, background: BOARD_BG[suit],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 26, fontWeight: 800, color: '#F5F6F8', fontFamily: "var(--font-ibm-plex-mono), monospace",
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {rank}
    </div>
  );
}

function HoleCard({ card }) {
  const rank = card[0], suit = card[1];
  return (
    <div style={{
      width: 38, height: 50, borderRadius: 7, background: BOARD_BG[suit],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, fontWeight: 800, color: '#F5F6F8', fontFamily: "var(--font-ibm-plex-mono), monospace",
      boxShadow: '0 3px 8px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {rank}
    </div>
  );
}

function Seat({ position, stackBB, stackChips, action, bounty, dealer, highlight, profile }) {
  const [showChips, setShowChips] = useState(false);
  const PROFILE_COLORS = {
    'ELITE': '#E0645A', 'REG AGGRO': '#E8C547', 'AVG REG': '#9C9691', 'REG TIGHT': '#4FA8E0',
    'RECREA': '#2F6B4F', 'BALEINE': '#39FF6A', 'GTO': '#FFFFFF',
  };
  const profileColor = profile ? PROFILE_COLORS[profile] : null;
  const borderColor = profileColor || highlight || '#302D2A';
  const glow = (profileColor || highlight) ? `0 0 10px ${(profileColor || highlight)}66, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.4)';
  const clickable = stackChips != null;
  return (
    <div style={{
      background: '#211F1D', border: `2px solid ${borderColor}`, boxShadow: glow,
      borderRadius: 10, padding: '5px 8px', fontSize: 11, minWidth: 108, maxWidth: 132, position: 'relative',
    }}>
      {dealer && (
        <div style={{ position: 'absolute', top: -9, right: -9, width: 18, height: 18, borderRadius: '50%', background: '#ECEEF1', color: '#1A1918', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>D</div>
      )}
      {bounty && (
        <div style={{
          position: 'absolute', top: -9, left: -9, minWidth: 22, height: 22, borderRadius: '50%',
          background: '#1A1918', border: '2px solid #6FCF97', color: '#6FCF97', fontSize: 8, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
          fontFamily: "var(--font-ibm-plex-mono), monospace", padding: '0 2px', zIndex: 2,
        }}>{bounty}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginLeft: bounty ? 12 : 0 }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: '#9C9691', whiteSpace: 'nowrap', fontSize: 11 }}>{position || '—'}</div>
          {profile && <div style={{ fontSize: 8, color: profileColor, fontFamily: "var(--font-ibm-plex-mono), monospace", fontWeight: 700 }}>{profile}</div>}
        </div>
        <div
          onClick={() => clickable && setShowChips(v => !v)}
          title={clickable ? 'Clique pour voir le stack en jetons' : undefined}
          style={{
            fontFamily: "var(--font-ibm-plex-mono), monospace", color: '#ECEEF1', fontSize: showChips ? 13 : 15, fontWeight: 700,
            whiteSpace: 'nowrap', cursor: clickable ? 'pointer' : 'default',
            borderBottom: clickable ? '1px dotted rgba(242,153,74,0.5)' : 'none',
          }}
        >
          {showChips ? stackChips.toLocaleString('fr-FR') : `${stackBB || '—'} BB`}
        </div>
      </div>
      {action && (
        <div style={{ fontSize: 10, fontFamily: "var(--font-ibm-plex-mono), monospace", color: /all-?in/i.test(action) ? '#E0645A' : '#6FCF97', marginTop: 4 }}>{action}</div>
      )}
    </div>
  );
}

// Visuel de table circulaire (façon Wizard) : sièges positionnés par angle, board + pot au centre,
// jetons de mise sur un anneau à rayon fixe.
export default function TableView({ spot, heroCardsOverride, bets }) {
  const board = (spot.board || '').trim().split(/\s+/).filter(Boolean);
  const seats = spot.seats && spot.seats.length ? spot.seats : [];
  const n = seats.length || 1;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 11, fontFamily: "var(--font-ibm-plex-mono), monospace", color: '#9C9691', flexWrap: 'wrap' }}>
        <span>Blinds <span style={{ color: '#ECEEF1' }}>{spot.blindLevel || '—'}</span></span>
        <span>Average <span style={{ color: '#ECEEF1' }}>{spot.averageBB || '—'} BB</span></span>
        {spot.momentTournoi && <span style={{ background: '#302D2A', padding: '2px 8px', borderRadius: 10, fontFamily: "var(--font-space-grotesk), sans-serif" }}>{spot.momentTournoi}</span>}
      </div>
      <div style={{ position: 'relative', width: '100%', maxWidth: 680, aspectRatio: '4/3', margin: '0 auto' }}>
        <div style={{ position: 'absolute', inset: 0, border: '2px solid var(--border)', borderRadius: '50%', background: 'radial-gradient(ellipse at center, #17402B 0%, #0A1D13 75%)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', zIndex: 5 }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', minHeight: 58 }}>
            {board.length ? board.map((c, i) => <BoardCard key={i} card={c} />) : <span style={{ fontSize: 11, color: '#556070', alignSelf: 'center' }}>board —</span>}
          </div>
          {spot.potTotal != null && spot.potTotal !== '' && (
            <div style={{ marginTop: 6, display: 'inline-block', background: '#211F1D', border: '1px solid #302D2A', borderRadius: 20, padding: '4px 14px' }}>
              <span style={{ fontSize: 10, color: '#9C9691' }}>Pot </span>
              <span style={{ color: '#ECEEF1', fontFamily: "var(--font-ibm-plex-mono), monospace", fontWeight: 700, fontSize: 15 }}>{spot.potTotal} BB</span>
            </div>
          )}
        </div>
        {seats.map((s, i) => {
          const pos = getSeatPos(i, n);
          const holeCards = s.role === 'hero'
            ? (heroCardsOverride && heroCardsOverride.length === 2 ? heroCardsOverride : (spot.heroCombo ? [spot.heroCombo.slice(0, 2), spot.heroCombo.slice(2, 4)] : null))
            : null;
          const highlight = s.role === 'hero' ? ACCENT : (s.role === 'villain' ? '#E0645A' : undefined);
          return (
            <div key={i} style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {holeCards && holeCards.length === 2 && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <HoleCard card={holeCards[0]} /><HoleCard card={holeCards[1]} />
                </div>
              )}
              <Seat position={s.position} stackBB={s.stackBB} stackChips={s.stackChips} action={s.action} bounty={s.bounty} dealer={s.dealer} highlight={highlight} profile={s.profile} />
            </div>
          );
        })}
        {bets && seats.map((s, i) => {
          const amount = bets[s.name];
          if (amount == null || amount <= 0) return null;
          const chipPos = getChipPos(i, n);
          return (
            <div key={'bet' + i} style={{ position: 'absolute', left: chipPos.left, top: chipPos.top, transform: 'translate(-50%,-50%)', zIndex: 4 }}>
              <BetTag amountBB={amount} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
