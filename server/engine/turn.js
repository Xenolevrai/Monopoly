import { getSpace, boardOf } from '../../shared/index.js';
import { rollDice } from './rng.js';
import { log, say, amountText } from './log.js';
import { playerById, currentPlayer, activePlayers, config } from './queries.js';
import { checkGameOver, charge, potCollects, credit } from './money.js';
import { advance, moveTo, resolveLanding, sendToJail } from './movement.js';
import { returnJailCard, getCard, applyCardAction, spinFreeParking, drawCorruptionCard, drawSuperCorruptionCard, checkSaleVictory, rollBuyDie as rollBuyDieCards } from './cards.js';
import { playHazardTurn } from './hazard.js';
import {
  speedDieConfig,
  rollSpeedDie,
  runPostMove,
  busTicketConfig,
  busDestinations,
  takeBusTicket,
  useBusTicket,
  heldTicket,
} from './speeddie.js';
import { factionOf } from './movement.js';
import { startAuction, startQueuedAuction } from './auction.js';

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
    if (card?.ability?.type === 'per_turn_cash') {
      credit(state, player.id, card.ability.amount, 'Rente Vente');
    }
  }
}

/** Prépare le tour de la joueuse courante. */
export function startTurn(state) {
  const player = currentPlayer(state);
  if (!player) return;
  state.dice = { values: null, doublesCount: 0, rolled: false, extraRoll: false, rollId: state.dice?.rollId ?? 0 };
  state.buyDie = null;
  state.speedDie = null;
  // Un déplacement différé n'a de sens que dans le tour qui l'a ouvert : une
  // faillite ou une fin de partie au milieu du chemin ne doit pas le laisser
  // traîner jusqu'au tour suivant.
  state.postMove = null;
  applyRecurringCards(state, player);
  checkSaleVictory(state);
  if (state.phase === 'finished') return;

  if (player.inJail && config(state).mechanics?.noDoublesOut) {
    if (player.superJail) {
      player.superJailTurns = (player.superJailTurns ?? 0) + 1;
      drawSuperCorruptionCard(state, player.id);
      const bailCash = config(state).mechanics?.superJailBailCash ?? 300;
      state.pending = {
        kind: 'leave_super_jail',
        playerIds: [player.id],
        payload: {
          superJailTurns: player.superJailTurns,
          senderId: player.superJailSenderId,
          senderName: playerById(state, player.superJailSenderId)?.name ?? 'Police',
          collectedCardsCount: player.superJailCollectedCards?.length ?? 0,
          canPayCash: player.cash >= bailCash,
          canGiveCards: (player.superJailCollectedCards?.length ?? 0) > 0,
          canStay: player.superJailTurns < 3,
          forced: player.superJailTurns >= 3,
        },
      };
      log(state, 'turn', say(state, 'turnOf', { name: player.name }), { playerId: player.id, turn: state.turnCount });
      return;
    } else {
      player.jailTurns = (player.jailTurns ?? 0) + 1;
      drawCorruptionCard(state, player.id);
      const bail = config(state).mechanics?.jailBail ?? 100;
      state.pending = {
        kind: 'jail_decision',
        playerIds: [player.id],
        payload: {
          jailTurns: player.jailTurns,
          bail,
          canPayBail: player.cash >= bail,
          canStay: player.jailTurns < 3,
          forced: player.jailTurns >= 3,
        },
      };
      log(state, 'turn', say(state, 'turnOf', { name: player.name }), { playerId: player.id, turn: state.turnCount });
      return;
    }
  }

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

  // Un camp peut annoncer `peekDeck` : sa détentrice voit la prochaine carte
  // du paquet avant de lancer. Lecture seule, aucune pioche.
  const peekDeck = factionOf(state, player)?.peekDeck;
  const peekId = peekDeck ? state.decks?.[peekDeck]?.[0] : null;
  const peek = peekId ? getCard(state, peekId)?.text ?? null : null;

  // Un ticket de bus se joue **à la place** du lancer : le moteur l'annonce ici,
  // le client se contente d'afficher le bouton quand la clé est présente.
  const tickets = !player.inJail && busTicketConfig(state) ? (player.busTickets ?? []) : [];

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
          ...(peek ? { peek } : {}),
        }
      : {
          ...(peek ? { peek } : {}),
          ...(tickets.length ? { busTickets: tickets, busDestinations: busDestinations(state, player.position) } : {}),
        },
  };
  log(state, 'turn', say(state, 'turnOf', { name: player.name }), { playerId: player.id, turn: state.turnCount });
}

