/**
 * Données de plateau côté client, lues dans l'édition de la partie en cours.
 *
 * Les éditions sont importées depuis `shared/` : le client et le serveur lisent
 * exactement les mêmes prix, les mêmes loyers et les mêmes cartes.
 */
import {
  getEdition,
  editionOf,
  listEditions,
  DEFAULT_EDITION,
  DEFAULT_LOCALE,
  LOCALES,
} from '../../../shared/editions.js';
import { compatibleExtensions, conflictingPositions } from '../../../shared/extensions.js';

export { getEdition, listEditions, DEFAULT_EDITION, DEFAULT_LOCALE, LOCALES, compatibleExtensions, conflictingPositions };

/**
 * L'édition d'une partie, dans sa langue, **extensions comprises** (ou le
 * classique en français tant qu'on n'est dans aucune partie).
 *
 * Passer par `editionOf` et non `getEdition` est indispensable : sans ça, le
 * client dessinait le plateau d'origine pendant que le serveur en jouait un
 * autre — cases Spin affichées « Chance », titres spéciaux invisibles.
 */
export function editionFor(state) {
  return editionOf(state);
}

/** La langue de la partie en cours. */
export function localeOf(state) {
  return LOCALES.includes(state?.locale) ? state.locale : DEFAULT_LOCALE;
}

export function boardOf(state) {
  return editionFor(state).board;
}

export function ownableSpaces(state) {
  return boardOf(state).filter((s) => ['property', 'railroad', 'utility', 'special_property'].includes(s.type));
}

export function groupsOf(state) {
  return editionFor(state).groups;
}

/** Le côté de la grille : 11 pour un plateau de 40 cases, 6 pour 20. */
export function gridSize(state) {
  return boardOf(state).length / 4 + 1;
}

/**
 * Position d'une case dans la grille CSS.
 * Départ en bas à droite, on tourne dans le sens du jeu.
 */
export function gridPosition(state, id) {
  const size = gridSize(state);
  const side = size - 1; // cases par côté, coin de départ inclus
  if (id <= side) return { col: size - id, row: size, side: 'bottom' };
  if (id <= side * 2) return { col: 1, row: size - (id - side), side: 'left' };
  if (id <= side * 3) return { col: 1 + (id - side * 2), row: 1, side: 'top' };
  return { col: size, row: 1 + (id - side * 3), side: 'right' };
}

/** Les coins sont plus grands que les cases de bord, comme sur le plateau papier. */
const CORNER_SPAN = 1.55;

function track(index, size) {
  const total = CORNER_SPAN * 2 + (size - 2);
  const before = index === 1 ? 0 : CORNER_SPAN + (index - 2);
  const span = index === 1 || index === size ? CORNER_SPAN : 1;
  return { start: (before / total) * 100, size: (span / total) * 100 };
}

/** Centre et dimensions d'une case, en pourcentage du plateau. */
export function spaceRect(state, id) {
  const size = gridSize(state);
  const { col, row } = gridPosition(state, id);
  const c = track(col, size);
  const r = track(row, size);
  return { x: c.start + c.size / 2, y: r.start + r.size / 2, w: c.size, h: r.size };
}

/** Le gabarit `grid-template` correspondant à cette édition. */
export function gridTemplate(state) {
  const size = gridSize(state);
  return `${CORNER_SPAN}fr repeat(${size - 2}, 1fr) ${CORNER_SPAN}fr`;
}

/** Couleur du groupe d'une case, ou null. */
export function groupColor(state, space) {
  return space.group ? (groupsOf(state)[space.group]?.color ?? null) : null;
}

/** Les cases achetables d'une joueuse, regroupées par couleur. */
export function propertiesByGroup(state, playerId) {
  const board = boardOf(state);
  const groups = groupsOf(state);
  const owned = Object.values(state.properties ?? {}).filter((p) => p.ownerId === playerId);

  const byGroup = new Map();
  for (const prop of owned) {
    const space = board[prop.spaceId];
    const list = byGroup.get(space.group) ?? [];
    list.push({ ...prop, space });
    byGroup.set(space.group, list);
  }

  // Ordre du plateau, pour que l'affichage soit stable.
  return [...byGroup.entries()]
    .sort((a, b) => groups[a[0]].spaces[0] - groups[b[0]].spaces[0])
    .map(([groupId, items]) => ({
      group: groups[groupId],
      items: items.sort((a, b) => a.spaceId - b.spaceId),
      complete: groups[groupId].spaces.every((id) => state.properties[id].ownerId === playerId),
    }));
}

