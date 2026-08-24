export default function Logo({ size = 28, showWordmark = true, wordmarkSize = 20 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="Find It!">
        <defs>
          <linearGradient id="findit-logo-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4ADE80" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="6" height="6" rx="1.5" fill="url(#findit-logo-grad)" opacity="0.35" />
        <rect x="13" y="6" width="6" height="6" rx="1.5" fill="url(#findit-logo-grad)" opacity="0.55" />
        <rect x="6" y="13" width="6" height="6" rx="1.5" fill="url(#findit-logo-grad)" opacity="0.55" />
        <rect x="13" y="13" width="6" height="6" rx="1.5" fill="url(#findit-logo-grad)" opacity="0.75" />
        <circle cx="13" cy="13" r="9.5" stroke="url(#findit-logo-grad)" strokeWidth="2.5" fill="#121413" fillOpacity="0.55" />
        <line x1="20" y1="20" x2="27" y2="27" stroke="url(#findit-logo-grad)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {showWordmark && (
        <span style={{ fontSize: wordmarkSize, fontWeight: 700, letterSpacing: -0.3, color: "var(--text)" }}>
          Find It<span style={{ color: "var(--accent)" }}>!</span>
        </span>
      )}
    </div>
  );
}