/** Jette les dés, les journalise, et les pose dans l'état — sans rien résoudre. */
function throwDice(state, player, rng) {
  const values = rollDice(rng, config(state).dice.count, config(state).dice.sides);
  const total = values.reduce((a, b) => a + b, 0);
  const isDouble = values.every((v) => v === values[0]);
  state.dice.values = values;
  state.dice.rolled = true;
  state.dice.rollId = (state.dice.rollId ?? 0) + 1;
  log(state, 'roll', say(state, 'rolls', { name: player.name, values: values.join(' + '), total, isDouble }), {
    playerId: player.id,
    values,
    total,
    isDouble,
  });
  return { values, total, isDouble };
}

/**
 * Un camp peut annoncer `rerollDice` : sa détentrice regarde son jet avant de
 * le valider, et peut le refaire une fois par tour. Hors de prison seulement —
 * en cellule, le jet sert à tenter les doubles, pas à se déplacer.
 */
function offersReroll(state, player) {
  // Jamais avec un troisième dé en jeu : relancer voudrait dire relancer aussi
  // celui-là, et aucune boîte ne réunit les deux règles. On préfère l'exclure
  // franchement plutôt que de laisser passer un jet à moitié rejoué.
  if (speedDieConfig(state)) return false;
  return Boolean(factionOf(state, player)?.rerollDice) && !player.inJail && !state.dice.rerollUsed;
}

/**
 * Le déplacement d'un jet, une fois le troisième dé lu.
 *
 * Les compagnies se paient sur **les deux dés blancs seulement** : c'est le
 * `diceTotal` transmis à la résolution, tandis que le pion, lui, avance de la
 * somme des trois.
 */
function resolveRolledMove(state, playerId, { total, speed }) {
  const player = playerById(state, playerId);

  if (!speed) {
    advance(state, playerId, total);
    resolveLanding(state, playerId, { diceTotal: total });
    return finishResolution(state);
  }

  if (speed.kind === 'number') {
    const steps = total + speed.face;
    log(state, 'roll', say(state, 'speedDieNumber', { name: player.name, face: speed.face, total: steps }), {
      playerId,
      face: speed.face,
      total: steps,
    });
    advance(state, playerId, steps);
    resolveLanding(state, playerId, { diceTotal: total });
    return finishResolution(state);
  }

  if (speed.kind === 'mr_monopoly') {
    log(state, 'roll', say(state, 'speedDieMrMonopoly', { name: player.name }), { playerId });
    // Le second déplacement n'a lieu qu'une fois cette case entièrement réglée :
    // on le met de côté, `finishResolution` le jouera au bon moment.
    state.postMove = { playerId, type: 'mr_monopoly' };
    advance(state, playerId, total);
    resolveLanding(state, playerId, { diceTotal: total });
    return finishResolution(state);
  }

  // Face Bus.
  log(state, 'roll', say(state, 'speedDieBus', { name: player.name }), { playerId });
  const held = player.busTickets ?? [];
  const poolLeft = (state.busTickets ?? []).length;
  if (held.length === 0 && poolLeft === 0) {
    // Ni ticket en main, ni ticket à prendre : on avance des deux dés blancs,
    // puis on continue jusqu'à la prochaine case à carte.
    state.postMove = { playerId, type: 'nearest_deck' };
    advance(state, playerId, total);
    resolveLanding(state, playerId, { diceTotal: total });
    return finishResolution(state);
  }

  state.pending = {
    kind: 'bus_choice',
    playerIds: [playerId],
    payload: {
      canUse: held.length > 0,
      canTake: poolLeft > 0,
      tickets: held,
      poolLeft,
      total,
    },
  };
  return { ok: true };
}

