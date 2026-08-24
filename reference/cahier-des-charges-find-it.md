# Cahier des charges — Find It!
### Migration du prototype (artifact Claude) vers une application réelle

---

## 1. Contexte

**Find It!** est un outil d'entraînement à la lecture de range pour joueurs de poker MTT/PKO, développé par Boris (Lebordelaii / nutsR) en tant que coach. Un premier prototype fonctionnel a été construit sous forme d'artifact React dans Claude.ai (fichier `pko-socle.jsx`), validant l'ensemble de la logique produit avec de vraies hand history. Ce document décrit **ce qu'il faut reconstruire** pour en faire une vraie application web : comptes utilisateurs réels, base de données, hébergement public.

**Ce que l'artifact ne peut pas faire** (raison de la migration) :
- Pas de backend, pas de base de données relationnelle — seulement un stockage clé-valeur simple
- Pas d'authentification sécurisée (mot de passe, email de vérification, récupération de compte)
- Pas d'hébergement public indépendant de Claude.ai

**Ce que le prototype a déjà validé** (à ne pas re-designer, juste reconstruire) :
- Toute la logique de scoring et de génération de spots
- Le parseur de Hand History Winamax
- Le moteur de replay avec suivi précis des jetons
- L'ergonomie de la grille de sélection de range
- La direction artistique (voir section 12)

---

## 2. Concept produit : l'exercice "Find It!"

L'élève voit un spot de poker (contexte de tournoi, table, éventuellement une main rejouable action par action) où Hero a eu un showdown. Il doit **dessiner sur une grille 13×13 la range qu'il attribue à Vilain**, combo par combo (couleurs incluses). Le score dépend de deux choses :

1. **Gate** : le combo réel de Vilain doit être dans la sélection de l'élève, sinon score = 0
2. **Densité** : si trouvé, le score récompense la précision — une sélection large diluée rapporte moins qu'une sélection resserrée et juste

