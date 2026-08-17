# Le serveur temps réel

Un seul processus, un seul port : Express sert le client compilé et Socket.io
partage le même serveur HTTP. Une commande à lancer, une URL à partager.

```bash
npm start          # http://localhost:3000
PORT=8080 npm start
```

Au démarrage, le serveur affiche aussi l'adresse à donner aux autres joueuses du
même wifi (`http://192.168.x.x:3000`).

## Fichiers

| Fichier | Rôle |
|---|---|
| `server/index.js` | serveur HTTP, API minimale, service du client compilé |
| `server/sockets.js` | passerelle Socket.io ↔ moteur : identifie, `dispatch`, rediffuse |
| `server/rooms.js` | registre des parties, codes, sauvegarde et restauration |

La passerelle ne connaît **aucune** règle du Monopoly. Elle identifie la joueuse,
appelle `dispatch`, et rediffuse l'état à la salle. Toute la validation reste dans
le moteur : un client bricolé ne peut rien faire d'illégal.

## Événements

Client → serveur :

| Événement | Charge utile | Effet |
|---|---|---|
| `game:create` | `{ name, token, settings }` | crée une partie, renvoie son code |
| `game:join` | `{ code, name, token }` | rejoint, ou reprend une place vacante au même pseudo |
| `game:rejoin` | `{ code, playerId }` | reconnexion silencieuse après un rafraîchissement |
| `game:settings` | `{ settings }` | règles maison (hôte, lobby uniquement) |
| `game:start` | — | lance la partie (hôte) |
| `game:action` | `{ type, … }` | toute action de jeu, transmise au moteur |
| `game:leave` | — | quitte la partie |

Serveur → client :

| Événement | Charge utile |
|---|---|
| `game:joined` | `{ code, playerId }` — à stocker côté client pour la reconnexion |
| `game:state` | l'état public complet, après chaque mutation |
| `game:error` | `{ message }` — refus lisible, en français |

API HTTP : `GET /api/health`, `GET /api/board` (plateau + pions + règles maison),
`GET /api/game/:code` (vérifier un code avant de saisir son pseudo).

## Codes de partie

Six caractères tirés d'un alphabet sans ambiguïté (ni `O`/`0`, ni `I`/`1`) : un
code se dicte à voix haute sans malentendu.

## Reconnexion

Deux chemins, parce que les deux situations arrivent :

1. **Rafraîchissement de page** — le client a gardé `playerId` en mémoire locale
   et émet `game:rejoin`. Il retrouve sa place immédiatement.
2. **Autre navigateur, autre machine** — la joueuse émet `game:join` avec le même
   pseudo ; si une place du même nom est marquée absente, elle la reprend.

Fermer un onglet ne retire jamais personne d'une partie lancée : la place, l'argent
et les propriétés attendent. Dans le lobby en revanche, partir libère la place —
et si c'était l'hôte, la première joueuse restante reprend la main.

## Persistance

L'état est recopié sur disque après chaque mutation, avec 400 ms de délai pour
regrouper les rafales (un tour de jeu génère une dizaine de mutations). Au
redémarrage, les parties de moins de 24 h sont relues, tout le monde marqué
« à reconnecter ». Les parties inactives depuis plus de 24 h sont purgées toutes
les heures.

Le générateur aléatoire repart d'une graine neuve après un redémarrage : seul
l'état de la partie est restauré, pas la suite des jets à venir — ce qui n'a
aucune conséquence sur le jeu.

Dossier de sauvegarde : `server/data/` (configurable via `MONOPOLY_DATA_DIR`),
ignoré par git.

## Tests

`tests/server.test.js` monte un vrai serveur sur un port libre et connecte de
vrais clients Socket.io : création et code de partie, refus d'agir hors de son
tour, propagation d'un lancer aux deux écrans, fermeture d'onglet puis
reconnexion (par identifiant et par pseudo), transfert d'hôte, chat, et
rechargement d'une partie après redémarrage.
