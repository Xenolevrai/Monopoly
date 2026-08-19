/**
 * Le catalogue des éditions.
 *
 * Une édition, c'est un plateau, des cartes, des règles chiffrées et une liste
 * de mécaniques activées. Le moteur ne connaît aucune édition en particulier :
 * il lit celle que la partie référence par son `editionId`. Ajouter une édition,
 * c'est donc ajouter un dossier — pas toucher au moteur.
 */
import classicBoard from './editions/classic-fr/board.json' with { type: 'json' };
import classicGroups from './editions/classic-fr/groups.json' with { type: 'json' };
import classicCards from './editions/classic-fr/cards.json' with { type: 'json' };
import classicMeta from './editions/classic-fr/edition.json' with { type: 'json' };

import hpBoard from './editions/harry-potter-fr/board.json' with { type: 'json' };
import hpGroups from './editions/harry-potter-fr/groups.json' with { type: 'json' };
import hpCards from './editions/harry-potter-fr/cards.json' with { type: 'json' };
import hpMeta from './editions/harry-potter-fr/edition.json' with { type: 'json' };

import avBoard from './editions/avengers-fr/board.json' with { type: 'json' };
import avGroups from './editions/avengers-fr/groups.json' with { type: 'json' };
import avCards from './editions/avengers-fr/cards.json' with { type: 'json' };
import avMeta from './editions/avengers-fr/edition.json' with { type: 'json' };

/** Types de cases achetables, quel que soit le thème. */
export const OWNABLE_TYPES = ['property', 'railroad', 'utility'];

function build(meta, board, groups, cards) {
  return { ...meta, board, groups, cards };
}

/** @type {Record<string, object>} */
export const EDITIONS = {
  'classic-fr': build(classicMeta, classicBoard, classicGroups, classicCards),
  'harry-potter-fr': build(hpMeta, hpBoard, hpGroups, hpCards),
  'avengers-fr': build(avMeta, avBoard, avGroups, avCards),
};

export const DEFAULT_EDITION = 'classic-fr';

/** L'édition demandée, ou le classique si l'identifiant est inconnu. */
export function getEdition(editionId = DEFAULT_EDITION) {
  return EDITIONS[editionId] ?? EDITIONS[DEFAULT_EDITION];
}

/** L'édition d'une partie en cours. */
export function editionOf(state) {
  return getEdition(state?.editionId);
}

/** Ce qu'il faut pour dessiner la galerie de sélection, sans charger les plateaux. */
export function listEditions() {
  return Object.values(EDITIONS).map((edition) => ({
    id: edition.id,
    name: edition.name,
    theme: edition.theme,
    tagline: edition.tagline,
    summary: edition.summary,
    playerCount: edition.playerCount,
    turnMode: edition.turnMode,
    winCondition: edition.winCondition,
    mechanics: edition.mechanics,
    theming: edition.theming,
    // `edition.board` est le tableau des cases (il a écrasé le `{ size }` de la
    // fiche), donc la taille se lit sur sa longueur — seule source fiable.
    boardSize: edition.board.length,
  }));
}
