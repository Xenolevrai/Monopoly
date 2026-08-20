# CLAUDE.md — carnet de bord du projet

Ce fichier est là pour qu'une session qui ouvre le dépôt sans rien savoir puisse
reprendre le travail sans tout relire. Il dit **ce qu'est le projet**, **comment
il est construit**, **ce qui est fait**, et **ce qui reste**.

---

## 1. Ce qu'est ce projet

Une plateforme de Monopoly multijoueur en temps réel, jouable dans un
navigateur, pour jouer **en famille et entre amis**. Usage strictement privé :
pas de vente, pas de diffusion publique. Les données de plateau et de cartes
sont relevées sur les boîtes physiques du propriétaire du dépôt.

Six éditions sont livrées. L'ajout d'un **reskin** doit se faire **sans toucher
une ligne de moteur** — c'est le contrat central de l'architecture, et
`spiderman-fr` en est la preuve la plus nette. Une boîte qui apporte de
véritables mécaniques nouvelles (`poudlard-points`, `spiderman-hasbro-fr`) fait
bouger le moteur, mais toujours par des **drapeaux génériques** lus dans
`edition.mechanics` ou `edition.factions` : jamais un `if (editionId === …)`.

| id | boîte | matière | victoire | particularité |
|---|---|---|---|---|
| `classic-fr` | Monopoly classique, plateau parisien | `table` | dernière en jeu | la référence — **20 pions** au choix |
| `harry-potter-fr` | Harry Potter (reskin Winning Moves), Gallions | `parchment` | dernière en jeu | règles classiques, noms Poudlard |
| `avengers-fr` | Marvel Avengers, M$ | `tech` | dernière en jeu | bases S.H.I.E.L.D. / QG Stark |
| `spiderman-fr` | Spider-Man Collector (Winning Moves), $ | `web` | dernière en jeu | reskin exact du classique : vilains, traceurs / tours de toile |
| `spiderman-hasbro-fr` | Spider-Man Hasbro, Bouffon Vert, $ | `web` | tout capturé **ou** dernière en jeu | **règles différentes** : pion hostile autonome, pièges, raccourcis, pouvoirs de héros |
| `poudlard-points` | Harry Potter Hasbro, points de maison | `night` | tout le plateau exploré | **règles différentes** : pas d'hôtel, pas d'hypothèque, pas d'élimination |

Chaque édition se joue **en français ou en anglais** ; la langue ne change que
les mots (noms de cases, textes de cartes, journal), jamais une règle. Cet
invariant est prouvé par `tests/locales.test.js`.

---

## 2. Démarrer

```bash
npm install
npm run build     # compile le client — à refaire après chaque pull
npm start         # http://localhost:3000
npm run check     # lint + 196 tests
```

Node 22+, ESM partout, workspaces npm (racine + `client`).

En développement, deux processus :

```bash
node server/index.js            # port 3000
cd client && npx vite --host    # port 5173, proxy /api et /socket.io vers 3000
```

**Dans un conteneur d'agent**, ces serveurs doivent être lancés en tâche de
fond via `run_in_background: true`. Un `&` en ligne se fait tuer (code 144).

---

## 2 bis. Déployer en continu (Render)

Pour un lien qui tourne 24h/24 sans dépendre d'un ordinateur personnel allumé,
`render.yaml` à la racine décrit un service Render complet — c'est un
Blueprint : sur render.com, « New » → « Blueprint », choisir ce dépôt et la
branche, Render propose de créer le service tel quel.

Deux choses que **le plan gratuit de Render n'offre pas**, et qui sont
indispensables ici :

- **un disque persistant**, monté sur `/data` (variable `MONOPOLY_DATA_DIR`,
  lue par `server/rooms.js`) — sans lui, chaque redéploiement ou redémarrage
  efface `server/data/` et toutes les parties sauvegardées disparaissent, sans
  la moindre erreur visible ;
- **l'absence de mise en veille** — le plan gratuit éteint le service après
  15 minutes d'inactivité, ce qui a le même effet qu'un redémarrage.

Les deux exigent le plan payant **Starter**. `render.yaml` déclare `plan:
starter` pour cette raison : ce n'est pas négociable avec un plan inférieur.