/** Lancer de dés — gère aussi les tentatives de sortie de prison. */
export function roll(state, playerId, rng) {
  const player = playerById(state, playerId);
  const { total, isDouble, values } = throwDice(state, player, rng);
  state.pending = { kind: null, playerIds: [] };

  if (player.inJail) {
    if (isDouble) {
      player.inJail = false;
      player.jailTurns = 0;
      state.dice.extraRoll = false; // Sortir par un double ne donne pas de tour supplémentaire
      log(state, 'jail', say(state, 'jailDouble', { name: player.name }), { playerId });
      advance(state, playerId, total);
      resolveLanding(state, playerId, { diceTotal: total });
      return finishResolution(state);
    }
    player.jailTurns += 1;
    if (player.jailTurns >= config(state).jail.maxTurns) {
      log(state, 'jail', say(state, 'jailMaxed', { name: player.name, max: config(state).jail.maxTurns }), { playerId });
      player.inJail = false;
      player.jailTurns = 0;
      state.dice.extraRoll = false;
      advance(state, playerId, total);
      resolveLanding(state, playerId, { diceTotal: total });
      return finishResolution(state);
    }
    log(state, 'jail', say(state, 'jailStays', { name: player.name, turns: player.jailTurns }), { playerId });
    return finishResolution(state);
  }

  // Le troisième dé, quand l'édition en déclare un. Jamais en prison : la sortie
  // par les doubles ne se joue qu'avec les deux dés blancs.
  const speed = rollSpeedDie(state, rng);

  // Triple identique — les deux dés blancs et le dé rapide sur la même valeur.
  // La joueuse se pose alors où elle veut sur le plateau, et ne rejoue pas :
  // testé avant les doubles, qui donneraient sinon un tour de plus.
  if (speed?.kind === 'number' && isDouble && speed.face === values[0]) {
    state.dice.extraRoll = false;
    state.dice.doublesCount = 0;
    log(state, 'roll', say(state, 'speedDieTriple', { name: player.name, value: speed.face }), {
      playerId,
      value: speed.face,
    });
    state.pending = {
      kind: 'choose_space',
      playerIds: [playerId],
      payload: { reason: 'triple', then: 'move', spaceIds: boardOf(state).map((s) => s.id) },
    };
    return { ok: true };
  }

  const doublesToJail = config(state).dice.doublesToJail;
  const doublesNeverJail = config(state).mechanics?.doublesNeverJail;
  if (isDouble) {
    state.dice.doublesCount += 1;
    if (!doublesNeverJail && doublesToJail && state.dice.doublesCount >= doublesToJail) {
      log(state, 'jail', say(state, 'threeDoubles', { name: player.name }), { playerId });
      sendToJail(state, playerId);
      return finishResolution(state);
    }
    state.dice.extraRoll = true;
  } else {
    state.dice.extraRoll = false;
    state.dice.doublesCount = 0;
  }

  if (offersReroll(state, player)) {
    state.pending = {
      kind: 'reroll',
      playerIds: [playerId],
      payload: { values, total, isDouble },
    };
    return { ok: true, pendingReroll: true };
  }

  return resolveRolledMove(state, playerId, { total, speed });
}

/**
 * La joueuse pose son pion sur la case qu'elle a choisie — triple identique,
 * ou descente d'un ticket de bus. `then` dit ce qu'on fait de ce choix : s'y
 * rendre, ou mettre la case aux enchères.
 */
export function chooseSpace(state, playerId, spaceId, rng = null) {
  const pending = state.pending;
  const payload = pending.payload ?? {};
  if (!(payload.spaceIds ?? []).includes(spaceId)) return { ok: false, error: 'Cette case n’est pas proposée.' };

  if (payload.then === 'auction') {
    state.pending = { kind: null, playerIds: [] };
    return startAuction(state, spaceId, playerId);
  }

  if (payload.then === 'bus_ticket') {
    const result = useBusTicket(state, playerId, payload.ticketId, spaceId, rng);
    return result.ok ? finishResolution(state) : result;
  }

  state.pending = { kind: null, playerIds: [] };
  moveTo(state, playerId, spaceId, true);
  resolveLanding(state, playerId, { diceTotal: (state.dice.values ?? []).reduce((a, b) => a + b, 0) });
  return finishResolution(state);
}

/** Face Bus : utiliser un ticket, ou en prendre un et avancer normalement. */
export function chooseBus(state, playerId, choice, ticketId = null) {
  const player = playerById(state, playerId);
  const { total } = state.pending.payload ?? {};

  if (choice === 'use') {
    const ticket = heldTicket(player, ticketId);
    if (!ticket) return { ok: false, error: "Vous n'avez pas de ticket de bus." };
    state.pending = {
      kind: 'choose_space',
      playerIds: [playerId],
      payload: {
        reason: 'bus_ticket',
        then: 'bus_ticket',
        ticketId: ticket.id,
        expires: ticket.expires,
        spaceIds: busDestinations(state, player.position),
      },
    };
    return { ok: true };
  }

  if (choice === 'take') {
    if (!takeBusTicket(state, playerId)) return { ok: false, error: 'Il ne reste plus de ticket.' };
    state.pending = { kind: null, playerIds: [] };
    advance(state, playerId, total ?? 0);
    resolveLanding(state, playerId, { diceTotal: total ?? 0 });
    return finishResolution(state);
  }

  return { ok: false, error: 'Choix inconnu.' };
}

