import Link from "next/link";

// Affiché par les exercices sur simulation quand le catalogue public/solved/sims.json est vide.
// Un catalogue vide est un état normal (sims retirées le temps d'en préparer de nouvelles), pas une
// panne : on ne le présente donc pas comme une erreur.
export default function SimsEnPreparation({ title }) {
  return (
    <div style={{ minHeight: "100vh", padding: 20, width: "100%", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>{title}</span>
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
      </div>
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Nouvelles simulations en préparation</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
          Cet exercice s&apos;appuie sur des simulations de solveur. Elles sont en cours de refonte et
          reviennent très bientôt.
        </div>
      </div>
    </div>
  );
}
