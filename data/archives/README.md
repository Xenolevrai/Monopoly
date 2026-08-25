# Les parties archivées

Chaque partie **terminée** ajoute une ligne à `AAAA-MM.jsonl` — un objet JSON
complet par ligne (format JSON Lines). Ce dossier n'est jamais purgé,
contrairement aux sauvegardes de parties en cours (`server/data/`, effacées au
bout d'un mois d'inactivité).

Les fichiers `.jsonl` ne sont **pas suivis par git** : ce sont nos parties de
famille, et elles pèsent environ 500 Ko chacune.

Pour changer d'emplacement — un disque persistant chez un hébergeur, par
exemple : `MONOPOLY_ARCHIVE_DIR=/data/archives`.

## À quoi ça sert

Le journal d'une partie sait dire « Expert achète Gare Montparnasse ». Il ne
dit pas **à quelle question elle répondait, ni ce qu'elle avait en main au
moment de choisir** — et c'est précisément ce qu'il faut pour entraîner un bot.
Une décision archivée, c'est donc une invite, un état, et un coup joué.

## Un coup d'œil rapide

```bash
node scripts/stats-archives.mjs        # taux de victoire par niveau, durées, boîtes
wc -l data/archives/*.jsonl            # combien de parties
```

Et pour fouiller à la main, chaque ligne étant un JSON complet :

```bash
# Les parties gagnées par un expert
jq -c 'select(.players[] | select(.bot=="expert" and .rank==1))' data/archives/*.jsonl

# Toutes les décisions d'achat prises par des experts
jq -c '.decisions[] | select(.bot=="expert" and .pendingKind=="buy_or_auction")' \
  data/archives/*.jsonl
```

## Le format

```jsonc
{
  "code": "AB12CD",
  "startedAt": 1787265133412,
  "endedAt": 1787268901234,
  "editionId": "classic-fr",
  "extensionIds": [],
  "locale": "fr",
  "settings": { /* les règles maison réellement appliquées */ },
  "seed": 123456789,     // la graine : la partie est rejouable à l'identique
  "turns": 63,
  "winnerId": "…",       // null si la partie a été arrêtée à la main
  "partial": false,      // true = partie reprise après un redémarrage, décisions perdues

  "players": [
    {
      "id": "…", "name": "Julie", "token": "chat",
      "bot": null,       // null = humaine, sinon facile|moyen|difficile|expert
      "order": 0,        // sa place dans l'ordre de jeu, tiré au sort
      "finalCash": 0, "finalWorth": 0,
      "bankrupt": true,
      "rank": 2          // 1 = meilleur patrimoine final
    }
  ],

  "decisions": [
    {
      "seq": 1,
      "playerId": "…",
      "bot": "expert",              // recopié ici pour filtrer sans jointure
      "pendingKind": "buy_or_auction",  // l'invite à laquelle on répondait
      "action": { "type": "BUY_PROPERTY" },
      "accepted": true,             // false + "error" si le moteur a refusé
      "before": {                   // ⚠️ l'état AVANT le coup, pas après
        "turn": 3,
        "cash": 1420, "position": 5, "inJail": false,
        "netWorth": 1620,
        "owned": [1, 3],            // ses cases
        "spaceId": 5, "price": 200, // la case en jeu, si l'invite en désigne une
        "debt": null,
        "freeParkingPot": 0,
        "opponents": [
          { "playerId": "…", "cash": 1500, "netWorth": 1500, "owned": 0 }
        ]
      }
    }
  ],

  "log": [ /* le journal complet, tel qu'il a été écrit */ ]
}
```

## Ce qui n'y est pas, et pourquoi

- **Le chat.** Ce sont des conversations de famille, et elles n'apprennent rien
  à un bot.
- **Les parties non terminées.** Une partie abandonnée en cours n'écrit rien —
  on ne saurait pas qui a gagné, donc elle n'apprend rien non plus.
- **Les décisions d'une partie reprise après un redémarrage du serveur.**
  L'historique vit en mémoire, pas dans l'état sauvegardé sur disque. Ces
  parties sont marquées `"partial": true` : à écarter de tout entraînement,
  plutôt que d'apprendre sur un trou.

## Avant de conclure quoi que ce soit

**Le hasard pèse énormément au Monopoly.** Un expert qui perd contre un facile
sur dix parties, c'est parfaitement normal ; sur cent, ça cesse de l'être. Une
différence entre deux niveaux voisins ne se lit pas en dessous de quelques
centaines de parties, et l'ordre de jeu donne à lui seul un avantage réel — d'où
les sièges tournants dans `scripts/train-bots.mjs`.

Affichez toujours le nombre de parties à côté d'un pourcentage.