`server/index.js` expose déjà `/api/health`, utilisé comme `healthCheckPath`.

---

## 3. Architecture

```
shared/
  editions.js          catalogue + surcouche de langue (getEdition, editionOf, listEditions)
  editions/<id>/       board.json · groups.json · cards.json · edition.json · locales/en.json
  messages.js          phrases du journal, FR + EN, une fonction par clé
  schema.js            typedefs de l'état + fabriques
server/
  engine/index.js      dispatch + advanceFlow — le cœur
  engine/{movement,property,cards,auction,trade,money,turn,queries,log,rng}.js
  rooms.js             registre des parties, codes, sauvegarde disque
  sockets.js           passerelle Socket.io ↔ moteur
  bots/                les joueuses artificielles (voir §5 ter)
scripts/               train-bots.mjs · tune-bots.mjs — tournois et réglage
client/src/
  components/          Board, BoardSkin, Centerpiece, SpaceArt, SpaceIcons, Actions, Players…
  lib/                 board.js, i18n.js, theme.js, rulesText.jsx, useGame.js, useCinematic.js
tests/                 bots · contrast · data · editions · engine · locales · payment-flow · points-edition · server · simulation
docs/                  DATA_MODEL · MOTEUR · SERVEUR · CLIENT · ART_DIRECTION
```

### Les trois règles à ne pas casser

1. **Le serveur fait foi.** Le client n'a aucune règle ; il affiche un état et
   envoie des intentions. Toute logique vit dans `server/engine/`.
2. **L'état est du JSON pur.** Pas de `Map`, pas de `Set`, pas de classe, pas de
   date vivante — sinon la sauvegarde disque et la reprise cassent.
3. **`state.pending` est la seule règle de validation.** Une action n'est
   acceptée que si elle correspond à `pending.kind` *et* que l'actrice figure
   dans `pending.playerIds`. Deux exceptions volontaires : `MORTGAGE` et
   `SELL_BUILDING` n'ont **aucun garde-fou de `pending`** — on doit pouvoir
   réunir de l'argent à tout moment (voir §5).

### `advanceFlow` : l'ordre compte

`server/engine/index.js` centralise le « et maintenant ? ». L'ordre du début de
la fonction est délicat et a déjà causé un bug :

```js
if (state.phase === 'finished') return;
// la victoire par exploration se teste AVANT les gardes de pending, sinon
// l'invite « fin de tour » posée juste avant court-circuite le test
if (edition.winCondition === 'allLocationsExplored' && checkGameOver(state)) return;
if (state.debt) return;
if (state.pending.kind) return;
```

---

## 4. Ajouter une édition

1. Créer `shared/editions/<id>/` avec `board.json`, `groups.json`,
   `cards.json`, `edition.json`, `locales/en.json`.
2. Déclarer l'édition dans `SOURCES` (`shared/editions.js`).
3. Dessiner les pions manquants dans `client/src/components/TokenIcon.jsx` et
   les illustrations de cases dans `SpaceArt.jsx`. Un identifiant de pion doit
   être **en minuscules sans majuscule interne** (`sac`, pas `sacArgent`) : le
   test qui vérifie que chaque pion est dessiné relit le fichier avec
   `/^ {2}([a-z]+):\s*\(/`, et un `camelCase` lui échapperait — le pion
   passerait le test tout en s'affichant comme une pastille neutre.
4. `npm test` : `tests/editions.test.js` vérifie tout seul la numérotation du
   plateau, les groupes, la croissance des loyers, les cibles des cartes, la
   présence des pions et des pictogrammes, la palette complète — et **joue une
   partie entière** sur la nouvelle édition.

**Le nombre de pions n'est plus lié au nombre de places.** Une édition doit en
déclarer *au moins* autant que `playerCount.max`, et peut en déclarer beaucoup
plus : le classique en propose vingt (la voiture, le chien, la chaussure, le
fer, le canon, le cavalier, le sac d'argent, la bourse, le cheval à bascule,
le T. rex, le canard, le manchot — plus l'avion et le trésor, deux pièces hors
gamme officielle ajoutées à la demande). Deux pions ne peuvent partager ni un
identifiant ni une couleur : sur le plateau, ils seraient indiscernables. Les
tests vérifient les trois points. Au-delà de neuf pions, l'écran de sélection
resserre sa grille et la fait défiler plutôt que de repousser le bouton
« créer une partie » hors de l'écran.

