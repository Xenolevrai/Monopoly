# Direction artistique — « Plateau de table »

Le parti pris : **ressembler au vrai jeu posé sur une table**, pas à une
interface de jeu vidéo. Tout est redessiné de zéro — aucun logo, aucune
illustration ni aucun visuel de marque n'est repris.

## Palette

| Rôle | Couleur | Usage |
|---|---|---|
| Table | `#2b2320` | le bois sur lequel le plateau est posé |
| Carton du plateau | `#cfe3d3` | le vert pâle du centre |
| Case | `#f7f4ea` | le crème des cases |
| Encre | `#16130f` | filets et textes |
| Rouge | `#b3242c` | cartouche du titre, Chance, boutons d'action |
| Vert | `#1f9d55` / `#1f7a4d` | maisons, montants gagnés |
| Rouge hôtel | `#c62828` | hôtels |

Les huit couleurs de groupes viennent de `shared/data/groups.json` : ce sont les
mêmes côté serveur et côté client.

## Typographie

- **Oswald** (condensée, capitales) pour tout ce qui est imprimé sur le plateau :
  noms de rues, boutons, titres de panneaux. C'est ce qui donne l'air « jeu de
  société » immédiat.
- **Inter** pour les données lisibles en continu : montants, journal, chat.
- **Cormorant Garamond** en réserve pour les titres longs.

Les trois sont **embarquées dans le build** : la partie garde sa typographie sur
un wifi sans internet, et aucune requête ne part vers l'extérieur.

## Le plateau

- Grille 11 × 11, quatre coins agrandis (`1.55fr` contre `1fr`), `aspect-ratio: 1`
  — il ne se déforme jamais.
- Chaque case est cernée d'un filet noir, avec son bandeau de couleur plein du
  côté intérieur.
- **Les textes sont orientés vers le centre**, comme sur le plateau papier : droits
  en bas, tournés d'un quart de tour sur les côtés, à l'envers en haut. C'est ce
  détail qui fait « vrai plateau » au premier coup d'œil. Techniquement, le
  contenu est tourné dans un conteneur dimensionné en unités de conteneur
  (`100cqh` × `100cqw`), ce qui lui donne la bonne place quelle que soit la taille
  de l'écran.
- Pictogrammes dessinés en SVG : locomotive sur les gares, ampoule sur
  l'Électricité, robinet sur les Eaux, point d'interrogation rouge sur Chance,
  coffre bleu sur la Caisse, diamant et bague sur les taxes, flèche sur Départ,
  barreaux sur la Prison, voiture sur le Parc Gratuit, agent sur Allez en Prison.
- Maisons vertes et hôtel rouge posés **sur le bandeau de couleur**, comme les
  vraies pièces.
- Mentions imprimées sous les coins : « Recevez 200 € », « Simple visite »,
  « Sans passer par Départ ».
- Cartouche **MONOPOLY** en diagonale au centre, sur bandeau rouge.

## Les pions

Six silhouettes dessinées en SVG (`components/TokenIcon.jsx`), chacune dans sa
couleur : **chapeau haut-de-forme, chat, bateau, brouette, dé à coudre,
lanterne**. Elles servent partout — sélection au lobby, panneau des joueuses,
et posées sur les cases dans une pastille blanche cerclée de noir.

Un pion par personne : au lobby, ceux déjà pris sont grisés et non cliquables, et
le serveur refuse un doublon même si un client bricolé essayait.

## Ce qui a précédé

Une première version sombre (« Salon de Minuit », bleu nuit et filets dorés) a
été écrite puis remplacée à la demande. Elle reste facile à retrouver : toutes
les couleurs passent par des variables dans `client/src/styles.css`, et aucun
composant ne code une couleur en dur.
