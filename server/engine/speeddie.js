/**
 * Le troisième dé, les tickets de bus, et les déplacements qu'ils laissent en
 * suspens.
 *
 * Tout est piloté par la configuration — `mechanics.speedDie`,
 * `mechanics.busTickets` — jamais par un nom d'édition. Une boîte qui ne les
 * déclare pas ne voit aucune de ces règles s'appliquer, et son état ne porte
 * rien de plus qu'avant.
 *
 * Le point délicat est **le déplacement différé** : la face Mr Monopoly, comme
 * le repli de la face Bus, demandent de rejouer *après* que la première case
 * est réglée — or cette case peut ouvrir un achat, une enchère, une dette. On
 * ne peut donc pas enchaîner tout de suite. On pose le déplacement dans
 * `state.postMove`, et `finishResolution` le joue au moment exact où plus rien
 * n'attend de décision.
 */
import { getSpace, boardOf, isOwnable } from '../../shared/index.js';
import { log, say, amountText } from './log.js';
import { playerById, config, rentFor } from './queries.js';
import { credit } from './money.js';
import { moveTo, resolveLanding } from './movement.js';
import { rollDice } from './rng.js';

/** La configuration du dé rapide, ou null. */
export function speedDieConfig(state) {
  return config(state).mechanics?.speedDie ?? null;
}

/** La configuration des tickets de bus, ou null. */
export function busTicketConfig(state) {
  return config(state).mechanics?.busTickets ?? null;
}

/**
 * Lance le troisième dé et range son résultat dans l'état.
 *
 * Il n'est **pas** lancé en prison : ni pour tenter les doubles, ni pour le
 * tirage de l'ordre de jeu — deux exclusions que la règle énonce noir sur
 * blanc, et que le moteur respecte en n'appelant simplement pas cette fonction
 * dans ces deux cas.
 *
 * @returns {{ kind: 'number'|'mr_monopoly'|'bus', face: number|string }|null}
 */
export function rollSpeedDie(state, rng) {
  const cfg = speedDieConfig(state);
  if (!cfg) {
    state.speedDie = null;
    return null;
  }
  const faces = cfg.faces ?? [1, 2, 3, 'mr_monopoly', 'bus', 'bus'];
  // `rng.int` et non `rng.next` : le troisième dé se scripte alors dans les
  // tests exactement comme les deux autres (`scriptedRng`).
  const face = faces[rng.int(faces.length)];
  const kind = typeof face === 'number' ? 'number' : face;
  state.speedDie = { face, kind, rollId: state.dice?.rollId ?? 0 };
  return state.speedDie;
}

// — Tickets de bus ————————————————————————————————————————————

/**
 * Les cases où un ticket de bus peut descendre : celles qui restent **devant**
 * la joueuse jusqu'au prochain coin inclus.
 *
 * ⚠️ Lecture assumée. La règle dit « n'importe quelle case du même côté du
 * plateau », les quatre coins délimitant les côtés — sans dire si l'on peut
 * revenir en arrière sur ce côté. On garde le sens du jeu : on avance, jamais
 * on ne recule.
 */
export function busDestinations(state, from) {
  const board = boardOf(state);
  const targets = [];
  for (let step = 1; step <= board.length; step++) {
    const id = (from + step) % board.length;
    targets.push(id);
    if (board[id].corner) break;
  }
  return targets;
}

/** Prend un ticket dans la pioche, s'il en reste. */
export function takeBusTicket(state, playerId) {
  const player = playerById(state, playerId);
  const pool = state.busTickets ?? [];
  if (!busTicketConfig(state) || pool.length === 0) {
    log(state, 'card', say(state, 'busTicketEmpty'), { playerId });
    return false;
  }
  const ticket = pool.shift();
  (player.busTickets ??= []).push(ticket);
  log(state, 'card', say(state, 'busTicketTaken', { name: player.name }), { playerId, ticketId: ticket.id });
  return true;
}

/** Le ticket qu'une joueuse détient sous cet identifiant, ou son premier. */
export function heldTicket(player, ticketId = null) {
  const held = player.busTickets ?? [];
  return held.find((t) => t.id === ticketId) ?? held[0] ?? null;
}

