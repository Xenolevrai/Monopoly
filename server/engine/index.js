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
import { getEdition, editionOf, DEFAULT_EDITION, DEFAULT_LOCALE, listEditions } from '../../shared/index.js';
import { createGameState, createPlayer } from '../../shared/schema.js';
import { createRng } from './rng.js';
import { log, say } from './log.js';
import { playerById, currentPlayer, activePlayers } from './queries.js';
import {
  buildDecks,
  drawCard,
  applyRevealedCard,
  resolveCardChoice,
  resumeCollection,
  checkSaleVictory,
  getCard,
  applyCardAction,
} from './cards.js';
import { declareBankruptcy, checkGameOver, settleDebt, finishGame } from './money.js';
import { buyProperty, mortgage, unmortgage, buildHouse, sellBuilding } from './property.js';
import { startAuction, placeBid, passBid, startQueuedAuction } from './auction.js';
import { grantLapWaivers } from './movement.js';
import { proposeTrade, respondToTrade, cancelTrade } from './trade.js';
import {
  startTurn,
  roll,
  payBail,
  useJailCard,
  endTurn,
  nextPlayer,
  determineTurnOrder,
  finishResolution,
  rollBuyDie,
  rerollDice,
  keepRoll,
} from './turn.js';

export * from './queries.js';
export { createGameState, createPlayer };

/** Crée une partie et son générateur aléatoire. */
export function createGame(
  code,
  hostId,
  { seed, editionId = DEFAULT_EDITION, locale = DEFAULT_LOCALE, extensionIds = [] } = {},
) {
  const state = createGameState(code, hostId, editionId, locale, extensionIds);
  return { state, rng: createRng(seed ?? Date.now()) };
}

export { listEditions, getEdition };

/** Ajoute une joueuse au lobby. */
export function addPlayer(game, { id, name, token, faction }) {
  const { state } = game;
  const edition = editionOf(state);
  if (state.phase !== 'lobby') return { ok: false, error: 'La partie a déjà commencé.' };
  if (state.players.length >= edition.playerCount.max)
    return { ok: false, error: 'La partie est complète.' };
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
    return { ok: false, error: 'Ce pseudo est déjà pris.' };

  // Un pion par joueuse. Si celui demandé est déjà sur la table, on en donne un
  // autre plutôt que de refuser l'entrée : depuis un autre ordinateur, on ne
  // peut pas savoir qui a pris quoi avant d'être arrivée.
  const taken = new Set(state.players.map((p) => p.token));
  const tokenDef =
    edition.tokens.find((t) => t.id === token && !taken.has(t.id)) ??
    edition.tokens.find((t) => !taken.has(t.id));
  if (!tokenDef) return { ok: false, error: 'Tous les pions sont déjà pris.' };
  const swapped = token && tokenDef.id !== token;
  // Camp (maison de Poudlard…) : on prend celui demandé s'il existe, sinon le
  // premier libre, sinon le premier tout court — plusieurs joueuses peuvent
  // partager une maison, contrairement aux pions.
  const factions = edition.factions?.options ?? [];
  const chosenFaction =
    factions.find((f) => f.id === faction) ??
    factions.find((f) => !state.players.some((p) => p.faction === f.id)) ??
    factions[0];

  const player = createPlayer({
    id,
    name,
    token: tokenDef.id,
    color: tokenDef.color,
    order: state.players.length,
    edition,
    faction: chosenFaction?.id ?? null,
  });
  state.players.push(player);
  log(
    state,
    'lobby',
    swapped
      ? say(state, 'joinsSwapped', { name, token: tokenDef.label })
      : say(state, 'joins', { name }),
    { playerId: id, token: tokenDef.id, swapped },
  );
  return { ok: true, player, swapped };
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
  // `hostId` ne donne aucun pouvoir — toutes les commandes sont ouvertes — mais
  // il désigne qui a ouvert la partie : on le reporte si cette personne s'en va.
  if (state.hostId === playerId && state.players.length) state.hostId = state.players[0].id;
  return { ok: true };
}

