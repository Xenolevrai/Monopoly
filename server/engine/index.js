/**
 * Moteur de jeu — point d'entrée unique.
 *
 * Le serveur ne fait qu'appeler `dispatch(game, playerId, action)`. Toute la
 * validation est ici : une action n'est acceptée que si elle correspond à ce que
 * `state.pending` réclame, et qu'elle vient d'une joueuse autorisée. C'est ce qui
 * empêche de lancer les dés deux fois, d'acheter pendant le tour d'une autre, ou
 * de construire au milieu d'une enchère.
 *
 * Le moteur ne connaît ni Socket.io ni React : il se teste seul (voir tests/).
 */
import { rules } from '../../shared/index.js';
import { createGameState, createPlayer } from '../../shared/schema.js';
import { createRng } from './rng.js';
import { log } from './log.js';
import { playerById, currentPlayer, activePlayers } from './queries.js';
import { buildDecks, resolveCardChoice, resumeCollection } from './cards.js';
import { declareBankruptcy, checkGameOver } from './money.js';
import { buyProperty, mortgage, unmortgage, buildHouse, sellBuilding } from './property.js';
import { startAuction, placeBid, passBid, startQueuedAuction } from './auction.js';
import { proposeTrade, respondToTrade, cancelTrade } from './trade.js';
import { startTurn, roll, payBail, useJailCard, endTurn, nextPlayer, determineTurnOrder, finishResolution } from './turn.js';

export * from './queries.js';
export { createGameState, createPlayer };

/** Crée une partie et son générateur aléatoire. */
export function createGame(code, hostId, { seed } = {}) {
  const state = createGameState(code, hostId);
  return { state, rng: createRng(seed ?? Date.now()) };
}

/** Ajoute une joueuse au lobby. */
export function addPlayer(game, { id, name, token }) {
  const { state } = game;
  if (state.phase !== 'lobby') return { ok: false, error: 'La partie a déjà commencé.' };
  if (state.players.length >= rules.maxPlayers) return { ok: false, error: 'La partie est complète.' };
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
    return { ok: false, error: 'Ce pseudo est déjà pris.' };
  if (state.players.some((p) => p.token === token)) return { ok: false, error: 'Ce pion est déjà choisi.' };

  // Un pion par joueuse : on prend celui demandé, sinon le premier encore libre.
  const taken = new Set(state.players.map((p) => p.token));
  const tokenDef =
    rules.tokens.find((t) => t.id === token && !taken.has(t.id)) ??
    rules.tokens.find((t) => !taken.has(t.id));
  if (!tokenDef) return { ok: false, error: 'Tous les pions sont déjà pris.' };
  const player = createPlayer({
    id,
    name,
    token: tokenDef.id,
    color: tokenDef.color,
    order: state.players.length,
  });
  state.players.push(player);
  log(state, 'lobby', `${name} rejoint la partie.`, { playerId: id });
  return { ok: true, player };
}

/** Retire une joueuse (uniquement avant le début de la partie). */
export function removePlayer(game, playerId) {
  const { state } = game;
  if (state.phase !== 'lobby') {
    const player = playerById(state, playerId);
    if (player) player.connected = false;
    return { ok: true, disconnected: true };
  }
  state.players = state.players.filter((p) => p.id !== playerId);
  state.players.forEach((p, i) => (p.order = i));
  // Si l'hôte s'en va avant le début, la première joueuse restante reprend la main :
  // sans ça, plus personne ne pourrait lancer la partie.
  if (state.hostId === playerId && state.players.length) {
    state.hostId = state.players[0].id;
    log(state, 'lobby', `${state.players[0].name} devient l'hôte de la partie.`, { playerId: state.hostId });
  }
  return { ok: true };
}

