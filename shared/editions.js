/**
 * Le catalogue des éditions.
 *
 * Une édition, c'est un plateau, des cartes, des règles chiffrées et une liste
 * de mécaniques activées. Le moteur ne connaît aucune édition en particulier :
 * il lit celle que la partie référence par son `editionId`. Ajouter une édition,
 * c'est donc ajouter un dossier — pas toucher au moteur.
 *
 * Chaque édition se joue en français ou en anglais. Les fichiers de base sont en
 * français ; `locales/en.json` est un **calque de mots** posé par-dessus, qui ne
 * touche ni aux prix, ni aux positions, ni aux effets des cartes. Une carte reste
 * la même carte : seule sa formulation change.
 */
import classicBoard from './editions/classic-fr/board.json' with { type: 'json' };
import classicGroups from './editions/classic-fr/groups.json' with { type: 'json' };
import classicCards from './editions/classic-fr/cards.json' with { type: 'json' };
import classicMeta from './editions/classic-fr/edition.json' with { type: 'json' };
import classicEn from './editions/classic-fr/locales/en.json' with { type: 'json' };

import hpBoard from './editions/harry-potter-fr/board.json' with { type: 'json' };
import hpGroups from './editions/harry-potter-fr/groups.json' with { type: 'json' };
import hpCards from './editions/harry-potter-fr/cards.json' with { type: 'json' };
import hpMeta from './editions/harry-potter-fr/edition.json' with { type: 'json' };
import hpEn from './editions/harry-potter-fr/locales/en.json' with { type: 'json' };

import hogBoard from './editions/poudlard-points/board.json' with { type: 'json' };
import hogGroups from './editions/poudlard-points/groups.json' with { type: 'json' };
import hogCards from './editions/poudlard-points/cards.json' with { type: 'json' };
import hogMeta from './editions/poudlard-points/edition.json' with { type: 'json' };
import hogEn from './editions/poudlard-points/locales/en.json' with { type: 'json' };

import avBoard from './editions/avengers-fr/board.json' with { type: 'json' };
import avGroups from './editions/avengers-fr/groups.json' with { type: 'json' };
import avCards from './editions/avengers-fr/cards.json' with { type: 'json' };
import avMeta from './editions/avengers-fr/edition.json' with { type: 'json' };
import avEn from './editions/avengers-fr/locales/en.json' with { type: 'json' };

import { applyExtensions } from './extensions.js';

/** Types de cases achetables, quel que soit le thème. */
export const OWNABLE_TYPES = ['property', 'railroad', 'utility'];

/** Les langues dans lesquelles une partie peut se jouer. */
export const LOCALES = ['fr', 'en'];
export const DEFAULT_LOCALE = 'fr';

function build(meta, board, groups, cards, locales) {
  return { ...meta, board, groups, cards, locales };
}

/** @type {Record<string, object>} */
const SOURCES = {
  'classic-fr': build(classicMeta, classicBoard, classicGroups, classicCards, { en: classicEn }),
  'harry-potter-fr': build(hpMeta, hpBoard, hpGroups, hpCards, { en: hpEn }),
  'avengers-fr': build(avMeta, avBoard, avGroups, avCards, { en: avEn }),
  'poudlard-points': build(hogMeta, hogBoard, hogGroups, hogCards, { en: hogEn }),
};

/**
 * Applique un calque de langue à une édition.
 *
 * Tout ce qui n'est pas traduit reste tel quel : une locale incomplète dégrade
 * proprement vers le français plutôt que d'afficher des trous.
 */
function translate(edition, pack) {
  if (!pack) return edition;

  const board = edition.board.map((space) => {
    const t = pack.spaces?.[space.id];
    return t ? { ...space, ...t } : space;
  });

  const groups = Object.fromEntries(
    Object.entries(edition.groups).map(([id, group]) => [
      id,
      pack.groups?.[id] ? { ...group, label: pack.groups[id] } : group,
    ]),
  );

  const cards = Object.fromEntries(
    Object.entries(edition.cards).map(([deck, list]) => [
      deck,
      list.map((card) => (pack.cards?.[card.id] ? { ...card, text: pack.cards[card.id] } : card)),
    ]),
  );

  const decks = Object.fromEntries(
    Object.entries(edition.theming.decks).map(([id, deck]) => [
      id,
      pack.decks?.[id] ? { ...deck, label: pack.decks[id] } : deck,
    ]),
  );

  const tokens = edition.tokens.map((token) =>
    pack.tokens?.[token.id] ? { ...token, label: pack.tokens[token.id] } : token,
  );

  const factions = edition.factions && {
    ...edition.factions,
    label: pack.factions?.label ?? edition.factions.label,
    prompt: pack.factions?.prompt ?? edition.factions.prompt,
    options: edition.factions.options.map((faction) =>
      pack.factions?.options?.[faction.id]
        ? { ...faction, label: pack.factions.options[faction.id] }
        : faction,
    ),
  };

  return {
    ...edition,
    board,
    groups,
    cards,
    tokens,
    ...(factions ? { factions } : {}),
    name: pack.name ?? edition.name,
    theme: pack.theme ?? edition.theme,
    tagline: pack.tagline ?? edition.tagline,
    summary: pack.summary ?? edition.summary,
    currency: { ...edition.currency, ...(pack.currency ?? {}) },
    buildingLabels: { ...edition.buildingLabels, ...(pack.buildingLabels ?? {}) },
    vocabulary: { ...edition.vocabulary, ...(pack.vocabulary ?? {}) },
    theming: {
      ...edition.theming,
      decks,
      centerTitle: pack.centerTitle ?? edition.theming.centerTitle,
      centerSubtitle: pack.centerSubtitle ?? edition.theming.centerSubtitle,
    },
  };
}

/** Une édition traduite est calculée une fois puis conservée. */
const CACHE = new Map();

export const DEFAULT_EDITION = 'classic-fr';

/** Les éditions en français — la forme dans laquelle les fichiers sont écrits. */
export const EDITIONS = SOURCES;

/**
 * L'édition demandée dans la langue demandée, ou le classique en français si
 * l'identifiant est inconnu.
 */
export function getEdition(editionId = DEFAULT_EDITION, locale = DEFAULT_LOCALE) {
  const source = SOURCES[editionId] ?? SOURCES[DEFAULT_EDITION];
  const lang = LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  if (lang === DEFAULT_LOCALE) return source;

  const key = `${source.id}:${lang}`;
  if (!CACHE.has(key)) CACHE.set(key, translate(source, source.locales?.[lang]));
  return CACHE.get(key);
}

/**
 * L'édition d'une partie en cours, dans la langue choisie à sa création, avec
 * les extensions activées (le cas échéant) déjà fusionnées. Tout le reste du
 * code — moteur, client, tests — continue de lire une édition ordinaire ; il
 * n'a jamais besoin de savoir qu'une extension existe.
 */
export function editionOf(state) {
  const base = getEdition(state?.editionId, state?.locale);
  return applyExtensions(base, state?.extensionIds);
}

/** Ce qu'il faut pour dessiner la galerie de sélection, sans charger les plateaux. */
export function listEditions(locale = DEFAULT_LOCALE) {
  return Object.keys(SOURCES).map((id) => {
    const edition = getEdition(id, locale);
    return {
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
    };
  });
}