Rien d'autre. Si le moteur doit bouger, c'est que la mécanique manque à
`edition.mechanics` : ajouter le drapeau, pas un `if (editionId === …)`.

**Cas d'école : `spiderman-fr`.** La boîte Collector reprend le plateau
classique case pour case — mêmes positions, mêmes prix, mêmes coûts de
construction. Seuls les prix d'achat figurent sur les cartes de la boîte ; les
tables de loyers ont donc été reprises de `classic-fr`, ce qui n'est légitime
que parce que la superposition est exacte. Un test le vérifie et le fige
(« Spider-Man reprend case pour case la géométrie et les prix du plateau
classique ») : si un prix diverge un jour, il tombe, et la reprise des loyers
redevient une question ouverte. Les illustrations de case réutilisent la
bibliothèque existante de `SpaceArt.jsx` plutôt que d'en dessiner de
nouvelles ; seuls les six pions ont été dessinés.

---

## 5. Les extensions : des modificateurs posés sur une édition

`shared/extensions.js` — un système de fusion distinct des éditions. Une
extension n'est pas un plateau complet : c'est un **delta** (cases qui
changent de nature, paquets retirés/ajoutés, mécaniques activées, réglages
maison forcés) appliqué à l'édition choisie à la création de la partie.
`EXTENSIONS` contient les trois extensions Hasbro 2025 :

- **`free-parking-jackpot`** (Parc Gratuit Jackpot) : Chance et Caisse de
  communauté deviennent des cases Spin (nouveau paquet, 8 cartes), la cagnotte
  du Parc Gratuit devient permanente.
- **`go-to-jail`** (Prison) : les deux cases taxes envoient en prison,
  l'ancienne case « Allez en prison » devient une geôle plus sévère (Super
  Jail, caution 200 €, paquet Super Corruption), Chance/Caisse deviennent
  Évasion/Casse, trois doubles n'envoient plus en prison. ⚠️ Détails relevés
  sur des sources secondaires (pas le livret Hasbro officiel) — à vérifier
  contre une boîte physique si l'utilisateur en possède une.

- **`buy-everything`** (Tout Acheter) : Départ, Prison et Parc Gratuit
  portent un titre de propriété achetable (type de case `landmark`, groupe
  `landmark`) ; un coffre de trois cartes Vente reste retourné au centre
  (`mechanics.saleVault`) ; un dé d'Achat facultatif (`mechanics.buyDie`), une
  fois par jet et après la case résolue, donne une carte du coffre sur une face
  haute ou en fait perdre une à une adversaire sur une face basse ; les cartes
  Vente sont rouges (pouvoir à usage unique, jouable via `PLAY_SALE_CARD`),
  jaunes (`perTurn`, appliqué à chaque `startTurn`) ou vertes (`victory`,
  condition déclarative testée dans `advanceFlow`) ; toute case achetable
  franchie sans s'y arrêter part aux enchères (`mechanics.auctionOnPass`).
  ⚠️ Mêmes réserves que Prison : chiffres et effets relevés sur des sources
  secondaires, à relire contre la boîte physique. **La « Banque » de la boîte
  n'est pas représentée** : c'est un présentoir central, pas une case, et notre
  modèle n'a que 40 cases.

Le contrat à tenir, identique à celui des éditions : **le moteur ne connaît
jamais une extension par son nom**. Tout passe par des mécanismes déjà
génériques ou rendus génériques pour l'occasion :

- une case dont le `type` correspond au nom d'un paquet existant (`state.decks`)
  déclenche un tirage — `movement.js` ne connaît plus la liste figée
  `chance`/`community_chest`, il regarde si un paquet de ce nom existe ;
- `cards.js` calcule la liste des paquets sur l'édition fusionnée
  (`Object.keys(cardsOf(state))`), plus de tableau `DECKS` figé ;
- la fusion (`applyExtensions`) sait désormais superposer, en plus de
  `board`/`cards`/`mechanics`, des surcouches sur `edition.jail` (caution,
  case, geôle sévère), `edition.dice` et `edition.houseRules` — une extension
  peut donc changer la caution de sortie de prison ou activer la cagnotte du
  Parc Gratuit sans qu'aucune ligne du moteur ne le sache ;
