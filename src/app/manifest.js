// Manifeste de l'application installable.
//
// Sans ce fichier, Windows et Chrome fabriquent l'icône du raccourci à partir de la favicon :
// 64 pixels, et surtout une image EN PORTRAIT, que le système rogne ou cerne de bandes. D'où
// l'icône décevante sur le bureau. Les images déclarées ici sont carrées (scripts d'origine :
// le logo posé au centre d'un carré au fond crème de la marque).
//
// `maskable` n'est pas un doublon : Android et Windows 11 découpent un cercle ou un carré arrondi
// dans l'icône, et tout ce qui dépasse de la zone sûre disparaît. Sa version a donc une marge
// beaucoup plus large, sans quoi la casquette et la pointe du pique se font couper.

export default function manifest() {
  return {
    name: "Lebordelaii Training Room",
    // Ce que Windows écrit sous l'icône : le nom complet y serait tronqué.
    short_name: "Training Room",
    description: "Entraînement poker MTT/PKO — lecture de range, pot odds, suivi de carrière",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    // Fond de l'écran de lancement, et teinte de la barre de titre de la fenêtre installée.
    background_color: "#E6DFDB",
    theme_color: "#5F6127",
    icons: [
      { src: "/marque/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/marque/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/marque/app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
