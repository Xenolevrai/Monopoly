/**
 * Accès aux données de jeu, partagé entre le serveur et le client.
 *
 * Tout passe par l'édition de la partie en cours : ces fonctions prennent donc
 * l'état (ou un identifiant d'édition) en premier argument. C'est ce qui permet
 * à un même moteur de faire tourner plusieurs éditions sans se dupliquer.
 */
import { getEdition, editionOf, EDITIONS, DEFAULT_EDITION, listEditions, OWNABLE_TYPES } from './editions.js';

export { getEdition, editionOf, EDITIONS, DEFAULT_EDITION, listEditions, OWNABLE_TYPES };

/** Accepte indifféremment un état de partie ou un identifiant d'édition. */
function resolve(source) {
  if (typeof source === 'string') return getEdition(source);
  return editionOf(source);
}

/** Le plateau de cette édition. */
export function boardOf(source) {
  return resolve(source).board;
}

/** Les règles chiffrées et les mécaniques activées. */
export function rulesOf(source) {
  return resolve(source);
}

/** Les deux piles de cartes. */
export function cardsOf(source) {
  return resolve(source).cards;
}

/** Une case, par son numéro (l'index tourne autour du plateau). */
export function getSpace(source, id) {
  const board = boardOf(source);
  return board[((id % board.length) + board.length) % board.length];
}

/** Un groupe de couleur (ou les gares, ou les compagnies). */
export function getGroup(source, groupId) {
  return resolve(source).groups[groupId];
}

/** Toutes les cases achetables : terrains, gares, compagnies. */
export function ownableSpaces(source) {
  return boardOf(source).filter((s) => OWNABLE_TYPES.includes(s.type));
}

/** Les cases d'un groupe, dans l'ordre du plateau. */
export function spacesOfGroup(source, groupId) {
  return getGroup(source, groupId).spaces.map((id) => getSpace(source, id));
}

/** @returns {boolean} */
export function isOwnable(source, id) {
  return OWNABLE_TYPES.includes(getSpace(source, id).type);
}

/** Nombre de cases à parcourir de `from` à `to` en avançant. */
export function forwardDistance(source, from, to) {
  const size = boardOf(source).length;
  return (((to - from) % size) + size) % size;
}

/**
 * Vrai si un déplacement de `from` vers `to` en avançant franchit (ou atteint)
 * la case Départ. Un déplacement nul ne compte pas.
 */
export function passesGo(source, from, to) {
  const size = boardOf(source).length;
  const steps = forwardDistance(source, from, to);
  return steps > 0 && from + steps >= size;
}
