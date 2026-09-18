// Traduit un export PioSOLVER brut (scripts/pio/export-pio.ps1) dans la forme de données que
// buildSolvedSpots.mjs attend déjà. Un runout donne un dossier, comme une archive HRC : la chaîne
// existante (classement par équité, quintiles, spots de value, Find It, replayer) tourne ensuite
// sans être modifiée.
//
// Ce que Pio ignore et qu'il faut lui fournir : le préflop, les positions et la valeur d'une
// blinde. Pio ne connaît que « OOP » et « IP », un pot de départ et des tapis, en jetons.
//
// Usage :
//   node scripts/pio/pioVersHrc.mjs <export.txt> <dossier_sortie> [--bb 10] [--open 25]
//                                   [--oop BB] [--ip BU]
//
// Puis, pour chaque runout produit :
//   node scripts/buildSolvedSpots.mjs <dossier_sortie>/<runout> <nom-de-la-sim>
//   node scripts/buildFindItSpots.mjs <dossier_sortie>/<runout> <nom-de-la-sim>

import fs from "node:fs";
import path from "node:path";

const [source, sortie, ...reste] = process.argv.slice(2);
if (!source || !sortie) {
  console.error("usage : node scripts/pio/pioVersHrc.mjs <export.txt> <dossier_sortie> [--bb 10] [--open 25] [--oop BB] [--ip BU]");
  process.exit(1);
}
const opt = (nom, defaut) => {
  const i = reste.indexOf(`--${nom}`);
  return i >= 0 ? reste[i + 1] : defaut;
};
const BB = Number(opt("bb", 10));            // valeur d'une blinde, en jetons Pio
const SB = Math.round(BB / 2);
const OPEN = Number(opt("open", 20));        // mise préflop de celui qui ouvre, en jetons (2bb)
// Ante des MTT actuels : une seule ante, payée par la big blind. Elle fait partie du pot de départ
// annoncé par Pio, mais elle sort du tapis de la BB, pas de celui de tout le monde.
const ANTE = Number(opt("ante", 10));
const POSITIONS = ["UTG", "HJ", "CO", "BU", "SB", "BB"];
const iOOP = POSITIONS.indexOf(opt("oop", "BB"));
const iIP = POSITIONS.indexOf(opt("ip", "BU"));
if (iOOP < 0 || iIP < 0) throw new Error("positions inconnues");

// --- Lecture de l'export ------------------------------------------------------------------------
// Pio termine chaque ligne par une espace : sans le trim, un 1327e jeton vide apparaît.
const nombres = (ligne) => ligne.trim().split(/\s+/).map(Number);

const noeuds = new Map();
let mains = [], infoArbre = [];
{
  const lignes = fs.readFileSync(source, "utf8").split(/\r?\n/);
  let section = null, cible = null, tampon = [];
  const vider = () => {
    if (!section) return;
    if (section === "HAND_ORDER") mains = tampon.join(" ").trim().split(/\s+/);
    else if (section === "TREE_INFO") infoArbre = tampon.filter(Boolean);
    else if (section === "NODE") {
      noeuds.set(cible, {
        id: cible,
        type: tampon[0].trim(),
        board: tampon[1].trim().split(/\s+/).filter(Boolean),
        // [engagé OOP, engagé IP, pot de départ] — les engagements sont CUMULÉS depuis le flop.
        mises: nombres(tampon[2]),
      });
    } else if (section === "STRATEGY") noeuds.get(cible).strategie = tampon.filter((l) => l.trim()).map(nombres);
    else if (section === "RANGE_OOP") noeuds.get(cible).rOOP = nombres(tampon[0]);
    else if (section === "RANGE_IP") noeuds.get(cible).rIP = nombres(tampon[0]);
    tampon = [];
  };
  for (const ligne of lignes) {
    if (ligne.startsWith("### ")) {
      vider();
      const [s, ...r] = ligne.slice(4).split(" ");
      section = s; cible = r.join(" ");
    } else if (section) tampon.push(ligne);
  }
  vider();
}
if (mains.length !== 1326) throw new Error(`ordre des mains incomplet : ${mains.length} entrées`);