/** Un ticket de bus joué à la place du lancer de dés, au début du tour. */
export function playBusTicket(state, playerId, ticketId) {
  const player = playerById(state, playerId);
  const ticket = heldTicket(player, ticketId);
  if (!ticket) return { ok: false, error: "Vous n'avez pas de ticket de bus." };
  // Aucun dé n'est lancé : pas de tour supplémentaire à espérer.
  state.dice.extraRoll = false;
  state.dice.doublesCount = 0;
  state.pending = {
    kind: 'choose_space',
    playerIds: [playerId],
    payload: {
      reason: 'bus_ticket',
      then: 'bus_ticket',
      ticketId: ticket.id,
      expires: ticket.expires,
      spaceIds: busDestinations(state, player.position),
    },
  };
  return { ok: true };
}

/** La joueuse choisit de relancer son jet de dés (pouvoir de camp). */
export function rerollDice(state, playerId, rng) {
  const player = playerById(state, playerId);
  if (!offersReroll(state, player)) return { ok: false, error: 'Relance impossible.' };
  state.dice.rerollUsed = true;
  log(state, 'roll', say(state, 'rerolls', { name: player.name }), { playerId });
  const { total, isDouble } = throwDice(state, player, rng);

  const doublesToJail = config(state).dice.doublesToJail;
  const doublesNeverJail = config(state).mechanics?.doublesNeverJail;
  if (isDouble) {
    state.dice.doublesCount += 1;
    if (!doublesNeverJail && doublesToJail && state.dice.doublesCount >= doublesToJail) {
      log(state, 'jail', say(state, 'threeDoubles', { name: player.name }), { playerId });
      sendToJail(state, playerId);
      return finishResolution(state);
    }
    state.dice.extraRoll = true;
  } else {
    state.dice.extraRoll = false;
    state.dice.doublesCount = 0;
  }

  state.pending = { kind: null, playerIds: [] };
  advance(state, playerId, total);
  resolveLanding(state, playerId, { diceTotal: total });
  return finishResolution(state);
}

/** La joueuse garde son premier jet sans le relancer. */
export function keepRoll(state, playerId) {
  const total = (state.dice.values ?? []).reduce((a, b) => a + b, 0);
  state.pending = { kind: null, playerIds: [] };
  advance(state, playerId, total);
  resolveLanding(state, playerId, { diceTotal: total });
  return finishResolution(state);
}

/** Paie la caution pour sortir avant de lancer les dés. */
export function payBail(state, playerId) {
  const player = playerById(state, playerId);
  if (!player.inJail) return { ok: false, error: "Vous n'êtes pas en prison." };
  const bail = config(state).mechanics?.jailBail ?? jailContext(state, player).bail;
  if (player.cash < bail) return { ok: false, error: 'Fonds insuffisants pour la caution.' };
  player.cash -= bail;
  if (potCollects(state)) {
    state.freeParkingPot += bail;
  }
  player.inJail = false;
  player.jailTurns = 0;
  log(state, 'jail', say(state, 'jailBail', { name: player.name, amount: amountText(state, bail) }), { playerId });
  state.pending = { kind: 'roll', playerIds: [playerId], payload: {} };
  return { ok: true };
}

/** Sort de Super Prison (en payant 300 € au commanditaire ou en lui donnant les cartes collectées). */
export function leaveSuperJail(state, playerId, choice) {
  const player = playerById(state, playerId);
  if (!player || !player.superJail) return { ok: false, error: "Vous n'êtes pas en Super Prison." };

  const senderId = player.superJailSenderId;
  const sender = senderId ? playerById(state, senderId) : null;
  const bailCash = config(state).mechanics?.superJailBailCash ?? 300;

  if (choice === 'cash') {
    if (player.cash < bailCash) return { ok: false, error: 'Fonds insuffisants pour la caution de Super Prison.' };
    player.cash -= bailCash;
    if (sender && !sender.bankrupt) {
      sender.cash += bailCash;
    } else if (potCollects(state)) {
      state.freeParkingPot += bailCash;
    }
    log(state, 'jail', say(state, 'leavesSuperJailCash', {
      name: player.name,
      to: sender ? sender.name : 'la Banque',
      amount: amountText(state, bailCash),
    }), { playerId, senderId, amount: bailCash });
  } else if (choice === 'cards') {
    const cardsToTransfer = [...(player.superJailCollectedCards ?? [])];
    if (sender && !sender.bankrupt) {
      sender.superCorruptionCards = sender.superCorruptionCards ?? [];
      for (const cId of cardsToTransfer) {
        sender.superCorruptionCards.push(cId);
        sender.cardsDrawnTurn = sender.cardsDrawnTurn ?? {};
        sender.cardsDrawnTurn[cId] = state.turnCount;
      }
    } else {
      for (const cId of cardsToTransfer) {
        (state.decks.super_corruption ??= []).push(cId);
      }
    }
    player.superCorruptionCards = (player.superCorruptionCards ?? []).filter((id) => !cardsToTransfer.includes(id));
    log(state, 'jail', say(state, 'leavesSuperJailCards', {
      name: player.name,
      to: sender ? sender.name : 'la Banque',
      count: cardsToTransfer.length,
    }), { playerId, senderId, count: cardsToTransfer.length });
  }

  player.inJail = false;
  player.superJail = false;
  player.superJailTurns = 0;
  player.superJailCollectedCards = [];
  player.superJailSenderId = null;
  player.position = 30;

  state.pending = { kind: 'roll', playerIds: [playerId], payload: {} };
  return { ok: true };
}

