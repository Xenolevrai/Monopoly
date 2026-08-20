/** Déroulé d'un tour : lancer, prison, doubles, fin de tour. */

import { rollDice } from './rng.js';
import { log, say, amountText } from './log.js';
import { playerById, currentPlayer, activePlayers, config } from './queries.js';
import { charge, checkGameOver } from './money.js';
import { advance, resolveLanding, sendToJail } from './movement.js';
import { returnJailCard, getCard, applyCardAction, loseVaultCard } from './cards.js';
import { startQueuedAuction } from './auction.js';

/**
 * La caution et le paquet de cartes qui s'appliquent à une joueuse en prison,
 * selon la geôle où elle se trouve (`jailTier`). Générique : sans geôle
 * sévère déclarée par l'édition (`jail.superBail`/`jail.superDeck`), retombe
 * toujours sur la prison classique.
 */
function jailContext(state, player) {
  const jail = config(state).jail;
  const isSuper = player.jailTier === 'super';
  return {
    bail: isSuper ? (jail.superBail ?? jail.bail) : jail.bail,
    deck: isSuper ? (jail.superDeck ?? jail.deck) : jail.deck,
  };
}

/**
 * Les cartes détenues qui rapportent à chaque tour (`perTurn`). Générique : le
 * moteur applique l'effet déclaré par la carte, sans savoir d'où elle vient.
 */
function applyRecurringCards(state, player) {
  for (const cardId of player.saleCards ?? []) {
    const card = getCard(state, cardId);
    if (card?.perTurn) applyCardAction(state, player.id, card.perTurn, {});
  }
}

/** Prépare le tour de la joueuse courante. */
export function startTurn(state) {
  const player = currentPlayer(state);
  if (!player) return;
  state.dice = { values: null, doublesCount: 0, rolled: false, extraRoll: false, rollId: state.dice?.rollId ?? 0 };
  applyRecurringCards(state, player);

  // Une édition/extension qui déclare `jail.deck` remplace le jet de dés pour
  // tenter les doubles par un choix explicite : payer, ou tirer une carte du
  // paquet propre à cette geôle (Corruption / Super Corruption…).
  const jail = jailContext(state, player);
  if (player.inJail && jail.deck) {
    state.pending = {
      kind: 'card_choice',
      playerIds: [player.id],
      payload: {
        options: [
          { index: 0, label: say(state, 'jailPayOption', { amount: amountText(state, jail.bail) }) },
          { index: 1, label: say(state, 'jailDrawOption') },
        ],
        actions: [{ type: 'pay_bail' }, { type: 'draw_card', deck: jail.deck }],
      },
    };
    log(state, 'turn', say(state, 'turnOf', { name: player.name }), { playerId: player.id, turn: state.turnCount });
    return;
  }

  state.pending = {
    kind: 'roll',
    playerIds: [player.id],
    payload: player.inJail
      ? {
          inJail: true,
          jailTurns: player.jailTurns,
          canPayBail: player.cash >= jail.bail,
          hasJailCard: player.getOutOfJailCards > 0,
          bail: jail.bail,
        }
      : {},
  };
  log(state, 'turn', say(state, 'turnOf', { name: player.name }), { playerId: player.id, turn: state.turnCount });
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
  log(state, 'roll', say(state, 'rolls', { name: player.name, values: values.join(' + '), total, isDouble }), {
    playerId,
    values,
    total,
    isDouble,
  });

  if (player.inJail) return rollInJail(state, player, total, isDouble);

  state.dice.doublesCount = isDouble ? state.dice.doublesCount + 1 : 0;
  // Une extension peut désactiver l'envoi en prison au bout de trois doubles :
  // on relance et on continue d'avancer, comme n'importe quel double normal.
  const doublesJailEnabled = !config(state).mechanics?.doublesNeverJail;
  if (doublesJailEnabled && state.dice.doublesCount >= config(state).dice.doublesToJail) {
    log(state, 'jail', say(state, 'thirdDouble', { name: player.name }), { playerId });
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
    log(state, 'jail', say(state, 'jailDouble', { name: player.name }), { playerId: player.id });
    advance(state, player.id, total);
    resolveLanding(state, player.id, { diceTotal: total });
    return finishResolution(state); // un double en prison ne donne pas de tour supplémentaire
  }

  player.jailTurns += 1;
  if (player.jailTurns >= config(state).jail.maxTurns) {
    log(state, 'jail', say(state, 'jailMaxed', { name: player.name, max: config(state).jail.maxTurns }), {
      playerId: player.id,
    });
    charge(state, player.id, config(state).jail.bail, say(state, 'reasonBail'));
    player.inJail = false;
    player.jailTurns = 0;
    advance(state, player.id, total);
    resolveLanding(state, player.id, { diceTotal: total });
  } else {
    log(state, 'jail', say(state, 'jailStays', { name: player.name, turn: player.jailTurns, max: config(state).jail.maxTurns }), {
      playerId: player.id,
    });
  }
  return finishResolution(state);
}