/** Marque une joueuse reconnectée. */
export function reconnectPlayer(game, playerId) {
  const player = playerById(game.state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue dans cette partie.' };
  player.connected = true;
  return { ok: true, player };
}

/** Lance la partie : ordre de jeu, piles mélangées, premier tour. */
export function startGame(game, hostId) {
  const { state, rng } = game;
  if (state.phase !== 'lobby') return { ok: false, error: 'La partie a déjà commencé.' };
  if (hostId !== state.hostId) return { ok: false, error: "Seule l'hôte peut lancer la partie." };
  if (state.players.length < rules.minPlayers)
    return { ok: false, error: `Il faut au moins ${rules.minPlayers} joueuses.` };

  buildDecks(state, rng);
  determineTurnOrder(state, rng);
  state.phase = 'playing';
  state.turnCount = 1;
  startTurn(state);
  return { ok: true };
}

/** Modifie une règle maison depuis le lobby. */
export function updateSettings(game, hostId, settings) {
  const { state } = game;
  if (state.phase !== 'lobby') return { ok: false, error: 'Réglages verrouillés une fois la partie lancée.' };
  if (hostId !== state.hostId) return { ok: false, error: "Seule l'hôte peut changer les réglages." };
  state.settings = { ...state.settings, ...settings };
  return { ok: true };
}

/**
 * Applique une action de joueuse.
 * @param {{state: object, rng: object}} game
 * @param {string} playerId
 * @param {{type: string, [key: string]: any}} action
 * @returns {{ ok: boolean, error?: string }}
 */
export function dispatch(game, playerId, action) {
  const { state, rng } = game;
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };
  if (action.type === 'CHAT') return sendChat(state, playerId, action.text);
  if (state.phase !== 'playing') return { ok: false, error: "La partie n'est pas en cours." };
  if (player.bankrupt) return { ok: false, error: 'Vous êtes éliminée.' };

  const result = applyAction(game, state, rng, player, action);
  if (result.ok) {
    advanceFlow(state);
    state.version += 1;
  }
  return result;
}

function applyAction(game, state, rng, player, action) {
  const playerId = player.id;
  const pending = state.pending;
  const isMine = pending.playerIds.includes(playerId);
  const isCurrent = currentPlayer(state)?.id === playerId;

  switch (action.type) {
    // — Tour de jeu ————————————————————————————————————————
    case 'ROLL_DICE':
      if (pending.kind !== 'roll' || !isMine) return refuse("Ce n'est pas à vous de lancer les dés.");
      return roll(state, playerId, rng);

    case 'PAY_BAIL':
      if (pending.kind !== 'roll' || !isMine) return refuse('Action impossible maintenant.');
      return payBail(state, playerId);

    case 'USE_JAIL_CARD':
      if (pending.kind !== 'roll' || !isMine) return refuse('Action impossible maintenant.');
      return useJailCard(state, playerId);

    case 'END_TURN':
      if (pending.kind !== 'end_turn' || !isMine) return refuse('Vous ne pouvez pas finir votre tour maintenant.');
      return endTurn(state, playerId);

    // — Achat / enchère —————————————————————————————————————
    case 'BUY_PROPERTY': {
      if (pending.kind !== 'buy_or_auction' || !isMine) return refuse("Aucun achat en attente.");
      const result = buyProperty(state, playerId, pending.payload.spaceId);
      if (result.ok) state.pending = { kind: null, playerIds: [] };
      return result;
    }

    case 'DECLINE_PROPERTY': {
      if (pending.kind !== 'buy_or_auction' || !isMine) return refuse('Aucun achat en attente.');
      const spaceId = pending.payload.spaceId;
      state.pending = { kind: null, playerIds: [] };
      if (state.settings.auctionOnDecline) return startAuction(state, spaceId, playerId);
      log(state, 'buy', `${player.name} renonce à acheter cette propriété.`, { playerId, spaceId });
      return { ok: true };
    }

    case 'AUCTION_BID':
      if (pending.kind !== 'auction_bid' || !isMine) return refuse("Ce n'est pas à vous d'enchérir.");
      return placeBid(state, playerId, action.amount);

    case 'AUCTION_PASS':
      if (pending.kind !== 'auction_bid' || !isMine) return refuse("Ce n'est pas à vous d'enchérir.");
      return passBid(state, playerId);

    // — Cartes ——————————————————————————————————————————
    case 'CARD_CHOICE':
      if (pending.kind !== 'card_choice' || !isMine) return refuse('Aucun choix de carte en attente.');
      return resolveCardChoice(state, playerId, action.optionIndex, {
        diceTotal: (state.dice.values ?? []).reduce((a, b) => a + b, 0),
      });

    // — Gestion du patrimoine ————————————————————————————————
    // Construire ou lever une hypothèque : seulement pendant son propre tour.
    case 'BUILD_HOUSE':
      if (!canManage(state, playerId, isCurrent)) return refuse('Vous ne pouvez construire que pendant votre tour.');
      return buildHouse(state, playerId, action.spaceId);

    case 'UNMORTGAGE':
      if (!canManage(state, playerId, isCurrent)) return refuse('Action réservée à votre tour.');
      return unmortgage(state, playerId, action.spaceId);

    // Hypothéquer et revendre : à tout moment, y compris pour éponger une dette
    // survenue pendant le tour d'une autre joueuse.
    case 'MORTGAGE':
      return mortgage(state, playerId, action.spaceId);

    case 'SELL_BUILDING':
      return sellBuilding(state, playerId, action.spaceId);

    // — Échanges ————————————————————————————————————————
    case 'PROPOSE_TRADE':
      return proposeTrade(state, playerId, action.toPlayerId, action.give, action.receive);

    case 'RESPOND_TRADE':
      return respondToTrade(state, playerId, action.tradeId, action.accept);

    case 'CANCEL_TRADE':
      return cancelTrade(state, playerId, action.tradeId);

    // — Faillite ————————————————————————————————————————
    case 'DECLARE_BANKRUPTCY': {
      if (state.debt?.debtorId !== playerId) return refuse("Vous n'avez pas de dette à régler.");
      const wasCurrent = isCurrent;
      declareBankruptcy(state, playerId);
      state.pending = { kind: null, playerIds: [] };
      if (wasCurrent) {
        state.dice.extraRoll = false;
        state.awaitingTurnEnd = true;
      }
      checkGameOver(state);
      return { ok: true };
    }

    default:
      return refuse(`Action inconnue : ${action.type}`);
  }
}

