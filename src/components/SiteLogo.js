// Marque du site (plateforme multi-outils), distincte du logo Find It! qui reste
// la marque du module d'entraînement à la lecture de range (voir components/Logo.js).
export default function SiteLogo({ size = 20 }) {
  return (
    <div style={{ lineHeight: 1.15 }}>
      <div style={{ fontSize: size, fontWeight: 700, letterSpacing: -0.3, color: "var(--text)" }}>
        Lebordelaii
      </div>
      <div style={{ fontSize: Math.round(size * 0.42), fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent)" }}>
        Training Room
      </div>
    </div>
  );
}
