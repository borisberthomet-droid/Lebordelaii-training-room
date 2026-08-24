import Link from "next/link";
import Logo from "./Logo";

// En-tête partagé : logo + sous-titre de page à gauche, actions à droite.
// Passe showHome=false uniquement sur la page d'accueil elle-même.
export default function PageHeader({ subtitle, right, showHome = true }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Logo size={26} wordmarkSize={17} />
        {subtitle && (
          <>
            <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{subtitle}</span>
          </>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {right}
        {showHome && (
          <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            ← Accueil
          </Link>
        )}
      </div>
    </div>
  );
}
