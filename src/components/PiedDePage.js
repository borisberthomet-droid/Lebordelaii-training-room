import Link from "next/link";

// Pied de page du site entier. Il existe pour une raison précise : les pages légales étaient
// jusqu'ici accessibles depuis le seul formulaire de connexion, c'est-à-dire depuis un écran
// qu'un élève déjà connecté ne revoit jamais. Une mention légale introuvable ne remplit pas son
// office.
//
// `marginTop: auto` le colle en bas même sur une page courte : le body est une colonne flex.
export default function PiedDePage() {
  return (
    <footer style={{
      marginTop: "auto", padding: "22px 24px",
      borderTop: "1px solid var(--border)",
      display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
      fontSize: 11, color: "var(--text-muted)",
    }}>
      <span>Lebordelaii Training Room</span>
      <Link href="/mentions-legales">Mentions légales</Link>
      <Link href="/confidentialite">Confidentialité</Link>
      <Link href="/cgv">Conditions de vente</Link>
      <a href="mailto:contact@lebordelaii.fr" style={{ marginLeft: "auto" }}>contact@lebordelaii.fr</a>
    </footer>
  );
}