/** Construire / lever une hypothèque : à son tour, hors dette et hors enchère. */
function canManage(state, playerId, isCurrent) {
  return (
    isCurrent &&
    !state.debt &&
    ['roll', 'end_turn'].includes(state.pending.kind) &&
    state.pending.playerIds.includes(playerId)
  );
}

/**
 * Fait avancer la partie après chaque action, jusqu'au prochain point où une
 * décision humaine est nécessaire. Un seul endroit décide « et maintenant ? ».
 */
function advanceFlow(state) {
  if (state.phase === 'finished') return;
  if (state.debt) return; // en attente d'un règlement ou d'une faillite
  if (state.pending.kind) return; // en attente d'une décision

  if (resumeCollection(state)) return; // reste d'une carte « anniversaire »
  if (state.auctionQueue?.length && startQueuedAuction(state)) return;

  if (state.awaitingTurnEnd) {
    state.awaitingTurnEnd = false;
    if (!checkGameOver(state)) nextPlayer(state);
    return;
  }
  finishResolution(state);
}

function refuse(error) {
  return { ok: false, error };
}

/** Chat de partie (autorisé à tout moment, y compris dans le lobby). */
export function sendChat(state, playerId, text) {
  const clean = String(text ?? '').trim().slice(0, 300);
  if (!clean) return { ok: false, error: 'Message vide.' };
  state.chat.push({
    id: `c${state.chat.length + 1}`,
    playerId,
    text: clean,
    at: Date.now(),
  });
  if (state.chat.length > 200) state.chat.splice(0, state.chat.length - 200);
  return { ok: true };
}

/** Projection envoyée aux clients : tout est public au Monopoly. */
export function publicState(state) {
  return {
    ...state,
    // On masque les actions d'un choix de carte (données internes au moteur).
    pending: state.pending.payload?.actions
      ? { ...state.pending, payload: { ...state.pending.payload, actions: undefined } }
      : state.pending,
    remaining: activePlayers(state).length,
  };
}
