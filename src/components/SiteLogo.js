// Marque du site (plateforme multi-outils), distincte du logo Find It! qui reste
// la marque du module d'entraînement à la lecture de range (voir components/Logo.js).
//
// Le dessin de Boris accompagne désormais le nom. Il est détouré, donc le pique de la barbe
// prend la couleur du fond : c'est voulu dans le dessin, et ça marche sur le crème du site.
export default function SiteLogo({ size = 20, avecDessin = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {avecDessin && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/marque/logo-192.png" alt="" style={{ height: Math.round(size * 2.1), width: "auto", display: "block" }} />
      )}
      <div style={{ lineHeight: 1.15 }}>
        <div className="titre" style={{ fontSize: size, fontWeight: 700 }}>
          Lebordelaii
        </div>
        <div style={{
          fontSize: Math.round(size * 0.42), fontWeight: 600, letterSpacing: 1.5,
          textTransform: "uppercase", color: "var(--accent)",
        }}>
          Training Room
        </div>
      </div>
    </div>
  );
}