- des drapeaux génériques dans `mechanics` pilotés par cette fusion :
  `doublesNeverJail` (trois doubles ne mènent plus en prison), `saleVault`,
  `buyDie`, `auctionOnPass`, `saleVictory` — tous lus sur la configuration,
  jamais sur `extensionId === …` ; et le fait qu'une geôle porte un
  `jail.deck` remplace, à `startTurn`, le jet de dés d'évasion par un choix
  payer/tirer une carte ;
- `OWNABLE_TYPES` (`shared/editions.js`) accueille un quatrième type,
  `landmark` : un titre posé sur une case qui n'en portait pas. Il s'achète,
  s'hypothèque et rapporte un loyer fixe, mais ne se construit pas (`canBuild`
  exige `type === 'property'`). Aucune édition de base n'en contient : le type
  reste inerte partout ailleurs ;
- la fusion sait aussi ajouter des **groupes** (`addsGroups`) — un titre a
  besoin d'un groupe pour s'afficher dans le panneau des biens ;
- une case peut nommer son propre pictogramme (`icon` dans `boardOverrides`) :
  c'est ce qui permet à Départ devenu achetable de garder sa flèche plutôt que
  de prendre le symbole générique de son nouveau type.

`shared/schema.js` avait deux bugs latents corrigés à cette occasion :
`settings` et `decks` se construisaient sur l'édition **non fusionnée** —
une extension changeant une règle maison ou les paquets de cartes n'aurait
donc jamais été prise en compte à la création de la partie.

Écran de sélection : `Lobby.jsx` lit `compatibleExtensions()` pour proposer
les cases à cocher compatibles avec l'édition choisie, et
`conflictingPositions()` pour griser celles qui se marcheraient sur les mêmes
cases avec ce qui est déjà coché. Aujourd'hui : Jackpot et Prison se marchent
toutes deux sur Chance/Caisse de communauté ; Jackpot et Tout Acheter se
disputent le Parc Gratuit (case 20). **Prison + Tout Acheter est la seule
combinaison à deux autorisée**, et elle est testée.

Tests : `tests/extensions.test.js`.

---

## 5 bis. Le pion qui joue tout seul (`mechanics.hazardPawn`)

`spiderman-hasbro-fr` est la première boîte où **un adversaire n'est tenu par
personne**. Tout passe par la configuration, jamais par un nom d'édition —
`server/engine/hazard.js` ne sait pas qu'il anime un Bouffon Vert.

```json
"hazardPawn": { "label": "Bouffon Vert", "start": 30,
                "faces": [1,2,2,3,3,"chase"], "penalty": 50, "dropsOnOwnedOnly": true }
```

- Il joue **après chaque tour de joueuse** (`endTurn`, qui reçoit le `rng` pour
  ça). Une face `"chase"` le fait foncer sur la joueuse la plus proche.
- Là où il s'arrête, il pose un piège — sauf sur une case **construite** : c'est
  ce qui donne aux constructions un rôle défensif en plus du loyer.
- Une case piégée ne rapporte **aucun loyer** et coûte la pénalité à qui s'y
  arrête ; le piège se **consomme** alors. Elle reste **achetable**.

⚠️ **Deux lectures assumées, mesurées puis corrigées** — la boîte ne tranche pas :

1. *Qui nettoie un piège ?* La boîte dit la case verrouillée « tant qu'elle
   n'est pas nettoyée » sans dire par qui. Sans consommation, les pièges
   s'accumulaient jusqu'à verrouiller la moitié du plateau.
2. *Piège-t-on les cases libres ?* L'effet est décrit du point de vue du
   propriétaire (« son propriétaire ne peut plus toucher de loyer ») : on ne
   piège donc que ce qui est possédé. En piégeant aussi les cases libres, les
   captures s'étranglaient — 6 à 10 vilains capturés sur 28 en fin de partie, et
   la victoire « tout capturé » ne tombait jamais.

Avec les deux réglages actuels, sur six graines : 87 à 169 tours, 28/28
capturés dans la plupart des parties, les deux fins possibles se déclenchent.
**Si ces règles sont relues sur la boîte physique, refaire cette mesure** — le
script tient en vingt lignes autour de `dispatch`.

