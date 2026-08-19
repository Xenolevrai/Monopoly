/** Déroulé d'un tour : lancer, prison, doubles, fin de tour. */

import { rollDice } from './rng.js';
import { log, euros } from './log.js';
import { playerById, currentPlayer, activePlayers, config } from './queries.js';
import { charge, checkGameOver } from './money.js';
import { advance, resolveLanding, sendToJail } from './movement.js';
import { returnJailCard } from './cards.js';
import { startQueuedAuction } from './auction.js';

/** Prépare le tour de la joueuse courante. */
export function startTurn(state) {
  const player = currentPlayer(state);
  if (!player) return;
  state.dice = { values: null, doublesCount: 0, rolled: false, extraRoll: false, rollId: state.dice?.rollId ?? 0 };
  state.pending = {
    kind: 'roll',
    playerIds: [player.id],
    payload: player.inJail
      ? {
          inJail: true,
          jailTurns: player.jailTurns,
          canPayBail: player.cash >= config(state).jail.bail,
          hasJailCard: player.getOutOfJailCards > 0,
          bail: config(state).jail.bail,
        }
      : {},
  };
  log(state, 'turn', `C'est au tour de ${player.name}.`, { playerId: player.id, turn: state.turnCount });
}

/** Lancer de dés — gère aussi les tentatives de sortie de prison. */
export function roll(state, playerId, rng) {
  const player = playerById(state, playerId);
  const values = rollDice(rng, config(state).dice.count, config(state).dice.sides);
  const total = values.reduce((a, b) => a + b, 0);
  const isDouble = values.every((v) => v === values[0]);
  state.dice.values = values;
  state.dice.rolled = true;
  state.dice.rollId = (state.dice.rollId ?? 0) + 1;
  // Le jet est consommé : la résolution de la case décidera de la suite, et à
  // défaut `finishResolution` proposera la fin de tour.
  state.pending = { kind: null, playerIds: [] };
  log(state, 'roll', `${player.name} fait ${values.join(' et ')} (${total})${isDouble ? ' — double !' : ''}.`, {
    playerId,
    values,
    total,
    isDouble,
  });

  if (player.inJail) return rollInJail(state, player, total, isDouble);

  state.dice.doublesCount = isDouble ? state.dice.doublesCount + 1 : 0;
  if (state.dice.doublesCount >= config(state).dice.doublesToJail) {
    log(state, 'jail', `${player.name} fait un troisième double d'affilée.`, { playerId });
    sendToJail(state, playerId);
    return finishResolution(state);
  }

  state.dice.extraRoll = isDouble;
  advance(state, playerId, total);
  resolveLanding(state, playerId, { diceTotal: total });
  return finishResolution(state);
}

function rollInJail(state, player, total, isDouble) {
  if (isDouble) {
    player.inJail = false;
    player.jailTurns = 0;
    log(state, 'jail', `${player.name} fait un double et sort de prison.`, { playerId: player.id });
    advance(state, player.id, total);
    resolveLanding(state, player.id, { diceTotal: total });
    return finishResolution(state); // un double en prison ne donne pas de tour supplémentaire
  }

  player.jailTurns += 1;
  if (player.jailTurns >= config(state).jail.maxTurns) {
    log(state, 'jail', `${player.name} a passé ${config(state).jail.maxTurns} tours en prison : elle paie la caution.`, {
      playerId: player.id,
    });
    charge(state, player.id, config(state).jail.bail, 'caution de sortie de prison');
    player.inJail = false;
    player.jailTurns = 0;
    advance(state, player.id, total);
    resolveLanding(state, player.id, { diceTotal: total });
  } else {
    log(state, 'jail', `${player.name} reste en prison (tentative ${player.jailTurns}/${config(state).jail.maxTurns}).`, {
      playerId: player.id,
    });
  }
  return finishResolution(state);
}