/** Marque une joueuse reconnectée. */
export function reconnectPlayer(game, playerId) {
  const player = playerById(game.state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue dans cette partie.' };
  player.connected = true;
  return { ok: true, player };
}

/**
 * Lance la partie : ordre de jeu, piles mélangées, premier tour.
 *
 * N'importe quelle joueuse du salon peut le faire. On joue en se parlant : la
 * décision est prise de vive voix bien avant le clic, et réserver le bouton à
 * une seule personne ne protégerait de rien — ça bloquerait juste celle qui a la
 * souris. Le journal note qui a lancé.
 */
export function startGame(game, playerId) {
  const { state, rng } = game;
  if (state.phase !== 'lobby') return { ok: false, error: 'La partie a déjà commencé.' };
  if (!playerById(state, playerId)) return { ok: false, error: 'Joueuse inconnue.' };
  const minPlayers = editionOf(state).playerCount.min;
  if (state.players.length < minPlayers)
    return { ok: false, error: `Il faut au moins ${minPlayers} joueuses.` };

  log(state, 'setup', say(state, 'starts', { name: playerById(state, playerId).name }), { playerId });
  buildDecks(state, rng);
  grantLapWaivers(state);
  determineTurnOrder(state, rng);
  state.phase = 'playing';
  state.turnCount = 1;
  startTurn(state);
  return { ok: true };
}

/**
 * Arrête la partie d'un commun accord, sans attendre la faillite générale.
 * Le classement se fait au patrimoine : liquide + propriétés + constructions.
 *
 * Ouvert à toutes : l'accord se prend à l'oral, et celle qui clique n'est pas
 * forcément celle qui a créé la partie.
 */
export function endGame(game, playerId) {
  const { state } = game;
  if (state.phase !== 'playing') return { ok: false, error: "La partie n'est pas en cours." };
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };
  return finishGame(state, `${player.name} arrête la partie`);
}