/** La joueuse choisit de passer son tour en prison pour piocher plus de cartes. */
export function stayInJail(state, playerId) {
  const player = playerById(state, playerId);
  if (!player || !player.inJail) return { ok: false, error: "Vous n'êtes pas en prison." };
  log(state, 'jail', say(state, 'jailStays', { name: player.name, turns: player.superJail ? player.superJailTurns : player.jailTurns }), { playerId });
  state.pending = { kind: 'end_turn', playerIds: [playerId], payload: { extraRoll: false } };
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

/** Dépense 1 jeton Spin pour tourner la roulette. */
export function useSpinChip(state, playerId, rng) {
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };
  if ((player.spinChips ?? 0) <= 0) return { ok: false, error: "Vous n'avez pas de jeton Spin." };
  player.spinChips -= 1;
  log(state, 'action', say(state, 'spinsChipUsed', { name: player.name }), { playerId });
  return spinFreeParking(state, playerId, rng);
}

/** Choix du propriétaire : loyer ou jeton Spin à la banque. */
export function chooseRentOrChip(state, landlordId, choice) {
  const pending = state.pending;
  if (pending.kind !== 'choose_rent_or_chip' || !pending.playerIds.includes(landlordId)) {
    return { ok: false, error: 'Aucun choix de loyer ou jeton en attente.' };
  }
  const { tenantId, spaceId, rent, dealMobile } = pending.payload;
  const landlord = playerById(state, landlordId);
  const tenant = playerById(state, tenantId);
  const space = getSpace(state, spaceId);

  state.pending = { kind: null, playerIds: [] };

  if (choice === 'chip' || dealMobile) {
    landlord.spinChips = (landlord.spinChips ?? 0) + 1;
    log(state, 'rent', say(state, 'landlordTakesChip', {
      name: landlord.name,
      tenant: tenant.name,
      space: space.name,
    }), { playerId: landlordId, tenantId, spaceId });
  } else {
    log(state, 'rent', say(state, 'rentDue', {
      name: tenant.name,
      amount: amountText(state, rent),
      owner: landlord.name,
      space: space.name,
    }), {
      playerId: tenant.id,
      creditorId: landlord.id,
      spaceId: space.id,
      amount: rent,
    });
    charge(state, tenant.id, rent, say(state, 'reasonRent', { space: space.name }), landlord.id, { negotiable: true });
  }
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
  state.dice.buyDieUsed = true;
  return rollBuyDieCards(state, playerId, rng);
}

/**
 * Après la résolution d'une case : si rien n'attend de décision, la joueuse peut
 * gérer ses biens puis finir son tour.
 */
export function finishResolution(state) {
  if (state.phase === 'finished') return { ok: true };
  if (state.pending.kind) return { ok: true }; // achat, dette, enchère, choix de carte…
  if (state.debt) return { ok: true };
  // Le déplacement mis de côté par le dé rapide se joue ici, et nulle part
  // ailleurs : c'est le seul point du flux où la case précédente est réglée et
  // où plus aucune décision n'est en attente.
  if (runPostMove(state)) return { ok: true };
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
export function endTurn(state, playerId, rng = null) {
  if (state.phase === 'finished') return { ok: false, error: 'La partie est terminée.' };

  // Le pion hostile joue après la joueuse — une fois par jet, comme le dé de
  // vilain qu'on lance en même temps que les siens sur le plateau.
  if (rng) playHazardTurn(state, rng);

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
  // On brasse avant de trier. `Array.sort` est stable : sans ce brassage, deux
  // joueuses à égalité gardaient leur ordre d'arrivée dans la partie, et la
  // première inscrite commençait plus souvent — mesuré à 55,9 % au lieu de 50 %.
  const shuffled = rng.shuffle(rolls);
  shuffled.sort((a, b) => b.total - a.total);
  rolls.length = 0;
  rolls.push(...shuffled);
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