### Les pouvoirs de héros passent par `factions`

Chaque héros est un camp qui porte un drapeau que le moteur lit sans savoir de
qui il s'agit : `rerollDice` (le jet est proposé avant résolution, via un
`pending` de type `reroll`), `clearsHazardOnLand`, `freeWarp`, `peekDeck`
(le texte de la carte du dessus arrive dans le `payload` du `pending` `roll`),
`rentWaiverPerLap` (compteur `player.rentWaivers`, rechargé au passage du
Départ), `buildCostFactor`. Un test refuse tout héros dont le pouvoir décrit
ne serait branché à aucun drapeau.

### Les raccourcis (`mechanics.warpSpaces`)

Une case de type `warp` propose de se balancer jusqu'au **prochain raccourci du
plateau**, contre un prix. ⚠️ La boîte dit « la case de toile opposée » ; avec
trois raccourcis il n'y a pas d'opposée évidente, d'où l'enchaînement. Le prix
lui-même est une inférence : la boîte ne le chiffre pas, elle dit seulement que
Ghost-Spider s'en dispense.

Tests : `tests/hazard-edition.test.js`.

---

## 5 ter. Les bots (`server/bots/`)

Quatre niveaux — facile, moyen, difficile, expert — qu'on ajoute au salon comme
une joueuse de plus. Le contrat est le même que pour tout le reste : **le moteur
ne sait pas ce qu'est un bot**. Un bot est une fonction pure
`(state, playerId) => action`, et son coup passe par `dispatch` comme celui
d'une humaine — il ne peut donc rien faire d'illégal, et un test le vérifie sur
une partie entière.

```
odds.js       fréquence de visite de chaque case, MESURÉE sur le plateau joué
evaluate.js   ce qu'une case vaut pour cette joueuse-là (rendement, groupe, blocage)
cards.js      ce que vaut chaque effet de carte, chaque choix, chaque case d'arrivée
negotiate.js  proposer un échange, juger celui qu'on reçoit
profiles.js   les quatre niveaux, en chiffres
brain.js      l'aiguillage : une action pour l'invite en cours
runner.js     la seule pièce qui sait qu'un bot existe (côté serveur)
```

### Ce qui fait la force d'un bot

**Il mesure le plateau au lieu de le connaître.** `odds.js` fait tourner une
marche aléatoire sur le plateau *réellement joué* — extensions comprises — et en
tire la fréquence de visite de chaque case. Il retrouve seul le résultat connu
du Monopoly : la prison est le puits (9,3 % des visites) et l'orange, à un jet
de sa sortie, bat la rue de la Paix. **Ne pas remplacer par une table écrite à
la main** : elle serait fausse dès qu'une édition déplace la prison ou qu'une
extension change les cases taxes en « allez en prison ».

**Un seul cerveau, quatre réglages.** Pas de code « facile » et de code
« expert » à maintenir en double. Tout tient dans `profiles.js`, plus deux
imperfections volontaires : `noise` (bruit de jugement) et `blunderRate` (bourde
franche). Un bot faible ne joue pas au hasard — il voit la bonne action et en
joue une autre, comme une débutante.

### Entraîner

```bash
node scripts/train-bots.mjs --games 300          # tournoi de contrôle
node scripts/tune-bots.mjs --level expert --rounds 20 --games 44
```

`tune-bots.mjs` est une montée de colline : il secoue les paramètres d'un
profil, fait jouer la variante contre la version en place, et garde ce qui
l'emporte **à plus de 53 %** — en dessous, l'écart se confond avec le bruit. Les
réglages retenus s'affichent à la fin, à recopier dans `profiles.js`. **Relancer
après toute retouche à `evaluate.js` ou `cards.js`.**

Mesure de référence (100 parties à quatre, sièges tournants) : expert 54 %,
difficile 26 %, moyen 20 %, facile 0 %, pour 25 % au hasard.

### Pièges déjà rencontrés ici

- **Les boucles de propositions.** Un bot qui repropose un marché refusé fige la
  partie : mesuré à 2 800 propositions pour 90 tours joués. Deux garde-fous dans
  `brain.js` — jamais deux fois la même offre, et pas plus d'une par tour de
  table. Même piège pour l'arrangement de dette, qui ne se tente qu'une fois.