// --- Structure de l'arbre --------------------------------------------------------------------------
// Ordre des enfants chez Pio : mises et relances de la plus grosse à la plus petite, puis check ou
// call, puis fold. Vérifié sur un export réel : la propagation des ranges retombe sur celles de Pio
// à 3e-8 près.
const suffixe = (id) => id.slice(id.lastIndexOf(":") + 1);
const estCarte = (s) => /^[2-9TJQKA][shdc]$/.test(s);
const rangAction = (s) => (s.startsWith("b") && !estCarte(s) ? -parseInt(s.slice(1), 10) : s === "f" ? 2 : 1);
const enfantsDe = new Map();
for (const id of noeuds.keys()) {
  const coupe = id.lastIndexOf(":");
  if (coupe < 0) continue;
  const parent = id.slice(0, coupe);
  if (!noeuds.has(parent)) continue;
  if (!enfantsDe.has(parent)) enfantsDe.set(parent, []);
  enfantsDe.get(parent).push(id);
}
for (const [parent, liste] of enfantsDe) {
  if (noeuds.get(parent).type === "SPLIT_NODE") continue;           // cartes : l'ordre n'a pas de sens
  liste.sort((a, b) => rangAction(suffixe(a)) - rangAction(suffixe(b)));
}

// --- Runouts présents dans l'export ------------------------------------------------------------------
// Un SPLIT_NODE porte un enfant par carte ; l'export n'a suivi que les runouts demandés.
const runouts = [];
const ajouter = (turn, river) => {
  if (!runouts.some((r) => r.turn === turn && r.river === river)) runouts.push({ turn, river });
};
for (const [id, n] of noeuds) {
  if (n.type !== "SPLIT_NODE" || n.board.length !== 3) continue;
  for (const idTurn of enfantsDe.get(id) || []) {
    const turn = suffixe(idTurn);
    const rivers = new Set();
    const chercher = (courant) => {
      for (const enfant of enfantsDe.get(courant) || []) {
        if (noeuds.get(enfant).board.length === 5) rivers.add(suffixe(enfant));
        else chercher(enfant);
      }
    };
    chercher(idTurn);
    if (rivers.size === 0) ajouter(turn, null);
    else for (const river of rivers) ajouter(turn, river);
  }
}
if (!runouts.length) throw new Error("aucun runout trouvé dans l'export");

// --- Préflop synthétique ---------------------------------------------------------------------------
// Pio démarre au flop. Les exercices affichent une table et des montants en blindes : il faut donc
// reconstituer l'ouverture qui a créé ce pot. BU ouvre à 2bb, BB paie, avec l'ante et la small
// blind : 20 + 20 + 5 + 10 = 55 jetons, exactement le pot de départ annoncé par Pio.
const sequencePreflop = POSITIONS.map((_, i) => {
  if (i === iIP) return { player: i, type: "R", amount: OPEN, street: 0 };
  if (i === iOOP) return { player: i, type: "C", amount: OPEN - BB, street: 0 };
  return { player: i, type: "F", amount: 0, street: 0 };
});
const potPreflopAttendu = OPEN * 2 + SB + ANTE;
const potPio = Number((infoArbre.find((l) => l.startsWith("#Pot#")) || "#Pot#0").split("#")[2]);
if (potPio && potPio !== potPreflopAttendu) {
  console.warn(`ATTENTION : pot Pio ${potPio} jetons, préflop reconstitué ${potPreflopAttendu}. ` +
    `Ajuste --open, --ante ou --bb pour que les deux coïncident, sinon les montants affichés seront faux.`);
}

const STREET = (board) => board.length - 2;                          // 3 cartes -> street 1 (flop)
const acteur = (n) => (n.type === "OOP_DEC" ? iOOP : iIP);

// État à un nœud, reconstruit en suivant son identifiant : séquence d'actions et engagements.
// `debut` = ce que chaque joueur avait engagé au DÉBUT de la street courante, ce qui permet
// d'exprimer les montants comme HRC (une relance donne le total de la street, un call l'appoint).
function etatDe(id) {
  const seq = [...sequencePreflop];
  let courant = "r:0";
  let cartes = 3;
  const engage = { [iOOP]: 0, [iIP]: 0 };
  const debut = { [iOOP]: 0, [iIP]: 0 };
  for (const p of id.split(":").slice(2)) {
    if (estCarte(p)) {
      cartes++;
      debut[iOOP] = engage[iOOP];
      debut[iIP] = engage[iIP];
      courant = `${courant}:${p}`;
      continue;
    }
    const n = noeuds.get(courant);
    const siege = acteur(n);
    const autre = siege === iOOP ? iIP : iOOP;
    const street = cartes - 2;
    if (p === "f") {
      seq.push({ player: siege, type: "F", amount: 0, street });
    } else if (p.startsWith("b")) {
      const cumul = parseInt(p.slice(1), 10);
      seq.push({ player: siege, type: "R", amount: cumul - debut[siege], street });
      engage[siege] = cumul;
    } else {
      const aPayer = engage[autre] - engage[siege];
      if (aPayer > 0) {
        seq.push({ player: siege, type: "C", amount: aPayer, street });
        engage[siege] = engage[autre];
      } else {
        seq.push({ player: siege, type: "X", amount: 0, street });
      }
    }
    courant = `${courant}:${p}`;
  }
  return { seq, engage, debut };
}

