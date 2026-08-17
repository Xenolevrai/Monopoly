# Monopoly Paris — multijoueur en temps réel

Version numérique du Monopoly classique (édition française, plateau parisien),
jouable à 2-6 depuis un navigateur, sur le même wifi ou à distance.

**État actuel : étapes 1 et 2 terminées** — données du plateau, modèle d'état et
moteur de jeu complet (56 tests). Le serveur temps réel et le client viennent ensuite.

## Démarrage

```bash
npm test     # 56 tests : données du plateau, règles du moteur, parties simulées
```

Aucune dépendance à installer pour l'instant (Node 22+, tests via `node --test`).

## Structure

```
shared/     données de jeu + schéma d'état, partagés serveur ↔ client
  data/     board.json, groups.json, cards.json, rules.json  ← règles éditables sans toucher au code
  index.js  accès aux données + helpers de plateau
  schema.js typedefs de l'état + fabriques d'état initial
server/
  engine/   moteur de jeu : tour, déplacements, loyers, cartes, enchères, faillite
tests/      data / engine / simulation
docs/       DATA_MODEL.md, MOTEUR.md, ART_DIRECTION.md
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

3. Serveur : lobby, codes de partie, Socket.io, reconnexion
4. Client : plateau, panneau joueuse, synchronisation temps réel
5. Écrans d'action : achat, enchère, construction, hypothèque, échange, chat
6. Polish visuel et animations (piste « Salon de Minuit »)