/**
 * Joue un ticket : la joueuse descend à la case choisie, et le ticket est
 * consommé. Certains tickets périment tous les autres en circulation — y
 * compris ceux de qui vient de jouer, la règle est explicite là-dessus.
 */
export function useBusTicket(state, playerId, ticketId, target, rng = null) {
  const player = playerById(state, playerId);
  const ticket = heldTicket(player, ticketId);
  if (!ticket) return { ok: false, error: "Vous n'avez pas de ticket de bus." };
  if (!busDestinations(state, player.position).includes(target))
    return { ok: false, error: "Cette case n'est pas desservie par ce ticket." };

  player.busTickets = (player.busTickets ?? []).filter((t) => t.id !== ticket.id);
  state.pending = { kind: null, playerIds: [] };

  if (ticket.expires) {
    const expired = state.players.reduce((n, p) => n + (p.busTickets?.length ?? 0), 0);
    for (const other of state.players) other.busTickets = [];
    log(state, 'card', say(state, 'busTicketsExpired', { count: expired }), { playerId, count: expired });
  }

  moveTo(state, playerId, target, true);
  log(state, 'card', say(state, 'busTicketUsed', { name: player.name, space: getSpace(state, target).name }), {
    playerId,
    spaceId: target,
  });
  resolveLanding(state, playerId, { diceTotal: rentDiceTotal(state, rng) });
  return { ok: true };
}

/** Le total des deux dés blancs du dernier jet — le seul que lisent les compagnies. */
export function whiteTotal(state) {
  return (state.dice?.values ?? []).reduce((a, b) => a + b, 0);
}

/**
 * Le jet dont dépend le loyer d'une compagnie.
 *
 * Un ticket de bus joué **à la place** du lancer n'en laisse aucun derrière lui :
 * on lance alors les deux dés blancs pour ce seul calcul, comme la règle le
 * demande pour toute arrivée sur une compagnie sans jet préalable. Le résultat
 * n'est pas journalisé comme un jet de déplacement — il n'en est pas un.
 */
function rentDiceTotal(state, rng) {
  if (state.dice?.rolled || !rng) return whiteTotal(state);
  const dice = config(state).dice;
  return rollDice(rng, dice.count, dice.sides).reduce((a, b) => a + b, 0);
}

// — Cases spéciales ————————————————————————————————————————————

/**
 * Case « Vente aux enchères » : on met une propriété de la banque en vente. S'il
 * n'y a plus rien à vendre, on file jusqu'au loyer le plus cher devant soi.
 */
export function resolveAuctionSpace(state, playerId) {
  const player = playerById(state, playerId);
  const free = boardOf(state)
    .filter((s) => isOwnable(state, s.id) && !state.properties[s.id]?.ownerId)
    .map((s) => s.id);

  if (free.length) {
    log(state, 'auction', say(state, 'auctionSpacePick', { name: player.name }), { playerId });
    state.pending = {
      kind: 'choose_space',
      playerIds: [playerId],
      payload: { reason: 'auction', then: 'auction', spaceIds: free },
    };
    return;
  }

  const target = steepestRentAhead(state, playerId);
  if (target == null) return;
  log(state, 'land', say(state, 'auctionSpaceEmpty', { name: player.name, space: getSpace(state, target).name }), {
    playerId,
    spaceId: target,
  });
  moveTo(state, playerId, target, true);
  resolveLanding(state, playerId, { diceTotal: whiteTotal(state) });
}

/**
 * La case devant soi où l'on devrait le plus cher à une adversaire. À loyer
 * égal, la plus proche — c'est pour ça qu'on garde le premier maximum trouvé.
 */
function steepestRentAhead(state, playerId) {
  const board = boardOf(state);
  let best = null;
  let bestRent = 0;
  for (let step = 1; step <= board.length; step++) {
    const id = (state.players.find((p) => p.id === playerId).position + step) % board.length;
    const prop = state.properties[id];
    if (!prop?.ownerId || prop.ownerId === playerId || prop.mortgaged) continue;
    const rent = rentFor(state, id, { diceTotal: whiteTotal(state) });
    if (rent > bestRent) {
      bestRent = rent;
      best = id;
    }
  }
  return best;
}

