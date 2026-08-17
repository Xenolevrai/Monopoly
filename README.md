# Monopoly Paris — multijoueur en temps réel

Version numérique du Monopoly classique (édition française, plateau parisien),
jouable à 2-6 depuis un navigateur, sur le même wifi ou à distance.

**État actuel : étape 1 terminée** — données du plateau et modèle d'état, avec
tests. Le moteur de jeu, le serveur et le client viendront ensuite.

## Démarrage

```bash
npm test     # vérifie que les données du plateau collent au jeu officiel
```

Aucune dépendance à installer pour l'instant (Node 22+, tests via `node --test`).

## Structure

```
shared/     données de jeu + schéma d'état, partagés serveur ↔ client
  data/     board.json, groups.json, cards.json, rules.json  ← règles éditables sans toucher au code
  index.js  accès aux données + helpers de plateau
  schema.js typedefs de l'état + fabriques d'état initial
tests/      tests du moteur (data.test.js pour l'instant)
docs/       DATA_MODEL.md (à valider), ART_DIRECTION.md (2 pistes)
server/     (à venir) logique de jeu + Socket.io
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

## Prochaines étapes

2. Moteur de jeu testable (tour, déplacement, résolution de case, loyers)
3. Lobby + Socket.io
4. Plateau et synchronisation temps réel
5. Achats, enchères, constructions, hypothèques
6. Cartes Chance / Caisse de Communauté
7. Prison, faillite, fin de partie
8. Échanges et chat
9. Polish visuel et animations
