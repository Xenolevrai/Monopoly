/** Utilitaires de test : monter une partie déterministe en deux lignes. */
import { createGame, addPlayer, startGame, dispatch } from '../server/engine/index.js';
import { buildDecks } from '../server/engine/cards.js';
import { startTurn } from '../server/engine/turn.js';
import { playerById } from '../server/engine/queries.js';

/**
 * Crée une partie déjà lancée, avec un ordre de jeu imposé (pas de tirage
 * aléatoire) pour que les tests restent lisibles.
 * @param {string[]} names
 */
export function newGame(names = ['Julie', 'Sophie'], { seed = 42, settings = {} } = {}) {
  const game = createGame('TEST01', 'p0', { seed });
  names.forEach((name, i) => addPlayer(game, { id: `p${i}`, name, token: null }));
  game.state.hostId = 'p0';
  Object.assign(game.state.settings, settings);

  // On court-circuite `startGame` pour figer l'ordre de jeu.
  buildDecks(game.state, game.rng);
  game.state.phase = 'playing';
  game.state.turnCount = 1;
  game.state.currentPlayerIndex = 0;
  startTurn(game.state);
  return game;
}

/** Force le résultat des prochains lancers de dés. */
export function forceDice(game, rolls) {
  const queue = [...rolls];
  const original = game.rng.int;
  game.rng.int = (max) => {
    if (max === 6 && queue.length) return queue.shift() - 1;
    return original(max);
  };
  return game;
}

/** Raccourci : joue une action et s'assure qu'elle est acceptée. */
export function act(game, playerId, action) {
  const result = dispatch(game, playerId, action);
  if (!result.ok) throw new Error(`Action ${action.type} refusée : ${result.error}`);
  return result;
}

/** Attribue une propriété directement (mise en place de scénario). */
export function give(game, playerId, spaceIds, { houses = 0, hotel = false, mortgaged = false } = {}) {
  for (const spaceId of [].concat(spaceIds)) {
    Object.assign(game.state.properties[spaceId], { ownerId: playerId, houses, hotel, mortgaged });
  }
}

/** Fixe le solde d'une joueuse. */
export function setCash(game, playerId, cash) {
  playerById(game.state, playerId).cash = cash;
}

/** Place une joueuse sur une case sans déclencher de résolution. */
export function place(game, playerId, spaceId) {
  playerById(game.state, playerId).position = spaceId;
}

export { dispatch, playerById, startGame, addPlayer, createGame };