/** Paie la caution de 50 € pour sortir avant de lancer les dés. */
export function payBail(state, playerId) {
  const player = playerById(state, playerId);
  if (!player.inJail) return { ok: false, error: "Vous n'êtes pas en prison." };
  if (player.cash < config(state).jail.bail) return { ok: false, error: 'Fonds insuffisants pour la caution.' };
  player.cash -= config(state).jail.bail;
  player.inJail = false;
  player.jailTurns = 0;
  log(state, 'jail', `${player.name} paie ${euros(config(state).jail.bail)} de caution et sort de prison.`, { playerId });
  state.pending = { kind: 'roll', playerIds: [playerId], payload: {} };
  return { ok: true };
}

/** Utilise une carte « libérée de prison ». */
export function useJailCard(state, playerId) {
  const player = playerById(state, playerId);
  if (!player.inJail) return { ok: false, error: "Vous n'êtes pas en prison." };
  if (player.getOutOfJailCards <= 0) return { ok: false, error: "Vous n'avez pas cette carte." };
  returnJailCard(state, playerId);
  player.inJail = false;
  player.jailTurns = 0;
  log(state, 'jail', `${player.name} utilise sa carte « libérée de prison ».`, { playerId });
  state.pending = { kind: 'roll', playerIds: [playerId], payload: {} };
  return { ok: true };
}

/**
 * Après la résolution d'une case : si rien n'attend de décision, la joueuse peut
 * gérer ses biens puis finir son tour.
 */
export function finishResolution(state) {
  if (state.phase === 'finished') return { ok: true };
  if (state.pending.kind) return { ok: true }; // achat, dette, enchère, choix de carte…
  const player = currentPlayer(state);
  state.pending = {
    kind: 'end_turn',
    playerIds: [player.id],
    payload: { extraRoll: Boolean(state.dice.extraRoll) },
  };
  return { ok: true };
}

/** Termine le tour : relance si double, sinon passe à la joueuse suivante. */
export function endTurn(state, playerId) {
  if (state.phase === 'finished') return { ok: false, error: 'La partie est terminée.' };

  // Les biens d'une faillite envers la banque partent aux enchères avant la suite.
  if (state.auctionQueue?.length && startQueuedAuction(state)) return { ok: true };

  if (state.dice.extraRoll) {
    const doublesCount = state.dice.doublesCount;
    state.dice = { values: state.dice.values, doublesCount, rolled: false, extraRoll: false, rollId: state.dice.rollId };
    state.pending = { kind: 'roll', playerIds: [playerId], payload: {} };
    log(state, 'turn', `${playerById(state, playerId).name} rejoue (double).`, { playerId });
    return { ok: true };
  }

  nextPlayer(state);
  return { ok: true };
}

/** Passe la main à la prochaine joueuse encore en lice. */
export function nextPlayer(state) {
  if (checkGameOver(state)) return;
  const count = state.players.length;
  let index = state.currentPlayerIndex;
  for (let i = 0; i < count; i++) {
    index = (index + 1) % count;
    if (!state.players[index].bankrupt) break;
  }
  state.currentPlayerIndex = index;
  state.turnCount += 1;
  startTurn(state);
}

/** Ordre de jeu : chaque joueuse lance les dés, le plus haut score commence. */
export function determineTurnOrder(state, rng) {
  const rolls = state.players.map((player) => {
    const values = rollDice(rng, config(state).dice.count, config(state).dice.sides);
    return { player, total: values.reduce((a, b) => a + b, 0), values };
  });
  rolls.sort((a, b) => b.total - a.total);
  rolls.forEach((entry, index) => {
    entry.player.order = index;
    log(state, 'setup', `${entry.player.name} fait ${entry.total} au tirage de l'ordre de jeu.`, {
      playerId: entry.player.id,
      total: entry.total,
      values: entry.values,
    });
  });
  state.players = rolls.map((r) => r.player);
  state.currentPlayerIndex = 0;
  log(state, 'setup', `Ordre de jeu : ${state.players.map((p) => p.name).join(', ')}.`, {
    order: state.players.map((p) => p.id),
  });
}

/** Nombre de joueuses encore en jeu. */
export function remainingPlayers(state) {
  return activePlayers(state).length;
}
