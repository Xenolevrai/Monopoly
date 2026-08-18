# Monopoly Paris — multijoueur en temps réel

Version numérique du Monopoly classique (édition française, plateau parisien),
jouable à 2-6 depuis un navigateur, sur le même wifi ou à distance.

**Le jeu est complet et jouable** : plateau, règles, temps réel, lobby, échanges,
chat, reconnexion. On peut jouer **à plusieurs sur le même ordinateur**, avec
d'autres joueuses **à distance** dans la même partie. 71 tests automatisés.

![Une partie en cours](docs/captures/partie.png)

## Démarrage

```bash
npm install
npm run build   # compile l'interface
npm start       # http://localhost:3000 — l'adresse à partager s'affiche au démarrage
npm test        # 71 tests : données, règles, parties simulées, temps réel
```

Node 22+. Le serveur affiche aussi l'adresse locale (`http://192.168.x.x:3000`) à
donner aux autres joueuses du même wifi.

## Structure

```
shared/     données de jeu + schéma d'état, partagés serveur ↔ client
  data/     board.json, groups.json, cards.json, rules.json  ← règles éditables sans toucher au code
  index.js  accès aux données + helpers de plateau
  schema.js typedefs de l'état + fabriques d'état initial
server/
  engine/   moteur de jeu : tour, déplacements, loyers, cartes, enchères, faillite
  index.js  serveur HTTP + API, sert le client compilé
  sockets.js passerelle Socket.io ↔ moteur
  rooms.js  registre des parties, codes, sauvegarde sur disque
client/     interface React + Vite + Tailwind (« Salon de Minuit »)
  src/components/  plateau, joueuses, actions, échanges, journal et chat
  src/lib/         connexion temps réel, état, données du plateau
tests/      data / engine / simulation / server
docs/       DATA_MODEL.md, MOTEUR.md, SERVEUR.md, CLIENT.md, ART_DIRECTION.md
```

## Stack retenue

React + Vite + Tailwind côté client, Node + Express + Socket.io côté serveur,
état en mémoire côté serveur. C'est bien la stack proposée dans le cahier des
charges, avec deux ajustements pensés pour un groupe non technique :

- **un seul processus, un seul port** : Express sert le build du client *et* le
  websocket. Une seule commande à lancer (`npm start`), une seule URL à partager,
  pas de CORS à régler ;
- **snapshot JSON sur disque** plutôt que SQLite : l'état est déjà 100 %
  sérialisable, donc une sauvegarde toutes les N mutations dans un fichier suffit
  à survivre à un redémarrage. On passera à SQLite seulement si on veut plusieurs
  parties archivées.

## Direction artistique

**« Plateau de table »** : carton vert pâle, cases crème cernées d'un filet noir,
bandeaux de couleur pleins, textes condensés en capitales orientés vers le centre
comme sur le plateau papier, six pions dessinés en SVG. Détails dans
`docs/ART_DIRECTION.md`.

## Jouer ensemble

1. Une personne lance `npm start` sur son ordinateur et ouvre `http://localhost:3000`.
2. Elle crée une partie, choisit son pion, et **ajoute autant de joueuses qu'elle
   veut sur ce même ordinateur** (bouton « + Ajouter une joueuse sur cet
   ordinateur »). On se passe simplement la souris : le jeu annonce à chaque tour
   à qui c'est.
3. Pour les joueuses à distance, elle partage l'adresse affichée au démarrage
   (`http://192.168.x.x:3000`) si tout le monde est sur le même wifi, ou un tunnel
   (ngrok, Cloudflare Tunnel) sur le port 3000 sinon, et dicte le code à six
   lettres.
4. L'hôte lance la partie quand tout le monde est là.

Les deux modes se mélangent : trois personnes autour d'un portable et deux autres
à distance, dans la même partie.

Fermer un onglet par erreur ne fait rien perdre : rouvrir la page reprend la
partie au même point. Si le serveur redémarre, les parties de moins de 24 h sont
rechargées depuis le disque.

## Pistes si l'envie vient

- Sauvegarde longue durée en SQLite plutôt qu'en fichiers JSON
- Statistiques de fin de partie (patrimoine, loyers encaissés)
- Variante sombre : tout passe par des variables CSS dans `client/src/styles.css`
