# Modèle de données — à valider avant d'écrire le moteur

Tout est dans `shared/`, importé aussi bien par le serveur que par le client.

```
shared/
  data/board.json    les cases, prix, loyers, hypothèques  (données pures, éditables)
  data/groups.json   8 groupes de couleur + gares + compagnies
  data/cards.json    2 × 16 cartes, avec effet structuré
  data/rules.json    constantes de règles + règles maison + pions
  index.js           accès aux données + helpers de plateau
  schema.js          typedefs de l'état de partie + fabriques d'état initial
tests/data.test.js   vérifie que les données collent au jeu officiel
```

## 1. Le plateau : des données, pas du code

Une case = un objet plat. Exemple, le n° 19 :

```json
{
  "id": 19, "name": "Place Pigalle", "shortName": "Pigalle",
  "type": "property", "group": "orange",
  "price": 200, "rent": [16, 80, 220, 600, 800, 1000],
  "houseCost": 100, "mortgage": 100,
  "side": "left", "corner": false
}
```

- `rent` est un tableau à 6 entrées : `[nu, 1🏠, 2🏠, 3🏠, 4🏠, hôtel]`. Le calcul du
  loyer devient une simple indexation `rent[houses]` (ou `rent[5]` pour un hôtel),
  au lieu d'une cascade de `if`. Le doublement « groupe complet non construit »
  reste une règle du moteur, pas une donnée.
- Les gares portent `rent: [25, 50, 100, 200]` indexé par *nombre de gares − 1*.
- Les compagnies portent `rentMultipliers`, multiplié par le jet de dés, et
  indexé par *nombre de compagnies − 1* : `[4, 10]` à deux compagnies,
  `[4, 10, 20]` sur un plateau qui en compte trois.
- `side` et `corner` ne servent qu'à l'affichage, le moteur les ignore. **La
  grille se déduit de la longueur du plateau** (`length / 4 + 1`) : 11 × 11 pour
  40 cases, 14 × 14 pour les 52 de la Mega Edition. Rien n'est écrit en dur.

`type` vaut : `go`, `property`, `railroad`, `utility`, `community_chest`, `chance`,
`tax`, `jail`, `free_parking`, `go_to_jail` — plus les types qu'une édition ou une
extension ajoute (`landmark`, `warp`, `spin`, `auction_space`, `bus_ticket`,
`birthday_gift`…). Un type qui porte le nom d'un paquet de cartes déclenche un
tirage, sans que le moteur connaisse la liste des paquets.

Une propriété de l'état (`state.properties[id]`) porte `houses`, `hotel`, plus
deux paliers qui ne servent qu'aux boîtes qui les déclarent : `skyscraper` (un
cran au-dessus de l'hôtel) et `depot` (un aménagement de gare). Ils sont
toujours présents et toujours faux ailleurs — l'état reste homogène d'une boîte
à l'autre.

## 2. Les cartes : un texte + un effet structuré

```json
{ "id": "chance-06", "text": "Réparations locatives : payez 25 € par maison…",
  "action": { "type": "pay_per_building", "perHouse": 25, "perHotel": 100 } }
```

Effets utilisés : `move_to` (avec `collectGoSalary`, et `rentMultiplier` pour la
carte Gare de Lyon), `move_relative`, `go_to_jail`, `collect`, `pay`,
`pay_per_building`, `collect_from_each`, `get_out_of_jail_free`, `choice`
(la carte « payez 10 € ou piochez une Chance », dont les options portent
elles-mêmes une action), `draw_card`.

Le moteur n'aura donc qu'un `switch` sur ~9 types d'effet : ajouter une carte
maison plus tard ne demandera aucun code neuf tant qu'on réutilise ces effets.

Les piles sont mélangées au début de partie et stockées comme des **files d'ids**
(`state.decks.chance`) : on pioche en tête, on remet en queue — c'est exactement
la règle « remettre la carte sous la pile ». Les deux cartes « libérée de prison »
sortent de la file tant qu'une joueuse les détient, et y retournent à l'usage.

## 3. L'état de partie

Quatre partis pris (détaillés en commentaire dans `shared/schema.js`) :

1. **Le serveur est la seule source de vérité.** Le client n'envoie que des
   intentions (`{ type: 'BUY' }`), jamais un état.
2. **Tout est JSON sérialisable** — pas de `Map`, pas de classe. On peut logger
   l'état, l'envoyer tel quel, le sauver en SQLite, le rejouer dans un test.
3. **Pas de duplication propriétaire/propriétés.** `state.properties[19].ownerId`
   est la seule vérité ; la liste des biens d'une joueuse est *dérivée* (un
   `filter`). Impossible de désynchroniser les deux moitiés.
4. **`state.pending` décrit explicitement la décision attendue** : `kind`
   (`buy_or_auction`, `pay_debt`, `jail_choice`, `auction_bid`, `trade_response`…)
   et `playerIds` (qui doit répondre). La validation serveur devient une seule
   règle générale : *une action n'est acceptée que si elle correspond au
   `pending` courant et vient d'une joueuse listée*. C'est ce qui empêche de
   lancer les dés deux fois, d'acheter le tour d'une autre, ou de construire
   pendant une enchère.

Structure resserrée :

```js
GameState {
  code, hostId, phase, version,
  players: Player[],            // cash, position, inJail, jailTurns, getOutOfJailCards…
  currentPlayerIndex, turnCount,
  dice: { values, doublesCount, rolled },
  properties: { 19: { ownerId, houses, hotel, mortgaged } },
  bank: { houses: 32, hotels: 12 },
  decks: { chance: [ids…], community_chest: [ids…] }, drawnCardId,
  pending: { kind, playerIds, payload },
  auction, trades[], debt,
  log[], chat[], freeParkingPot,
  settings, winnerId
}
```

- `bank` matérialise le stock limité (32 maisons / 12 hôtels) : la pénurie devient
  une vraie contrainte de jeu, comme sur le plateau physique.
- `debt` isole « je dois 850 € et je n'ai que 300 € » : tant que la dette existe,
  la joueuse ne peut qu'hypothéquer, revendre, échanger, ou déclarer faillite.
- `version` s'incrémente à chaque mutation : le client peut détecter une désync et
  redemander l'état complet.
- `connected: false` sur une joueuse = onglet fermé, sa place et ses biens restent
  intacts (reconnexion avec le même code + pseudo).

## 4. Vues client

Le serveur ne diffuse pas `GameState` brut : il enverra une projection par
joueuse, identique pour tout le monde sauf le secret utile (le contenu d'une
enchère en cours, la main d'échange en préparation). Tout le reste — argent,
propriétés, positions — est public au Monopoly, donc diffusé tel quel.

## 5. Points de règle que j'ai tranchés — dis-moi si tu veux l'inverse

| Point | Choix fait | Où le changer |
|---|---|---|
| Carte « Allez à la Gare de Lyon » | on touche 200 € si on repasse par Départ | `rules.json → houseRules.collectGoOnGoToLyon` |
| Carte « Rendez-vous à la Rue de la Paix » | « directement » = pas de salaire (sans effet en pratique : aucune case Chance ne repasse par Départ pour y aller) | `cards.json → chance-14` |
| Parc Gratuit | neutre (règle officielle), cagnotte désactivable | `rules.json → houseRules.freeParkingPot` |
| Refus d'achat | enchère obligatoire (règle officielle), désactivable | `houseRules.auctionOnDecline` |
| Sortie de prison au 3ᵉ tour | caution de 50 € payée d'office, puis on avance du jet | moteur |
| Biens d'une faillie envers la banque | remis aux enchères un par un | `houseRules.auctionBankruptcyAssets` |