- **Toutes les boîtes n'ont pas toutes les règles.** La Coupe des Quatre Maisons
  ignore l'hypothèque ; le bot en réclamait une quand même, 4 852 refus sur une
  partie qui ne finissait jamais. Lire `mechanics.*` comme le fait le moteur.
- Le champ de dette s'appelle `debt.debtorId`, **pas** `debt.playerId`.
- Les entrées du journal portent l'autrice dans `entry.data.playerId`, pas à la
  racine — un test qui cherche `entry.playerId` ne trouvera jamais rien.

---

## 6. Le point sensible : réunir de l'argent

Un défaut signalé en jouant a laissé des tests dédiés
(`tests/payment-flow.test.js`, 6 cas). L'invariant à préserver :

- on peut **hypothéquer et revendre à tout moment**, y compris pendant une
  invite d'achat ou pendant une dette, autant de fois qu'on veut ;
- **rien n'est prélevé d'office** : une dette ne se referme que sur `PAY_DEBT`
  ou sur un arrangement accepté ;
- l'argent réuni est **immédiatement utilisable**. Côté client, `Actions.jsx`
  compare `me.cash >= payload.price` en direct — et surtout **pas**
  `payload.canAfford`, qui est un cliché pris à l'arrivée sur la case et qui
  restait faux après une hypothèque (c'était exactement le bug remonté) ;
- on peut **enchaîner** : hypothéquer deux biens, puis proposer un arrangement,
  puis payer.

---

## 7. Le plateau : géométrie et typographie

`client/src/components/Board.jsx` — la partie la plus piégeuse du client.

- La grille fait 11 × 11, les coins valent `CORNER_SPAN = 1.55fr`.
- Chaque case est un **conteneur** (`containerType: 'size'`) ; le contenu tourne
  vers le centre.
- **Seules les cases des côtés gauche/droit échangent largeur et hauteur**
  (rotation d'un quart de tour). À 0° et à 180°, la case garde sa largeur —
  l'échanger débordait les noms d'un tiers et coupait « HIBOU EXPRESS ».
- La taille du texte est réglée **une seule fois** sur le conteneur tourné, en
  `cqw` (haut/bas/coins) ou `cqh` (gauche/droite) ; les enfants s'expriment en
  `em`.
- `nameScale()` réduit les noms longs, sur deux contraintes : le mot le plus
  long doit tenir sur une ligne (8 lettres à taille nominale), et le nom entier
  ne doit pas chasser le prix hors de la case (15 caractères).

Le décor vit dans `BoardSkin.jsx` (grain, filigranes, cadre, vignetage) et
`Centerpiece.jsx` (blason, château, emblème). Tout est du SVG écrit à la main :
aucune ressource externe, le jeu tourne hors ligne.

---

## 7 bis. Les couleurs : deux encres, jamais une

Une édition a **deux fonds de texte différents**, et il lui faut donc deux
encres :

- `panel` / `ink` — les panneaux latéraux, toujours clairs ;
- `space` / `spaceInk` — les fiches de propriété, qui peuvent être **sombres**
  (les deux boîtes Spider-Man) alors que les panneaux restent clairs.

Confondre les deux a produit le pire défaut visuel du projet : `spaceInk`
n'existait pas, la fiche prenait `ink`, et l'on obtenait du texte à **1,01:1** —
rigoureusement invisible.

**Le piège général, à connaître avant de toucher une couleur** : un composant
qui pose un **fond fixe** (la carte piochée, la face d'un dé) doit poser une
**encre fixe**. S'il utilise `text-ink`, il hérite de l'encre du thème — claire
sur les plateaux sombres — et disparaît sur son propre fond clair. C'est ce qui
rendait les cartes vierges et les dés sans points.

`tests/contrast.test.js` mesure les sept paires fond/encre de chaque édition
avec la formule de luminance du WCAG et exige le seuil AA (4,5:1). Ajouter une
édition sans y penser fera tomber ce test — c'est voulu.

Le bandeau d'une case choisit son encre sur **sa propre couleur de groupe**
(`readableOn`, dans `Actions.jsx`) : une encre fixe est illisible sur le jaune
ou sur le bleu nuit.

---

## 7 ter. La colonne de droite se réarrange

`client/src/components/PanelStack.jsx` — quatre sections (votre tour, vos biens,
les joueuses, le journal et le chat) qu'on replie et qu'on déplace, à la souris
par la poignée ou avec deux flèches (un `draggable` ne se déclenche pas au
doigt). L'agencement vit dans `localStorage`, pas dans l'état de la partie : il
appartient à l'écran, pas à la partie.

Deux détails qui ont coûté un bug chacun :

- les sections portent **`shrink-0`**. La colonne est un conteneur flex de
  hauteur fixe : sans lui, chaque section se fait comprimer au lieu de laisser
  la colonne défiler, et `overflow-hidden` rogne le contenu ;
- la visibilité par onglet sur téléphone passe par une **classe** posée sur
  chaque section (`section.className`), jamais par un filtrage de la liste :
  filtrer changerait l'ordre gardé.

---

## 8. Mobile et ordinateur

- **Ordinateur (≥ `xl`)** : aucun onglet. Plateau à gauche, panneau à droite,
  comme à l'origine.
- **Téléphone** : trois onglets — **Jeu** (plateau *et* boutons d'action dans la
  même vue : on lance les dés, on voit la case, on achète sans changer
  d'onglet), **Profil** (ses biens), **Journal**.

Le basculement se fait par classes Tailwind dans `client/src/App.jsx`
(`xl:contents` / `hidden`), jamais par détection d'agent.

---

## 9. Langues

- Journal serveur : `shared/messages.js` + `say(state, key, params)`.
  **Ne jamais coudre de mot français dans une phrase traduite** — les motifs de
  paiement ont leurs propres clés (`reasonRent`, `reasonBail`, …) pour ça.
- Client : `client/src/lib/i18n.js` (`translator(locale)`, `useT(state)`) et
  `rulesText.jsx` pour l'écran de règles.
- Un test relit un journal de partie entière en anglais avec une expression
  régulière sur les mots français : toute fuite est attrapée.

---

## 10. Pièges déjà rencontrés (ne pas les refaire)

- Le compteur du journal doit vivre dans `state.logSeq`, **pas** en variable de
  module : sinon un redémarrage réutilise des identifiants et React fige la
  liste.
- Les dés s'animent sur `dice.rollId`, **pas** sur `state.version`.
- Pour faire défiler un panneau, écrire `el.scrollTop = el.scrollHeight` sur son
  propre conteneur ; `scrollIntoView` remonte toute la page.
- Les champs de montant sont en `type="text" inputMode="numeric"` avec
  nettoyage des zéros de tête (`0350`).
- Un `viewBox` avec `preserveAspectRatio="none"` déforme les cercles : les
  étoiles sont des `<span>` dimensionnés en pixels.
- Le repli de `TokenIcon` doit être un cercle neutre : un repli sur le chapeau
  faisait croire que six pions étaient dessinés alors qu'aucun ne l'était.
- Côté client, `editionFor()` (`lib/board.js`) doit passer par `editionOf()`,
  **pas** `getEdition()` : sinon le client dessine le plateau d'origine pendant
  que le serveur en joue un autre — cases Spin affichées « Chance », titres
  spéciaux invisibles. Même piège dans le salon (`Lobby.jsx`), qui décrivait la
  boîte nue au lieu de la partie réellement configurée.
- Un commentaire glissé **entre** deux `case` d'un `switch` casse la détection
  de `no-fallthrough` d'ESLint : le placer au-dessus du premier `case` du
  groupe.
- **L'hypothèque regarde le groupe entier**, pas le seul terrain visé
  (`canMortgage`, dans `queries.js`) : sans ça on gèle une case tout en
  encaissant les loyers majorés des autres. Le moteur et les bots lisent la même
  fonction.
- Les dés sont uniformes, c'est mesuré : 16,66 % de doubles pour 16,67 %
  attendus. Avant de soupçonner le générateur, refaire la mesure — un double sur
  six jets, ça se remarque.
- `DATA_DIR` (`server/rooms.js`) est ancré sur l'emplacement du fichier
  (`import.meta.url`), **jamais** sur `process.cwd()` : sinon lancer le serveur
  depuis un autre dossier ou un autre raccourci pointe vers un dossier de
  sauvegarde différent, et les parties de la veille semblent avoir disparu.
- **Sur Render, le disque est éphémère par défaut** : sans le disque persistant
  décrit en §2 bis, chaque redéploiement ou redémarrage efface toutes les
  parties sauvegardées, sans la moindre erreur visible.

---

## 11. Où en est le projet

**Fait et vérifié** : les quatre éditions, les deux langues, l'écran de règles,
la reprise d'une partie un autre jour depuis n'importe quel appareil (même si
personne n'est connecté), le paiement négociable, les enchères, le chat, la
mise en page téléphone et ordinateur, les **trois** extensions Hasbro sur
l'édition Classique (Parc Gratuit Jackpot, Prison, Tout Acheter — voir §5,
avec leurs cases à cocher et la détection de conflit dans l'écran de
sélection), les deux éditions Spider-Man (Collector et Hasbro/Bouffon Vert),
les **quatre niveaux de bots** (voir §5 ter — ils achètent, bâtissent,
hypothèquent, enchérissent, tranchent les cartes et négocient, sur les six
boîtes et toutes les extensions), 190 tests.

**Reste à faire**, par ordre de priorité annoncée :

1. **Réconcilier les données Spider-Man avec la photo de la boîte.** Une photo
   du plateau Hasbro fournie en cours de route contredit sur plusieurs points le
   relevé écrit qui a servi à construire `spiderman-hasbro-fr` :
   - la boîte montre **deux paquets** (« DAILY BUGLE » et « SPIDER SENSE »),
     là où notre édition n'en a qu'un (paquets fusionnés) ;
   - on y lit un vilain **Prowler**, absent de nos données, et des cases
     **« TECH FUND »** qui ne correspondent à aucune des nôtres ;
   - les montants imprimés sont en **M** (M2, M5), pas en `$` ;
   - **aucun pion autonome du Bouffon Vert n'y est visible** — les jetons sont
     des pastilles (masques rouges et « W » bleus, soit nos constructions), et
     « GREEN GOBLIN » est une case de propriété.
   Autrement dit, la photo ressemble à un **reskin classique à deux paquets**,
   beaucoup plus proche de `spiderman-fr` que du jeu asymétrique décrit par
   écrit. À trancher avec la boîte en main avant d'aller plus loin : soit le
   relevé écrit décrit une autre boîte, soit `spiderman-hasbro-fr` repose sur
   des règles qui ne sont pas celles-là.

2. **Relire `spiderman-hasbro-fr` contre la boîte physique** : deux règles y
   sont des lectures assumées (voir §5 bis), et les chiffres non donnés par la
   boîte ont été calibrés à la simulation — pénalité de piège, prix d'un
   raccourci, faces du dé du Bouffon. Les cartes Daily Bugle « Surveillance
   piratée » (réordonner trois cartes) et « Chantage photographique » (choisir
   sa cible) sont simplifiées : la première pioche la carte suivante, la seconde
   vise la joueuse la plus riche.
3. Relire les trois extensions contre les boîtes physiques : les règles de
   Prison et de Tout Acheter viennent de sources secondaires (voir §5). Points
   les plus incertains : la caution de la Super Jail, les faces exactes du dé
   d'Achat, les effets des cartes Vente, et le rendu de la « Deal Mobile » du
   Jackpot (non implémentée) et de la « Banque » de Tout Acheter (non
   représentée).
4. Vérifier les textes de cartes du reskin Harry Potter sur la boîte physique.
5. Éditions Junior, Cheaters, Empire, Speed (les drapeaux `mechanics`
   existent déjà : `cheatCards`, `towerMode`, `draftMode`, `battleSpaces`).

---

## 12. Conventions de contribution

- Le dépôt est **en français** : code, commentaires, messages de commit,
  interface. S'y tenir.
- Les commentaires expliquent **pourquoi**, pas quoi.
- `npm run check` doit passer avant tout commit.
- Développer et pousser sur la branche `claude/monopoly-multiplayer-game-1q3lo3`.
  Ne pas ouvrir de pull request sans demande explicite.
- Ne jamais écrire de nom de modèle dans un commit, un commentaire ou un
  document du dépôt.