// --- Conversion d'un runout -------------------------------------------------------------------------
function convertir({ turn, river }) {
  const carteVoulue = (carte, cartesBoard) => (cartesBoard === 4 ? carte === turn : carte === river);

  // Numérotation : 0 pour la racine, puis dans l'ordre de découverte.
  const numero = new Map([["r:0", 0]]);
  const ordre = ["r:0"];
  const file = ["r:0"];
  const suivants = new Map();                                        // id Pio -> enfants suivis (ou null)

  while (file.length) {
    const id = file.shift();
    const enfants = (enfantsDe.get(id) || []).map((enfant) => {
      const e = noeuds.get(enfant);
      // Un SPLIT_NODE est traversé : l'action du parent pointe directement sur le nœud de la street
      // suivante, comme dans une archive HRC où un seul runout existe.
      if (e.type !== "SPLIT_NODE") return enfant;
      return (enfantsDe.get(enfant) || [])
        .find((c) => carteVoulue(suffixe(c), noeuds.get(c).board.length)) || null;
    });
    suivants.set(id, enfants);
    for (const enfant of enfants) {
      if (!enfant || numero.has(enfant)) continue;
      numero.set(enfant, numero.size);
      ordre.push(enfant);
      file.push(enfant);
    }
  }

  const fichiers = [];
  for (const id of ordre) {
    const n = noeuds.get(id);
    if (!n.strategie) continue;                                      // END_NODE, ou SPLIT traversé
    const siege = acteur(n);
    const autre = siege === iOOP ? iIP : iOOP;
    const { seq, engage, debut } = etatDe(id);
    const rangeActeur = siege === iOOP ? n.rOOP : n.rIP;

    const hands = {};
    for (let i = 0; i < 1326; i++) {
      const poids = rangeActeur[i];
      if (!(poids > 1e-9)) continue;
      hands[mains[i]] = { weight: +poids.toFixed(6), played: n.strategie.map((l) => +l[i].toFixed(6)) };
    }

    const actions = (enfantsDe.get(id) || []).map((idEnfant, k) => {
      const s = suffixe(idEnfant);
      const cible = suivants.get(id)[k];
      let type = "X", amount = 0;
      if (s === "f") type = "F";
      else if (s.startsWith("b")) {
        type = "R";
        amount = parseInt(s.slice(1), 10) - debut[siege];
      } else if (engage[autre] > engage[siege]) {
        type = "C";
        amount = engage[autre] - engage[siege];
      }
      return cible != null && numero.has(cible)
        ? { type, amount, node: numero.get(cible) }
        : { type, amount };
    });

    fichiers.push({
      numero: numero.get(id),
      contenu: { player: siege, street: STREET(n.board), board: n.board.join(" "), sequence: seq, actions, hands },
    });
  }
  return fichiers;
}

// --- Écriture ------------------------------------------------------------------------------------
const tapisFlop = Number((infoArbre.find((l) => l.startsWith("#EffectiveStacks#")) || "#EffectiveStacks#0").split("#")[2]);
const settings = {
  handdata: {
    // Tapis de départ : chacun doit retrouver le tapis Pio une fois sa mise préflop payée. La big
    // blind part plus haut que les autres, puisque l'ante sort de son tapis.
    stacks: POSITIONS.map((_, i) => tapisFlop + OPEN + (i === iOOP ? ANTE : 0)),
    blinds: [BB, SB, ANTE],
    skipSb: false, movingBu: true, anteType: "BB", straddleType: "OFF",
  },
  eqmodel: { id: "chipev", structure: null },
  source: { solveur: "PioSOLVER", export: path.basename(source) },
};

fs.mkdirSync(sortie, { recursive: true });
for (const runout of runouts) {
  const nom = [runout.turn, runout.river].filter(Boolean).join("-").toLowerCase();
  const dossier = path.join(sortie, nom);
  fs.mkdirSync(path.join(dossier, "nodes"), { recursive: true });
  fs.writeFileSync(path.join(dossier, "settings.json"), JSON.stringify(settings, null, 1));
  const fichiers = convertir(runout);
  for (const f of fichiers) fs.writeFileSync(path.join(dossier, "nodes", `${f.numero}.json`), JSON.stringify(f.contenu));
  console.log(`${nom.padEnd(10)} ${fichiers.length} nœuds de décision -> ${dossier}`);
}
console.log(`tapis au flop ${tapisFlop} jetons (${(tapisFlop / BB).toFixed(1)} bb) · pot ${potPio} jetons (${(potPio / BB).toFixed(1)} bb)`);
