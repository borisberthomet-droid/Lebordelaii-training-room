// Marques vectorielles des outils, dans le même langage visuel que le logo
// Find It! (components/Logo.js) : dégradé vert #4ADE80→#059669, traits géométriques,
// fond sombre — pas d'emoji, pour un rendu cohérent et pas "généré par IA".

function Grad({ id }) {
  return (
    <defs>
      <linearGradient id={id} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#4ADE80" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>
  );
}

// Cadran à seuil : anneau plein (la range totale) + arc en dégradé (la portion qui
// franchit le seuil) + point central — évoque une fréquence/un ratio, pas une cible.
export function PotOddsIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="Pot Odds">
      <Grad id="po-grad" />
      <circle cx="16" cy="16" r="11" stroke="var(--border)" strokeWidth="3" fill="none" />
      <path d="M16 5 A11 11 0 0 1 26 19.5" stroke="url(#po-grad)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="16" r="2.5" fill="url(#po-grad)" />
    </svg>
  );
}

// Ligne de relevé (courbe de stats) dans un cadre — évoque l'analyse/le diagnostic
// sans passer par le stéthoscope littéral.
export function LeakAnalyzerIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="Leak Analyzer">
      <Grad id="la-grad" />
      <rect x="3" y="3" width="26" height="26" rx="7" stroke="var(--border)" strokeWidth="2" fill="none" />
      <path d="M6.5 19 L11 19 L14 11 L18 24 L21.5 15 L25.5 15" stroke="url(#la-grad)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// Barres de stats (le report H2N) avec une barre repérée en dégradé + point d'alerte —
// évoque le repérage d'un stat qui sort des clous, distinct du tracé de Leak Analyzer.
export function LeakfinderIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="Leakfinder">
      <Grad id="lf-grad" />
      <rect x="3" y="3" width="26" height="26" rx="7" stroke="var(--border)" strokeWidth="2" fill="none" />
      <rect x="8" y="17" width="4.5" height="8" rx="1.5" fill="var(--border)" />
      <rect x="14.25" y="11" width="4.5" height="14" rx="1.5" fill="url(#lf-grad)" />
      <rect x="20.5" y="15" width="4.5" height="10" rx="1.5" fill="var(--border)" />
      <circle cx="16.5" cy="7" r="1.8" fill="url(#lf-grad)" />
    </svg>
  );
}

// Mini-grille 3x3 (évoque le grid 13x13 de range) avec une diagonale en dégradé —
// distingue "construire/comparer une range" du cadran Pot Odds et du tracé Leak Analyzer.
export function RangeBuilderIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="Range Builder">
      <Grad id="rb-grad" />
      <rect x="3" y="3" width="26" height="26" rx="7" stroke="var(--border)" strokeWidth="2" fill="none" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => {
          const on = row <= col;
          return (
            <rect
              key={`${row}-${col}`}
              x={8 + col * 6} y={8 + row * 6} width="4.5" height="4.5" rx="1"
              fill={on ? "url(#rb-grad)" : "var(--border)"} opacity={on ? 1 - row * 0.22 : 0.5}
            />
          );
        })
      )}
    </svg>
  );
}

// Pile de jetons (stack) surmontée d'un anneau en dégradé (le bounty posé dessus) —
// évoque la valeur du KO empilée sur le stack, distinct des autres marques.
export function PkoRpIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="PKO — KO & RP">
      <Grad id="pko-grad" />
      <ellipse cx="16" cy="24" rx="10" ry="3.2" stroke="var(--border)" strokeWidth="2" fill="none" />
      <ellipse cx="16" cy="19" rx="10" ry="3.2" stroke="var(--border)" strokeWidth="2" fill="none" />
      <ellipse cx="16" cy="14" rx="10" ry="3.2" stroke="url(#pko-grad)" strokeWidth="2.25" fill="none" />
      <circle cx="16" cy="7" r="3.6" stroke="url(#pko-grad)" strokeWidth="2.25" fill="#121413" />
    </svg>
  );
}
