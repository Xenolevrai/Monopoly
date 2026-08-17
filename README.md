# Monopoly Paris — multijoueur en temps réel

Version numérique du Monopoly classique (édition française, plateau parisien),
jouable à 2-6 depuis un navigateur, sur le même wifi ou à distance.

**Le jeu est complet et jouable** : plateau, règles, temps réel, lobby, échanges,
chat, reconnexion. 66 tests automatisés.

![Une partie en cours](docs/captures/partie.png)

## Démarrage

```bash
npm install
npm run build   # compile l'interface
npm start       # http://localhost:3000 — l'adresse à partager s'affiche au démarrage
npm test        # 66 tests : données, règles, parties simulées, temps réel
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

Piste retenue : **« Salon de Minuit »** — fond bleu nuit, plateau ardoise à filet
doré, bandeaux de couleur lumineux, typo Cormorant dorée en titres. Détails et
alternative dans `docs/ART_DIRECTION.md`.

## Jouer ensemble

1. Une personne lance `npm start` sur son ordinateur.
2. Elle partage l'adresse affichée (`http://192.168.x.x:3000`) aux autres, sur le
   même wifi. À distance, un tunnel (ngrok, Cloudflare Tunnel) sur le port 3000
   fait la même chose.
3. Elle crée une partie et dicte le code à six lettres ; les autres le saisissent.
4. L'hôte lance la partie quand tout le monde est là.

Fermer un onglet par erreur ne fait rien perdre : rouvrir la page reprend la
partie au même point. Si le serveur redémarre, les parties de moins de 24 h sont
rechargées depuis le disque.

## Pistes si l'envie vient

- Direction artistique « Papier & Encre » en variante (tout est en variables CSS)
- Sauvegarde longue durée en SQLite plutôt qu'en fichiers JSON
- Statistiques de fin de partie (patrimoine, loyers encaissés)
