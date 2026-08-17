# Monopoly Paris — multijoueur en temps réel

Version numérique du Monopoly classique (édition française, plateau parisien),
jouable à 2-6 depuis un navigateur, sur le même wifi ou à distance.

**État actuel : étapes 1 à 3 terminées** — données du plateau, moteur de jeu
complet et serveur temps réel (66 tests). Il reste l'interface.

## Démarrage

```bash
npm install
npm start      # http://localhost:3000 — l'adresse à partager s'affiche au démarrage
npm test       # 66 tests : données, règles, parties simulées, temps réel
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
tests/      data / engine / simulation / server
docs/       DATA_MODEL.md, MOTEUR.md, SERVEUR.md, ART_DIRECTION.md
client/     (à venir) React + Vite + Tailwind
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

## Prochaines étapes

Les règles des étapes 5 à 8 du plan initial (achats, enchères, constructions,
hypothèques, cartes, prison, faillite, échanges) sont déjà dans le moteur : il
reste à leur donner une interface.

4. Client : plateau, panneau joueuse, synchronisation temps réel
5. Écrans d'action : achat, enchère, construction, hypothèque, échange, chat
6. Polish visuel et animations (piste « Salon de Minuit »)
