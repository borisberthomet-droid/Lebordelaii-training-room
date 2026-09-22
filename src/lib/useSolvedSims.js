"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Chargement des simulations résolues, partagé par les quatre exercices qui s'en servent.
//
// Par défaut l'élève s'entraîne sur TOUTES les textures : choisir son board reviendrait à choisir
// sa difficulté, et un board familier ne fait plus travailler grand-chose. Le choix d'une texture
// précise reste disponible — c'est utile au coach pour travailler un board avec un élève.
//
// Un cran au-dessus de la texture il y a le scénario — « SRP BTN vs BB 45bb », « P3B BB vs BU »…
// C'est un arbre de solveur différent, donc des ranges sans rapport : les mélanger ferait passer
// l'élève d'un monde à l'autre sans prévenir. Le menu n'apparaît qu'à partir de deux scénarios.
//
// Les index sont chargés une fois puis gardés en mémoire ; seuls les spots eux-mêmes sont
// rechargés à chaque question.

export const TOUTES = "*";

// `aDesSpots` doit être une fonction STABLE (définie au niveau du module), sinon l'effet de
// chargement se relance à chaque rendu.
export function useSolvedSims(aDesSpots) {
  const [catalogue, setCatalogue] = useState(null);   // catalogue complet, déjà filtré
  const [scenario, setScenario] = useState(TOUTES);
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
        else setCatalogue(utiles);
      })
      .catch((e) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [aDesSpots]);

  // Scénarios présents. Une texture construite avant ce champ n'en déclare aucun : la liste reste
  // vide, le menu reste caché, et rien n'est filtré.
  const scenarios = useMemo(
    () => [...new Set((catalogue || []).map((s) => s.scenario).filter(Boolean))].sort(),
    [catalogue]
  );

  const sims = useMemo(() => {
    if (!catalogue) return null;
    return scenario === TOUTES ? catalogue : catalogue.filter((s) => s.scenario === scenario);
  }, [catalogue, scenario]);

  // Changer de scénario peut retirer du menu la texture choisie : on retombe alors sur « toutes ».
  // Déduit au rendu plutôt que corrigé dans un effet — remettre l'état à jour ferait un aller-
  // retour de rendu pendant lequel la page chercherait une texture qui n'est plus proposée.
  const simChoisie = sim !== TOUTES && sims && !sims.some((s) => s.name === sim) ? TOUTES : sim;

  const noms = useMemo(() => {
    if (!sims) return [];
    return simChoisie === TOUTES ? sims.map((s) => s.name) : [simChoisie];
  }, [sims, simChoisie]);

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

  return {
    sims, sim: simChoisie, setSim, scenarios, scenario, setScenario,
    indexes, prets, rassembler, error, setError, empty,
  };
}

// Libellé d'une texture dans le menu déroulant.
export function libelleSim(s, compte) {
  const board = s.fullBoard || (s.board || []).join(" ");
  return `${board} — ${s.effectiveBB} bb${compte != null ? ` — ${compte} spots` : ""}`;
}