/** Formate un montant dans la monnaie de l'édition : 1 500 €, 320 points… */
export function money(state, amount) {
  const label = editionFor(state).currency.label ?? '€';
  // Séparateur de milliers selon la langue : « 1 500 € » ou « 1,500 $ ».
  const formatted = Math.round(amount ?? 0).toLocaleString(localeOf(state) === 'en' ? 'en-GB' : 'fr-FR');
  return `${formatted} ${label}`;
}

/**
 * Comment cette édition appelle ses constructions : maisons et hôtels au
 * classique, chaumières et châteaux à Poudlard, bases et quartiers généraux
 * chez les Avengers. Le moteur, lui, ne connaît que « maison » et « hôtel ».
 */
const DEFAULT_BUILDINGS = {
  house: 'Maison', houses: 'Maisons', hotel: 'Hôtel', hotels: 'Hôtels',
  skyscraper: 'Gratte-ciel', skyscrapers: 'Gratte-ciels', depot: 'Dépôt', depots: 'Dépôts',
};

export function buildingLabels(state) {
  return { ...DEFAULT_BUILDINGS, ...(editionFor(state).buildingLabels ?? {}) };
}

/**
 * Le niveau de construction d'une case : 0-4 maisons, 5 hôtel, 6 gratte-ciel.
 * Même lecture que le moteur — c'est de l'affichage, pas une règle.
 */
export function buildingLevel(prop) {
  if (prop?.skyscraper) return 6;
  return prop?.hotel ? 5 : (prop?.houses ?? 0);
}

/**
 * Ce que le bouton « construire » doit proposer sur cette case, et pourquoi il
 * est éventuellement grisé.
 *
 * Le moteur reste seul juge : il refuserait une construction illégale de toute
 * façon. Ce qu'on calcule ici, c'est uniquement l'étiquette et l'état visuel du
 * bouton — sans quoi il annoncerait « + Maison » sur une gare, ou « + Hôtel »
 * là où c'est un gratte-ciel qu'on pose.
 *
 * @returns {{ label: string, cost: number, blocked: string|null }|null}
 */
export function nextBuildStep(state, prop, t) {
  const edition = editionFor(state);
  const space = boardOf(state)[prop.spaceId];
  const labels = buildingLabels(state);
  const mechanics = edition.mechanics ?? {};
  if (prop.mortgaged) return null;

  // Le dépôt de gare : un aménagement à part, sans condition de groupe.
  if (space.type === 'railroad') {
    if (!mechanics.trainDepots || prop.depot) return null;
    return { label: labels.depot, cost: mechanics.trainDepots.cost ?? 100, blocked: null };
  }
  if (space.type !== 'property') return null;

  const level = buildingLevel(prop);
  if (level === 6) return null;
  if (level === 5 && !mechanics.skyscrapers) return null;
  if (level === 4 && !mechanics.hotels) return null;

  const groupSpaces = space.group ? (groupsOf(state)[space.group]?.spaces ?? []) : [];
  const mine = groupSpaces.filter((id) => state.properties[id]?.ownerId === prop.ownerId);
  const need = mechanics.majorityBuildRule
    ? Math.floor(groupSpaces.length / 2) + 1
    : groupSpaces.length;

  const label = level === 5 ? labels.skyscraper : level === 4 ? labels.hotel : labels.house;
  // Le gratte-ciel, lui, réclame le groupe entier coiffé d'hôtels.
  if (level === 5) {
    const crowned =
      mine.length === groupSpaces.length &&
      groupSpaces.every((id) => buildingLevel(state.properties[id]) >= 5);
    return { label, cost: space.houseCost, blocked: crowned ? null : t('needCrownedGroup') };
  }
  const blocked =
    mine.length >= need
      ? null
      : need < groupSpaces.length
        ? t('needMajority', need, groupSpaces.length)
        : t('needFullGroup');
  return { label, cost: space.houseCost, blocked };
}

/** Raccourci pour les écrans qui n'ont pas l'état sous la main (euros). */
export function euros(amount) {
  return `${Math.round(amount ?? 0).toLocaleString('fr-FR')} €`;
}