Deux modes :
- **Théorique** : Hero et Vilain sont tirés aléatoirement à chaque tentative (rejouable à l'infini), pondéré par une range de référence définie par le coach
- **Exploit** : un vrai showdown observé (main + combo fixes), jouable une seule fois par élève, avec rappel après 1 mois

---

## 3. Modèle de données

### `Spot`
```
{
  id: string
  nom: string
  mode: 'theorique' | 'exploit'
  heroCombo: string          // 4 caractères, ex "QcQd" — vide en mode théorique
  villainCombo: string       // idem — vide en mode théorique (tiré à l'exécution)
  weights: { [comboKey]: number }   // 0..1, poids de référence par combo (1326 clés possibles)
  timer: number              // secondes
  koValue: string
  ligne: string               // résumé texte de la ligne de jeu
  board: string               // cartes séparées par espace, ex "As Kd 7h"
  blindLevel: string
  averageBB: string
  nbInscrits: string
  potTotal: number
  buyIn: string
  format: string
  startingStack: string
  palier: string
  momentTournoi: string        // une des valeurs de MOMENT_OPTIONS (voir section 12)
  seats: Seat[]
  replay: Replay | null        // présent seulement si le spot vient d'un import de Hand History
  createdAt: timestamp
}
```

### `Seat`
```
{
  position: string      // ex "BTN", "UTG1" — voir POSITIONS_BY_COUNT section 12
  stackBB: number
  action: string         // dernière action affichée pour ce siège au nœud choisi
  bounty: string          // "10€"
  role: 'hero' | 'villain' | null
  profile: string         // une des valeurs de PROFILE_OPTIONS, ou vide
  dealer: boolean
  name: string            // pseudo réel du joueur, utile seulement si spot importé d'une HH
}
```

### `Replay` (uniquement pour les spots importés d'une Hand History)
```
{
  bb: number
  initialStacks: { [nomJoueur]: number }     // jetons, pas BB
  initialPot: number                          // jetons
  initialStreetCommit: { [nomJoueur]: number }
  steps: Step[]     // tronqué au nœud d'arrêt choisi par le coach — l'élève ne voit jamais au-delà
}
```

### `Step`
```
{
  street: 'PRE-FLOP' | 'FLOP' | 'TURN' | 'RIVER'
  player: string
  label: string              // ex "Raise to 4800", "All-in 45049", "Call 3450", "Check", "Fold"
  chipsIn: number             // jetons ajoutés par CETTE action précise
  potChips: number            // pot total après cette action
  stacksChips: { [nomJoueur]: number }   // snapshot complet après cette action
  streetCommit: { [nomJoueur]: number }  // combien chaque joueur a devant lui sur cette street, à cet instant
  board: string[]              // cartes visibles à ce moment
}
```

### `Attempt` (tentative d'un élève)
```
{
  spotId: string
  spotName: string
  mode: string
  pseudo: string          // ou userId si vrais comptes
  score: number
  found: boolean
  selectedCount: number
  referenceCount: number
  date: timestamp
}
```

### `User` (à créer pour la vraie version — n'existe pas dans le prototype)
```
{
  id: uuid
  email: string
  passwordHash: string
  pseudo: string
  role: 'admin' | 'student'   // le coach doit pouvoir créer/éditer des spots, pas les élèves
  createdAt: timestamp
}
```

---

## 4. Logique métier détaillée

### 4.1 Génération des combos

169 classes preflop (13 paires, 78 suited, 78 offsuit). Pour chaque classe :
- Paire : 6 combos (C(4,2) parmi les 4 couleurs)
- Suited : 4 combos (une par couleur)
- Offsuit : 12 combos (4×4 moins les 4 suited)

Total : 1326 combos uniques. Chaque combo a une clé stable = les deux cartes triées alphabétiquement et concaténées (ex `AhAs`).

### 4.2 Deny cards (cartes mortes)

Tout combo qui contient une des deux cartes de Hero est automatiquement exclu — du calcul de densité, du tirage aléatoire, et visuellement grisé/non-cliquable dans la grille (aussi bien côté admin que côté élève).

### 4.3 Tirage pondéré (mode théorique)

À chaque tentative :
1. Tirer la main de Hero **uniformément** parmi les 1326 combos (aucune contrainte)
2. Tirer le combo de Vilain **pondéré par les poids de référence**, en excluant les combos qui chevauchent les cartes de Hero

```js
function drawWeightedCombo(weights, excludeCards) {
  const entries = Object.entries(weights).filter(([k, w]) => w > 0 && !overlapsCards(k, excludeCards));
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
}
```

### 4.4 Formule de score

```
found = combo réel de Vilain ∈ sélection de l'élève
si !found → score = 0
sinon → score = round(100 × (Σ poids_référence des combos sélectionnés) / (nombre de combos sélectionnés))
```

Une sélection large qui dilue la densité moyenne est pénalisée même si elle contient le bon combo — c'est le mécanisme central qui empêche de "spammer" une sélection énorme pour maximiser les chances de toucher.

### 4.5 Mode exploit — verrou de rejouabilité

Un spot exploit ne peut être joué qu'une fois par élève, puis se reverrouille pour 30 jours (`Date.now() + 30*24*3600*1000`). Le score du dernier essai remplace l'ancien dans les classements, mais l'historique complet de l'élève conserve toutes ses tentatives passées pour visualiser sa progression.

---

## 5. Parseur de Hand History (Winamax)

Le format Winamax est un texte structuré avec des marqueurs `*** PRE-FLOP ***`, `*** FLOP *** [cartes]`, etc. Points d'attention critiques (bugs déjà rencontrés et corrigés dans le prototype, à ne pas réintroduire) :

- **Les stacks peuvent utiliser un séparateur de milliers** (espace normal ou insécable, ex `"44 867"`) — le parseur doit nettoyer tous les caractères non-numériques avant de convertir en entier, pas supposer un format `\d+` pur.
- **Ne JAMAIS chercher les lignes `Seat N: ...` sur le texte entier.** La section `*** SUMMARY ***` contient des lignes comme `Seat 5: MrLembergian (big blind) showed [...]` qui matchent accidentellement le même motif que les vraies lignes d'en-tête et créent des sièges fantômes. Toujours restreindre la recherche à la section avant le premier `***`.
- Format des lignes de siège : `Seat N: nom (stack[, Xbounty])`

### Extraction du Hero et du Vilain
- Hero = le joueur de la ligne `Dealt to X [cartes]`
- Vilain = déterminé par heuristique au(x) showdown(s) (`X shows [cartes]`), le premier joueur différent de Hero — **à vérifier manuellement par le coach avant sauvegarde**, ce n'est jamais garanti à 100%

### Suivi des jetons (le vrai cœur technique du parseur)
Pour chaque action (call/bet/raise), calculer précisément combien de jetons sont ajoutés :
- `calls N` / `bets N` → `chipsIn = N`
- `raises X to Y` → `chipsIn = Y - (montant déjà engagé par ce joueur sur cette street)`

Maintenir un objet `streetCommit` réinitialisé à chaque changement de street (sauf preflop, qui hérite des blinds), permettant de calculer le pot et les stacks restants à **n'importe quel instant précis de la main**, pas seulement à la fin.

---

## 6. Moteur de replay

Le coach choisit un **nœud d'arrêt** en naviguant action par action (flèches ← →, onglets par street) sur un aperçu live de la table. Une fois validé, seules les étapes jusqu'à ce nœud (inclus) sont sauvegardées dans `spot.replay.steps` — **l'élève ne peut jamais accéder aux actions qui suivent**, c'est ce qui garantit qu'il ne voit pas la suite de la main avant de répondre.

Côté élève, le même composant de navigation (flèches + onglets) permet de rejouer la main jusqu'au nœud, avec à chaque étape :
- Le board reconstruit (0 à 5 cartes selon la street)
- Les stacks recalculés en BB depuis les vrais jetons
- Le pot recalculé
- **Toutes les mises encore "en jeu" affichées simultanément** (pas seulement la dernière action) — chaque joueur ayant un `streetCommit > 0` à cet instant affiche sa mise, et ça reste affiché tant que l'action ne lui est pas revenue sur cette street. Réinitialisation au changement de street.

---

## 7. Interface & interactions

### Grille de sélection (13×13)
- **Clic gauche + glisser (mousedown/mouseenter)** : remplir/vider plusieurs cases d'affilée
- **Ctrl+clic** : sélectionne toute la ligne suited ou toute la colonne offsuit (même rang que la case cliquée), toggle
- **Clic droit** : ouvre le détail par couleur (4 combos suited, 6 paires, 12 offsuit), se ferme automatiquement quand la souris quitte la zone
- Distinction stricte bouton gauche/droit sur `mousedown` (`e.button !== 0` doit ignorer le clic droit, sinon il remplit ET ouvre le détail en même temps — bug rencontré)
- Poids visuel : couleur d'accent avec opacité proportionnelle au poids, texte blanc pur au-delà d'un seuil pour rester lisible sur fond saturé

### Table de jeu
- Disposition **circulaire** (sièges positionnés par angle, pas en grille), nombre de joueurs configurable 2 à 9
- Cartes de board et de main en tuiles colorées par couleur (pas de petits badges texte)
- Jetons de mise positionnés sur un **anneau à rayon fixe** (indépendant de la position exacte des sièges) pour ne jamais chevaucher le board, quel que soit le nombre de joueurs
- Badge KO en cercle débordant du coin du cadre joueur, bouton dealer symétrique de l'autre côté
- Stack cliquable : bascule entre affichage en BB et en jetons réels (utile seulement si `replay` présent)

### Profils adversaires
7 profils avec couleur dédiée (ELITE rouge, REG AGGRO jaune, AVG REG gris, REG TIGHT bleu, RECREA vert foncé, BALEINE vert fluo, GTO blanc), affectés par siège en même temps que le nombre de joueurs / positions / dealer, dans un seul flux d'édition.

---

## 8. Comptes utilisateurs & authentification — LE vrai chantier

C'est la partie qui n'existe pas du tout dans le prototype et qui justifie la migration.

**Besoins fonctionnels :**
- Inscription par email + mot de passe (ou magic link)
- Connexion / déconnexion / session persistante
- Récupération de mot de passe oublié
- Un rôle `admin` (le coach, peut créer/éditer des spots) distinct de `student`
- Profil utilisateur avec pseudo, historique complet, statistiques

**Recommandation** : ne pas coder l'authentification à la main. Utiliser un service dédié (ex Supabase Auth, Clerk, ou équivalent) qui gère nativement : hashage sécurisé des mots de passe, vérification email, sessions, réinitialisation — c'est un gain de temps énorme et beaucoup plus sûr que du fait-maison.

---

## 9. Stockage — du clé-valeur vers une vraie base de données

Le prototype utilise ces clés (à traduire en tables relationnelles) :

| Clé prototype | Devient (suggestion) |
|---|---|
| `spot:{id}` | Table `spots` |
| `spots:index` | Simple requête `SELECT * FROM spots` |
| `pseudo` (perso) | Colonne `pseudo` sur `users` |
| `my-history` (perso) | Table `attempts` filtrée par `user_id` |
| `players:{pseudo}` | Vue agrégée sur `attempts` (SUM/COUNT groupés par utilisateur) |
| `players:index` | Plus nécessaire (requête directe) |
| `leaderboard:{spotId}` | Vue agrégée sur `attempts` filtrée par `spot_id`, triée par score |
| `exploit-last:{spotId}` (perso) | Colonne `last_played_at` sur une table de liaison `user_spot_locks` |

Une vraie base relationnelle (Postgres typiquement) remplace avantageusement tout ce système de clés préfixées — les classements et statistiques deviennent de simples requêtes SQL au lieu de recalculs côté client.

---

## 10. Stack technique suggérée

- **Frontend** : React (la logique de composants du prototype est directement réutilisable — grille, table, replayer)
- **Backend + auth + base de données** : une plateforme "backend-as-a-service" (type Supabase) permet de couvrir auth + Postgres + stockage en un seul service, adapté à un projet solo/petite équipe sans avoir à gérer un serveur soi-même
- **Hébergement frontend** : Vercel ou équivalent

---

## 11. Plan de migration suggéré (phases)

1. **Socle** : setup projet, connexion base de données, auth (inscription/connexion/déconnexion)
2. **Portage de la logique** : moteur de grille, scoring, tirage pondéré, deny cards — reprendre le code du prototype quasi tel quel, juste remplacer les appels `window.storage` par de vraies requêtes base de données
3. **Portage du parseur HH + replayer** : la partie la plus technique, mais aussi la plus autonome (aucune dépendance à l'auth)
4. **Éditeur admin** : réservé au rôle `admin`
5. **Classements + historique personnel** : requêtes SQL agrégées
6. **Design final** : appliquer la direction artistique (section 12)

---

## 12. Référence : direction artistique et constantes actuelles

```js
// Couleurs
const ORANGE = '#E8A83C';        // accent doré (boutons, sélection, timer) — inspiré du logo Lebordelaii
const BG = '#1A1918';             // fond principal, anthracite neutre
const PANEL = '#211F1D';          // panneaux/cartes
const BORDER = '#302D2A';         // bordures, très discret
const TEXT_MUTED = '#9C9691';     // texte secondaire

// Exception : la table de jeu (le tapis ovale) reste en bleu marine
// radial-gradient(ellipse at center, #16233A 0%, #0B121F 75%)

// Couleurs de cartes (ne pas changer, valeur fonctionnelle)
const SUIT_COLOR = { s: '#ECEEF1', c: '#6FCF97', h: '#E0645A', d: '#4FA8E0' };

// Dénominations de jetons façon poker réel (fonctionnel, lié à la taille de la mise)
function chipColorForAmount(bb) {
  if (bb < 5) return '#ECEEF1';    // blanc
  if (bb < 15) return '#D64545';   // rouge
  if (bb < 40) return '#3F8FD1';   // bleu
  if (bb < 100) return '#3FA05A';  // vert
  return '#E8A83C';                 // or (même teinte que l'accent — unifié intentionnellement)
}

// Profils adversaires
const PROFILE_COLORS = {
  'ELITE': '#E0645A', 'REG AGGRO': '#E8C547', 'AVG REG': '#9C9691',
  'REG TIGHT': '#4FA8E0', 'RECREA': '#2F6B4F', 'BALEINE': '#39FF6A', 'GTO': '#FFFFFF',
};

// Positions par nombre de joueurs (offset 0 = BTN, sens horaire)
const POSITIONS_BY_COUNT = {
  2: ['BTN/SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO'],
};

// Moments du tournoi (nomenclature façon Winamax/GTOWizard)
const MOMENT_OPTIONS = [
  '100% restants', '75% restants', '50% restants', '25% restants',
  '18% restants', '16% restants', 'Proche bulle', '10% restants',
  '5% restants', '3 tables', '2 tables', 'Table finale',
];
```

Typographie : **Space Grotesk** (titres, labels) + **IBM Plex Mono** (chiffres, données — stacks, pot, timer, cartes).

---

## 13. Fichier de référence

Le fichier `pko-socle.jsx` (prototype complet fonctionnel, testé avec de vraies hand history) doit être fourni tel quel à Claude Code comme référence de départ — la majorité de la logique JavaScript (scoring, parseur HH, moteur de replay, composants de grille/table) est directement réutilisable, seule la couche de stockage (`window.storage` → vraie base de données) et l'authentification sont à reconstruire entièrement.
