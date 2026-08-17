/**
 * Point d'entrée unique des données de jeu partagées entre le serveur et le client.
 *
 * Les données (plateau, cartes, règles) sont volontairement en JSON pur :
 * on peut corriger un loyer ou un texte de carte sans toucher au code du moteur.
 */
import board from './data/board.json' with { type: 'json' };
import groups from './data/groups.json' with { type: 'json' };
import cards from './data/cards.json' with { type: 'json' };
import rules from './data/rules.json' with { type: 'json' };

export { board, groups, cards, rules };

/** Types de cases achetables. */
export const OWNABLE_TYPES = ['property', 'railroad', 'utility'];

/** @param {number} id */
export function getSpace(id) {
  return board[((id % board.length) + board.length) % board.length];
}

/** @param {string} groupId */
export function getGroup(groupId) {
  return groups[groupId];
}

/** Toutes les cases achetables (terrains + gares + compagnies). */
export function ownableSpaces() {
  return board.filter((s) => OWNABLE_TYPES.includes(s.type));
}

/** Les cases d'un groupe de couleur, dans l'ordre du plateau. */
export function spacesOfGroup(groupId) {
  return groups[groupId].spaces.map(getSpace);
}

/** @param {number} id */
export function isOwnable(id) {
  return OWNABLE_TYPES.includes(getSpace(id).type);
}

/**
 * Nombre de cases à parcourir de `from` à `to` en avançant (sens du jeu).
 * Sert à savoir si on passe par la case Départ.
 */
export function forwardDistance(from, to) {
  return (((to - from) % board.length) + board.length) % board.length;
}

/**
 * Vrai si un déplacement de `from` vers `to` en avançant franchit (ou atteint)
 * la case Départ. Un déplacement nul ne compte pas.
 */
export function passesGo(from, to) {
  const steps = forwardDistance(from, to);
  return steps > 0 && from + steps >= board.length;
}
