"use client";

import { useEffect, useRef, useState } from "react";

// Chrono d'un exercice : une barre qui se vide, le temps restant en clair, et un appel à
// `onTempsEcoule` quand il ne reste rien. Demandé par Boris pour le Find It — cinq minutes pour
// dessiner une range, comme à la table où l'on n'a pas la nuit pour décider.
//
// Le parent donne une `key` qui change à chaque question : le composant se remonte, le chrono
// repart de zéro sans qu'un effet ait à remettre l'état à jour. `actif` passe à faux dès la
// validation, le décompte s'arrête là où il en était.

const MONO = "var(--font-ibm-plex-mono), monospace";

export default function Chrono({ secondes = 300, actif = true, onTempsEcoule }) {
  const [restant, setRestant] = useState(secondes);
  // La fonction de fin change à chaque rendu du parent ; la garder dans une ref évite de
  // relancer le décompte à chaque fois. L'écriture se fait dans un effet : pendant le rendu,
  // React interdit de toucher à une ref.
  const fin = useRef(onTempsEcoule);
  useEffect(() => { fin.current = onTempsEcoule; }, [onTempsEcoule]);

  useEffect(() => {
    if (!actif) return undefined;
    const debut = Date.now();
    const id = setInterval(() => {
      const reste = Math.max(0, secondes - Math.round((Date.now() - debut) / 1000));
      setRestant(reste);
      if (reste === 0) { clearInterval(id); fin.current?.(); }
    }, 250);
    return () => clearInterval(id);
  }, [secondes, actif]);

  const part = Math.max(0, Math.min(1, restant / secondes));
  const mm = Math.floor(restant / 60);
  const ss = String(restant % 60).padStart(2, "0");
  // Vert, puis ambre dans la dernière minute, puis rouge dans les dix dernières secondes.
  const couleur = restant <= 10 ? "#E0645A" : restant <= 60 ? "#E8B44A" : "var(--accent)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 4px" }}>
      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: MONO, color: couleur, minWidth: 54 }}>
        {mm}:{ss}
      </span>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--panel-2)", overflow: "hidden" }}>
        <div style={{
          width: `${part * 100}%`, height: "100%", background: couleur,
          transition: "width 0.25s linear",
        }} />
      </div>
    </div>
  );
}
