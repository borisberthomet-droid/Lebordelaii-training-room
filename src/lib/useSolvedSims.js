"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Chargement des simulations résolues, partagé par les quatre exercices qui s'en servent.
//
// Par défaut l'élève s'entraîne sur TOUTES les textures : choisir son board reviendrait à choisir
// sa difficulté, et un board familier ne fait plus travailler grand-chose. Le choix d'une texture
// précise reste disponible — c'est utile au coach pour travailler un board avec un élève.
//
// Les index sont chargés une fois puis gardés en mémoire ; seuls les spots eux-mêmes sont
// rechargés à chaque question.

export const TOUTES = "*";

// `aDesSpots` doit être une fonction STABLE (définie au niveau du module), sinon l'effet de
// chargement se relance à chaque rendu.
export function useSolvedSims(aDesSpots) {
  const [sims, setSims] = useState(null);       // catalogue, déjà filtré
  const [sim, setSim] = useState(TOUTES);
  const [indexes, setIndexes] = useState({});   // nom de sim -> index.json
  const [error, setError] = useState(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/solved/sims.json")
      .then((r) => { if (!r.ok) throw new Error(`catalogue introuvable (${r.status})`); return r.json(); })
      .then((liste) => {
        if (ignore) return;
        const utiles = aDesSpots ? liste.filter(aDesSpots) : liste;
        // Catalogue vide : les sims sont en préparation, ce n'est pas une panne.
        if (!utiles.length) setEmpty(true);
        else setSims(utiles);
      })
      .catch((e) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [aDesSpots]);

  const noms = useMemo(() => {
    if (!sims) return [];
    return sim === TOUTES ? sims.map((s) => s.name) : [sim];
  }, [sims, sim]);

  useEffect(() => {
    const manquants = noms.filter((n) => !indexes[n]);
    if (!manquants.length) return;
    let ignore = false;
    Promise.all(manquants.map((n) => fetch(`/solved/${n}/index.json`)
      .then((r) => { if (!r.ok) throw new Error(`index de ${n} introuvable (${r.status})`); return r.json(); })
      .then((idx) => [n, idx])))
      .then((paires) => { if (!ignore) setIndexes((prev) => ({ ...prev, ...Object.fromEntries(paires) })); })
      .catch((e) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [noms, indexes]);

  const prets = noms.length > 0 && noms.every((n) => indexes[n]);

  // Rassemble les spots de toutes les textures retenues, chacun marqué de sa sim d'origine :
  // c'est elle qui dit où aller chercher le fichier du spot et quelles blindes afficher.
  const rassembler = useCallback(
    (extraire) => noms.flatMap((n) => (indexes[n] ? (extraire(indexes[n]) || []).map((m) => ({ ...m, sim: n })) : [])),
    [noms, indexes]
  );

  return { sims, sim, setSim, indexes, prets, rassembler, error, empty };
}

// Libellé d'une texture dans le menu déroulant.
export function libelleSim(s, compte) {
  const board = s.fullBoard || (s.board || []).join(" ");
  return `${board} — ${s.effectiveBB} bb${compte != null ? ` — ${compte} spots` : ""}`;
}
