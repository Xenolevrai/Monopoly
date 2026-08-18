# Le moteur de jeu

Le moteur vit dans `server/engine/`. Il ne connaît ni Socket.io ni React : il
prend un état + une action et renvoie `{ ok }` ou `{ ok: false, error }`. C'est
pour ça qu'il se teste seul, sans navigateur ni serveur.

```js
import { createGame, addPlayer, startGame, dispatch } from './server/engine/index.js';

const game = createGame('PARIS7', 'p0');
addPlayer(game, { id: 'p0', name: 'Julie' });
addPlayer(game, { id: 'p1', name: 'Sophie' });
startGame(game, 'p0');

dispatch(game, 'p0', { type: 'ROLL_DICE' });
dispatch(game, 'p0', { type: 'BUY_PROPERTY' });
dispatch(game, 'p0', { type: 'END_TURN' });
```

## Modules

| Fichier | Rôle |
|---|---|
| `index.js` | validation des actions, `dispatch`, enchaînement de la partie |
| `turn.js` | tour de jeu : lancer, doubles, prison, fin de tour |
| `movement.js` | déplacements et résolution de la case d'arrivée |
| `queries.js` | lectures dérivées (loyers, groupes, patrimoine) — aucune écriture |
| `money.js` | paiements, dettes, faillite, fin de partie |
| `property.js` | achat, hypothèque, construction, revente |
| `auction.js` | enchères (refus d'achat, liquidation de faillite) |
| `cards.js` | piles Chance / Caisse et effets de cartes |
| `trade.js` | échanges entre joueuses |
| `rng.js` | aléatoire déterministe (graine fixée dans les tests) |

## Le principe de validation

Une seule règle gouverne tout : **une action n'est acceptée que si elle
correspond à ce que `state.pending` réclame, et qu'elle vient d'une joueuse
listée dans `pending.playerIds`.**

`pending.kind` vaut `roll`, `buy_or_auction`, `draw_card`, `card_reveal`,
`auction_bid`, `card_choice`, `pay_debt`, `end_turn`, ou `null`. Deux exceptions volontaires :

- **hypothéquer et revendre** sont possibles à tout moment — il faut pouvoir
  réunir des fonds pendant le tour d'une autre (carte « anniversaire ») ;
- **construire et lever une hypothèque** ne sont possibles que pendant son
  propre tour, hors dette et hors enchère.

Après chaque action acceptée, `advanceFlow` fait avancer la partie jusqu'au
prochain point où une décision humaine est nécessaire. Un seul endroit dans tout
le code décide « et maintenant ? » — c'est ce qui évite les états impossibles.

## Le cycle d'un tour

```
pending: roll
  └─ ROLL_DICE
       ├─ 3ᵉ double        → prison, pending: end_turn
       ├─ en prison        → double = sortie / 3ᵉ échec = caution d'office
       └─ déplacement → résolution de la case
            ├─ propriété libre      → pending: buy_or_auction
            ├─ propriété d'une autre → pending: pay_debt (payer, s'arranger, ou faillite)
            ├─ Chance / Caisse      → pending: draw_card puis card_reveal
            ├─ taxe / Allez en prison / Parc gratuit
            └─ rien                 → pending: end_turn
  └─ END_TURN
       ├─ double     → même joueuse, pending: roll
       └─ sinon      → joueuse suivante
```

## Un loyer ne se prélève pas tout seul

C'est le choix de conception le plus visible. Une somme due **à la banque** part
tout de suite si les fonds sont là : on ne négocie pas avec la banque. Une somme
due **à une autre joueuse** — un loyer — n'est jamais prélevée d'office. Elle
devient une dette, et la débitrice choisit :

- payer comptant (`PAY_DEBT`) ;
- proposer un **arrangement** à la propriétaire : des terrains, de l'argent, un
  mélange des deux. Si elle accepte, la dette est effacée quel que soit le montant
  cédé — c'est aux deux de juger si le marché est bon ;
- négocier ailleurs pour réunir des fonds, hypothéquer, revendre ;
- déclarer faillite.

Techniquement, `charge(..., { negotiable: true })` marque cette différence, et
rien dans le moteur ne solde une dette sans qu'on le lui demande.

## Arrêter la partie quand on veut

`endGame` (réservé à l'hôte) clôt la partie sans attendre la faillite générale et
établit le classement au **patrimoine** : liquide + prix des propriétés + valeur
des constructions. Une partie qui s'arrête à 2 h du matin a donc un vainqueur.

## Ce qui a été tranché en chemin

- **Dette** : le solde ne descend jamais sous zéro. Une somme due crée une `debt`
  qui gèle la partie jusqu'à son règlement, son arrangement, ou la faillite. Une
  hypothèque ou un échange met à jour ce que la joueuse peut réunir, mais ne paie
  jamais à sa place.
- **Enchère à deux joueuses** : la dernière en lice garde la main tant qu'elle n'a
  pas misé — sinon elle n'aurait jamais l'occasion de faire sa première mise.
- **Revente d'un hôtel** quand la banque n'a plus 4 maisons : l'hôtel est rasé
  d'un coup et remboursé intégralement, plutôt que de bloquer une joueuse endettée.
- **Carte « anniversaire »** : si une payeuse ne peut pas donner ses 10 €, la
  collecte se met en pause sur sa dette et reprend une fois celle-ci réglée.
- **Faillite envers la banque** : les constructions retournent au stock, les
  cartes de prison sous leur pile, et les terrains partent aux enchères un par un.

## Tests

```bash
npm test
```

84 tests, trois familles :

- `tests/data.test.js` — les données collent au jeu officiel ;
- `tests/engine.test.js` — 40 scénarios de règles (loyers doublés, répartition des
  maisons, prison, enchères, dettes, faillite, échanges) ;
- `tests/simulation.test.js` — 20 parties complètes jouées au hasard, avec
  vérification des invariants après **chaque** action : solde jamais négatif,
  32 maisons et 12 hôtels toujours comptabilisés, jamais d'hôtel et de maisons sur
  la même case, jamais de terrain construit et hypothéqué, et surtout jamais de
  blocage (il y a toujours quelqu'un à qui jouer).

C'est cette dernière famille qui a débusqué deux vrais bugs : l'enchère à deux
qui se fermait trop tôt, et le jet de dés qui restait « en attente » après
résolution, laissant relancer les dés une seconde fois.