/** Modifie une règle maison depuis le salon. Toutes les joueuses y ont accès. */
export function updateSettings(game, playerId, settings) {
  const { state } = game;
  if (state.phase !== 'lobby') return { ok: false, error: 'Réglages verrouillés une fois la partie lancée.' };
  if (!playerById(state, playerId)) return { ok: false, error: 'Joueuse inconnue.' };
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

    // Relance offerte par un pouvoir de camp (`factions[].rerollDice`).
    case 'REROLL_DICE':
      if (pending.kind !== 'reroll' || !isMine) return refuse('Aucun jet à relancer.');
      return rerollDice(state, playerId, rng);

    case 'KEEP_ROLL':
      if (pending.kind !== 'reroll' || !isMine) return refuse('Aucun jet à garder.');
      return keepRoll(state, playerId);

    case 'PAY_BAIL':
      if (pending.kind !== 'roll' || !isMine) return refuse('Action impossible maintenant.');
      return payBail(state, playerId);

    case 'USE_JAIL_CARD':
      if (pending.kind !== 'roll' || !isMine) return refuse('Action impossible maintenant.');
      return useJailCard(state, playerId);

    case 'END_TURN':
      if (pending.kind !== 'end_turn' || !isMine) return refuse('Vous ne pouvez pas finir votre tour maintenant.');
      return endTurn(state, playerId, rng);

    // Jet facultatif proposé par `mechanics.buyDie`, une fois la case résolue.
    case 'ROLL_BUY_DIE':
      if (pending.kind !== 'end_turn' || !isMine) return refuse("Ce n'est pas le moment de lancer le dé d'Achat.");
      return rollBuyDie(state, playerId, rng);

    // Carte du coffre à usage unique, jouée quand sa détentrice le décide.
    case 'PLAY_SALE_CARD': {
      const held = player.saleCards ?? [];
      if (!held.includes(action.cardId)) return refuse("Vous n'avez pas cette carte.");
      const card = getCard(state, action.cardId);
      if (!card?.action) return refuse('Cette carte ne se joue pas.');
      if (!isCurrent || state.debt) return refuse('Action réservée à votre tour.');
      player.saleCards = held.filter((id) => id !== action.cardId);
      log(state, 'card', say(state, 'playsSaleCard', { name: player.name, text: card.text }), {
        playerId,
        cardId: card.id,
      });
      applyCardAction(state, playerId, card.action, {
        diceTotal: (state.dice.values ?? []).reduce((a, b) => a + b, 0),
      });
      return { ok: true };
    }

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
      log(state, 'buy', say(state, 'declines', { name: player.name }), { playerId, spaceId });
      return { ok: true };
    }

    case 'AUCTION_BID':
      if (pending.kind !== 'auction_bid' || !isMine) return refuse("Ce n'est pas à vous d'enchérir.");
      return placeBid(state, playerId, action.amount);

    case 'AUCTION_PASS':
      if (pending.kind !== 'auction_bid' || !isMine) return refuse("Ce n'est pas à vous d'enchérir.");
      return passBid(state, playerId);

    // — Cartes ——————————————————————————————————————————
    case 'DRAW_CARD': {
      if (pending.kind !== 'draw_card' || !isMine) return refuse('Aucune carte à piocher.');
      const card = drawCard(state, playerId, pending.payload.deck, {
        diceTotal: pending.payload.diceTotal,
      });
      return card ? { ok: true } : refuse('La pile est vide.');
    }

    case 'ACKNOWLEDGE_CARD':
      if (pending.kind !== 'card_reveal' || !isMine) return refuse('Aucune carte à appliquer.');
      return applyRevealedCard(state, playerId, rng);

    case 'CARD_CHOICE':
      if (pending.kind !== 'card_choice' || !isMine) return refuse('Aucun choix de carte en attente.');
      return resolveCardChoice(state, playerId, action.optionIndex, {
        diceTotal: (state.dice.values ?? []).reduce((a, b) => a + b, 0),
        rng,
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
      return proposeTrade(state, playerId, action.toPlayerId, action.give, action.receive, {
        settlesDebt: action.settlesDebt,
      });

    case 'RESPOND_TRADE':
      return respondToTrade(state, playerId, action.tradeId, action.accept);

    case 'CANCEL_TRADE':
      return cancelTrade(state, playerId, action.tradeId);

    // — Régler une dette ————————————————————————————————————
    case 'PAY_DEBT': {
      if (state.debt?.debtorId !== playerId) return refuse("Vous n'avez rien à régler.");
      if (player.cash < state.debt.amount) return refuse('Fonds insuffisants pour régler cette somme.');
      settleDebt(state);
      return { ok: true };
    }

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

  // Aux éditions qui s'arrêtent sur l'exploration complète du plateau, le
  // dernier lieu exploré met fin à la partie sur-le-champ. On teste avant les
  // gardes ci-dessous : sinon l'invite « finir le tour », posée juste avant,
  // ferait sortir d'ici et la partie continuerait un tour de trop.
  // Ces conditions-là peuvent tomber au milieu d'un tour : on les teste avant
  // les gardes ci-dessous, sinon l'invite posée juste avant nous ferait sortir
  // d'ici et la partie continuerait un tour de trop.
  const winCondition = editionOf(state).winCondition;
  if (
    (winCondition === 'allLocationsExplored' || winCondition === 'allOwnedOrLastStanding') &&
    checkGameOver(state)
  )
    return;

  // Même raison, même place : une condition de victoire portée par une carte
  // (`mechanics.saleVictory`) peut être remplie à tout moment — y compris juste
  // après qu'une invite de fin de tour a été posée.
  if (checkSaleVictory(state)) return;

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
  // Compteur porté par la partie, et non la longueur de la liste : celle-ci est
  // plafonnée à 200, donc l'indice repasserait sur des identifiants déjà
  // affichés et le chat se figerait sur des clés en double.
  state.chatSeq = (state.chatSeq ?? state.chat.length) + 1;
  state.chat.push({
    id: `c${state.chatSeq}`,
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
