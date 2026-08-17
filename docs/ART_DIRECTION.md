# Deux pistes de direction artistique — à choisir avant l'intégration

Les deux reprennent les 8 couleurs de groupes (dans une version légèrement
désaturée, plus agréable sur écran que les couleurs d'imprimerie) et la grille
11×11 avec 4 grands coins. Elles diffèrent par l'ambiance, la typo et le rendu
des cases. Aucun élément Hasbro n'est repris : logo, pions et cartes sont dessinés
de zéro.

---

## Piste A — « Papier & Encre » *(ma recommandation)*

L'esprit d'un vrai plateau posé sur une table, vu du dessus.

- **Fond** : crème papier (`#F4ECDD`) avec un grain très léger ; le plateau est
  une carte blanc cassé posée dessus, ombre douce, coins légèrement arrondis.
- **Cases** : bordure fine encre (`#2B2B2B` à 20 %), bandeau de couleur en haut de
  chaque terrain avec un liseré plus foncé — comme une bande imprimée.
- **Typo** : *Playfair Display* (ou *DM Serif*) pour le logo et les noms de rues en
  petites capitales ; *Inter* pour tous les chiffres (montants, loyers), qui doivent
  rester lisibles à 11 px.
- **Logo** : un monogramme « M » art-déco dans un losange, façon enseigne de métro
  parisien, au centre du plateau. Dessiné en SVG, deux traits, rien d'imité.
- **Pions** : pastilles pleines avec un anneau blanc et une ombre portée courte —
  on lit instantanément qui est où, même à 3 sur la même case (léger décalage en
  éventail).
- **Cartes Chance / Caisse** : cartons crème qui arrivent en rotation légère
  (3-4°) au centre du plateau, avec un point d'interrogation art-déco pour Chance
  et un coffre stylisé pour la Caisse.
- **Panneau joueuse** : colonne à droite, fond blanc cassé, propriétés groupées en
  petites piles de couleur avec des points pour les maisons et un carré pour l'hôtel.

**Pourquoi je la recommande** : c'est la plus lisible à 6 joueuses (beaucoup
d'infos à l'écran) et la plus facile à faire tenir sur un écran de portable 13″ ;
le côté « papier » pardonne les densités d'information que le style néon supporte mal.

---

## Piste B — « Salon de Minuit »

Un Monopoly du soir, sombre et un peu chic, façon jeu de plateau numérique moderne.

- **Fond** : bleu nuit profond (`#141A2B`), plateau en carte gris-ardoise avec un
  filet doré très fin.
- **Cases** : les bandeaux de couleur deviennent lumineux sur fond sombre, avec un
  halo discret sur la case active ; les propriétés possédées prennent un liseré de
  la couleur de leur propriétaire.
- **Typo** : *Cormorant* doré pour les titres, *Inter* blanc cassé pour les données.
- **Pions** : jetons avec un dégradé et un reflet, ombre colorée sous le pion.
- **Dés** : gros dés blancs qui roulent au centre avec un rebond, éclairés par le
  dessous.
- **Ambiance** : les transitions de tour balayent l'écran d'un liseré doré, les
  montants gagnés/perdus montent en `+200 €` vert / `−90 €` rouge au-dessus du pion.

**Le compromis** : très joli en capture d'écran, un peu plus fatigant sur une
longue partie, et les couleurs claires (jaune, bleu ciel) demandent un travail de
contraste supplémentaire pour rester distinctes du blanc du texte.

---

Dans les deux cas, communs :

- grille CSS 11×11 en `aspect-ratio: 1`, plateau qui se réduit sans jamais se
  déformer ; en dessous de 1100 px de large, le panneau joueuse passe en tiroir ;
- déplacement du pion **case par case** (~90 ms par case, avec accélération/freinage)
  et non en téléportation ;
- lancer de dés animé (~600 ms) avant l'affichage du résultat, identique sur tous
  les écrans puisque le tirage vient du serveur ;
- surbrillance de la case active et de la joueuse dont c'est le tour ;
- journal d'événements et chat dans la même colonne, en deux onglets.
