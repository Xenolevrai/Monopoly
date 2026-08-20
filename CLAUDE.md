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

Cinq éditions sont livrées, et l'ajout d'une sixième doit se faire **sans
toucher une ligne de moteur** — c'est le contrat central de l'architecture.
Spider-Man en est la preuve la plus nette : elle a été ajoutée sans qu'une
seule ligne de `server/engine/` ne change.

| id | boîte | matière | victoire | particularité |
|---|---|---|---|---|
| `classic-fr` | Monopoly classique, plateau parisien | `table` | dernière en jeu | la référence |
| `harry-potter-fr` | Harry Potter (reskin Winning Moves), Gallions | `parchment` | dernière en jeu | règles classiques, noms Poudlard |
| `avengers-fr` | Marvel Avengers, M$ | `tech` | dernière en jeu | bases S.H.I.E.L.D. / QG Stark |
| `spiderman-fr` | Spider-Man Collector (Winning Moves), $ | `night` | dernière en jeu | reskin exact du classique : vilains, traceurs / tours de toile |
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
npm run check     # lint + 139 tests
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
client/src/
  components/          Board, BoardSkin, Centerpiece, SpaceArt, SpaceIcons, Actions, Players…
  lib/                 board.js, i18n.js, theme.js, rulesText.jsx, useGame.js, useCinematic.js
tests/                 data · editions · engine · locales · payment-flow · points-edition · server · simulation
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
   les illustrations de cases dans `SpaceArt.jsx`.
4. `npm test` : `tests/editions.test.js` vérifie tout seul la numérotation du
   plateau, les groupes, la croissance des loyers, les cibles des cartes, la
   présence des pions et des pictogrammes, la palette complète — et **joue une
   partie entière** sur la nouvelle édition.

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

---

## 11. Où en est le projet

**Fait et vérifié** : les quatre éditions, les deux langues, l'écran de règles,
la reprise d'une partie un autre jour depuis n'importe quel appareil (même si
personne n'est connecté), le paiement négociable, les enchères, le chat, la
mise en page téléphone et ordinateur, les **trois** extensions Hasbro sur
l'édition Classique (Parc Gratuit Jackpot, Prison, Tout Acheter — voir §5,
avec leurs cases à cocher et la détection de conflit dans l'écran de
sélection), l'édition Spider-Man Collector, 155 tests.

**Reste à faire**, par ordre de priorité annoncée :

1. **Édition Spider-Man moderne (Hasbro, pion autonome du Bouffon Vert)** :
   l'autre boîte relevée. Elle **ne rentre pas dans le contrat « aucune ligne
   de moteur »** — il lui faut un pion autonome piloté par un dé de vilain, des
   jetons Bombe Citrouille qui verrouillent une case, des pouvoirs de héros
   asymétriques, des cases Raccourci de Toile qui téléportent, et un décompte
   final au patrimoine. C'est un chantier « extension + édition », pas un
   reskin ; à traiter comme les extensions Hasbro (drapeaux `mechanics`
   génériques), jamais par un `if (editionId === …)`.
2. Relire les trois extensions contre les boîtes physiques : les règles de
   Prison et de Tout Acheter viennent de sources secondaires (voir §5). Points
   les plus incertains : la caution de la Super Jail, les faces exactes du dé
   d'Achat, les effets des cartes Vente, et le rendu de la « Deal Mobile » du
   Jackpot (non implémentée) et de la « Banque » de Tout Acheter (non
   représentée).
3. Vérifier les textes de cartes du reskin Harry Potter sur la boîte physique.
4. Éditions Junior, Cheaters, Empire, Speed (les drapeaux `mechanics`
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