/** Paie la caution de 50 € pour sortir avant de lancer les dés. */
export function payBail(state, playerId) {
  const player = playerById(state, playerId);
  if (!player.inJail) return { ok: false, error: "Vous n'êtes pas en prison." };
  const bail = jailContext(state, player).bail;
  if (player.cash < bail) return { ok: false, error: 'Fonds insuffisants pour la caution.' };
  player.cash -= bail;
  player.inJail = false;
  player.jailTurns = 0;
  log(state, 'jail', say(state, 'jailBail', { name: player.name, amount: amountText(state, bail) }), { playerId });
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
  log(state, 'jail', say(state, 'jailCard', { name: player.name }), { playerId });
  state.pending = { kind: 'roll', playerIds: [playerId], payload: {} };
  return { ok: true };
}

/**
 * Le dé facultatif que certaines éditions/extensions posent en fin de case
 * (`mechanics.buyDie`) : un jet de plus, une fois par lancer, pour tenter de
 * gagner une carte du coffre — ou d'en faire perdre une à une adversaire.
 * Générique : les faces gagnantes et volantes sont décrites par la mécanique.
 */
export function rollBuyDie(state, playerId, rng) {
  const cfg = config(state).mechanics?.buyDie;
  if (!cfg) return { ok: false, error: "Cette partie n'a pas de dé d'Achat." };
  if (state.dice.buyDieUsed) return { ok: false, error: "Vous avez déjà lancé le dé d'Achat." };

  const player = playerById(state, playerId);
  const value = rollDice(rng, 1, cfg.sides)[0];
  state.dice.buyDieUsed = true;
  log(state, 'roll', say(state, 'buyDieRoll', { name: player.name, value }), { playerId, value });

  const visible = state.saleVault?.visible ?? [];
  if (value >= cfg.gainFrom && visible.length) {
    // On choisit soi-même la carte prise dans le présentoir : c'est tout
    // l'intérêt d'un coffre à cartes visibles.
    state.pending = {
      kind: 'card_choice',
      playerIds: [playerId],
      payload: {
        options: visible.map((cardId, index) => ({ index, label: getCard(state, cardId)?.text ?? cardId })),
        actions: visible.map((cardId) => ({ type: 'take_sale_card', cardId })),
      },
    };
    return { ok: true };
  }

  if (value === cfg.stealOn) {
    const victim = activePlayers(state).find((p) => p.id !== playerId && (p.saleCards ?? []).length);
    if (victim) loseVaultCard(state, victim.id);
    else log(state, 'card', say(state, 'buyDieNothing', { name: player.name }), { playerId });
    return { ok: true };
  }

  log(state, 'card', say(state, 'buyDieNothing', { name: player.name }), { playerId });
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
  const buyDie = config(state).mechanics?.buyDie;
  state.pending = {
    kind: 'end_turn',
    playerIds: [player.id],
    payload: {
      extraRoll: Boolean(state.dice.extraRoll),
      // Proposé seulement tant qu'il reste à lancer : le client n'a pas à
      // connaître la règle, il affiche le bouton si le moteur l'annonce.
      canRollBuyDie: Boolean(buyDie && state.dice.rolled && !state.dice.buyDieUsed),
    },
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
    log(state, 'turn', say(state, 'playsAgain', { name: playerById(state, playerId).name }), { playerId });
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
    log(state, 'setup', say(state, 'orderRoll', { name: entry.player.name, total: entry.total }), {
      playerId: entry.player.id,
      total: entry.total,
      values: entry.values,
    });
  });
  state.players = rolls.map((r) => r.player);
  state.currentPlayerIndex = 0;
  log(state, 'setup', say(state, 'turnOrder', { names: state.players.map((p) => p.name).join(', ') }), {
    order: state.players.map((p) => p.id),
  });
}

/** Nombre de joueuses encore en jeu. */
export function remainingPlayers(state) {
  return activePlayers(state).length;
}
