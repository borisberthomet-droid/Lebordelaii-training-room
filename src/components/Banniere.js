"use client";

// Bandeau photo : une image, un voile dégradé, un titre par-dessus.
//
// Le voile n'est pas de la décoration. Sans lui, la lisibilité du titre dépend de la photo — une
// zone claire et le texte disparaît. Avec un dégradé qui part du foncé côté texte, n'importe
// quelle image de la bibliothèque passe.
//
// Règle d'emploi : une photo derrière un titre et du vide, jamais derrière une grille, un tableau
// ou une table de poker. Ces écrans-là portent déjà de l'information par la couleur.

// Les photos préparées dans public/photos, avec ce qu'elles racontent.
export const PHOTOS = {
  table: "/photos/table-lunettes-bandeau.jpg",       // à la table, lunettes et capuche
  tableNutsr: "/photos/table-nutsr-bandeau.jpg",     // à la table, maillot NutsR
  tableSourire: "/photos/table-sourire-bandeau.jpg", // à la table, regard caméra
  coaching: "/photos/coaching-bandeau.jpg",          // en coaching devant les écrans
  bureau: "/photos/bureau-bandeau.jpg",              // au bureau, deux écrans
  jetons: "/photos/jetons-bandeau.jpg",              // jetons entre les doigts, sans visage
  portrait: "/photos/portrait-nb-bandeau.jpg",       // portrait noir et blanc
  studio: "/photos/studio-camera-bandeau.jpg",       // plateau du podcast
  plage: "/photos/plage-chien-bandeau.jpg",          // plage, sans visage
};

export default function Banniere({ photo, titre, sous, action, hauteur = 150, position = "center 40%" }) {
  return (
    <div style={{
      position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 18,
      minHeight: hauteur, display: "flex", alignItems: "flex-end",
      backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: position,
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg, var(--voile) 0%, var(--voile) 48%, var(--voile-fin) 96%)",
      }} />
      <div style={{
        position: "relative", padding: "18px 20px", display: "flex", width: "100%",
        justifyContent: "space-between", alignItems: "flex-end", gap: 14, flexWrap: "wrap",
      }}>
        <div>
          <div className="titre" style={{ fontSize: 26, fontWeight: 700, color: "var(--sur-photo)", lineHeight: 1.1 }}>
            {titre}
          </div>
          {sous && (
            <div style={{ fontSize: 12, color: "var(--sur-photo)", opacity: 0.82, marginTop: 5, maxWidth: 460, lineHeight: 1.6 }}>
              {sous}
            </div>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