/** Case « Cadeau d'anniversaire » : de l'argent, ou un ticket de bus. */
export function resolveBirthdayGift(state, playerId) {
  const amount = config(state).mechanics?.birthdayGift ?? 100;
  const player = playerById(state, playerId);

  if (!busTicketConfig(state) || (state.busTickets ?? []).length === 0) {
    log(state, 'card', say(state, 'birthdayGiftCash', { name: player.name, amount: amountText(state, amount) }), { playerId });
    credit(state, playerId, amount, say(state, 'reasonBirthday'));
    return;
  }

  state.pending = {
    kind: 'card_choice',
    playerIds: [playerId],
    payload: {
      options: [
        { index: 0, label: say(state, 'birthdayTakeCash', { amount: amountText(state, amount) }) },
        { index: 1, label: say(state, 'birthdayTakeTicket') },
      ],
      actions: [{ type: 'collect', amount }, { type: 'take_bus_ticket' }],
    },
  };
}

// — Le déplacement laissé en suspens ————————————————————————————

/**
 * Joue le déplacement que le dé rapide a mis de côté, une fois la première case
 * entièrement réglée.
 *
 * @returns {boolean} vrai si la suite attend maintenant une décision — auquel
 *   cas l'appelant s'arrête là au lieu de proposer la fin du tour.
 */
export function runPostMove(state) {
  const move = state.postMove;
  if (!move) return false;
  state.postMove = null;

  const player = playerById(state, move.playerId);
  // Une joueuse partie en prison entre-temps ne repart pas : la règle le dit
  // pour Mr Monopoly, et c'est le seul cas où le second déplacement saute.
  if (!player || player.bankrupt || player.inJail) return false;

  if (move.type === 'mr_monopoly') moveMrMonopoly(state, player);
  else if (move.type === 'nearest_deck') moveToNearestDeck(state, player);

  return Boolean(state.pending.kind || state.debt || state.phase === 'finished');
}

/**
 * Mr Monopoly : la prochaine propriété libre, pour l'acheter ou la vendre aux
 * enchères. S'il n'en reste aucune, la prochaine où l'on devra un loyer.
 */
function moveMrMonopoly(state, player) {
  const board = boardOf(state);
  let target = null;
  for (let step = 1; step <= board.length && target == null; step++) {
    const id = (player.position + step) % board.length;
    if (isOwnable(state, id) && !state.properties[id]?.ownerId) target = id;
  }
  if (target == null) target = steepestNextRent(state, player);

  if (target == null) {
    log(state, 'land', say(state, 'mrMonopolyIdle', { name: player.name }), { playerId: player.id });
    return;
  }
  log(state, 'land', say(state, 'mrMonopolyMoves', { name: player.name, space: getSpace(state, target).name }), {
    playerId: player.id,
    spaceId: target,
  });
  moveTo(state, player.id, target, true);
  resolveLanding(state, player.id, { diceTotal: whiteTotal(state) });
}

/** La prochaine case devant soi dont le loyer est dû à une adversaire. */
function steepestNextRent(state, player) {
  const board = boardOf(state);
  for (let step = 1; step <= board.length; step++) {
    const id = (player.position + step) % board.length;
    const prop = state.properties[id];
    if (prop?.ownerId && prop.ownerId !== player.id && !prop.mortgaged) return id;
  }
  return null;
}

/** Le repli de la face Bus : on continue jusqu'à la prochaine case à carte. */
function moveToNearestDeck(state, player) {
  const board = boardOf(state);
  for (let step = 1; step <= board.length; step++) {
    const id = (player.position + step) % board.length;
    if (state.decks?.[board[id].type]) {
      log(state, 'land', say(state, 'busFallback', { name: player.name, space: board[id].name }), {
        playerId: player.id,
        spaceId: id,
      });
      moveTo(state, player.id, id, true);
      resolveLanding(state, player.id, { diceTotal: whiteTotal(state) });
      return;
    }
  }
}
