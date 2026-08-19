/**
 * Échanges entre joueuses : argent + propriétés + cartes « libérée de prison »
 * contre argent + propriétés + cartes.
 *
 * Un échange est validé deux fois : à la proposition (pour ne pas offrir ce
 * qu'on n'a pas) et à l'acceptation (l'état a pu changer entre-temps).
 */
import { getSpace } from '../../shared/index.js';
import { log, say, amountText } from './log.js';
import { playerById, buildingLevel } from './queries.js';
import { refreshDebtPending } from './money.js';

let tradeCounter = 0;

const emptySide = { cash: 0, spaceIds: [], jailCards: 0 };

function normalize(side = {}) {
  return {
    cash: Math.max(0, Math.round(side.cash ?? 0)),
    spaceIds: [...new Set(side.spaceIds ?? [])],
    jailCards: Math.max(0, Math.round(side.jailCards ?? 0)),
  };
}

/** Vérifie qu'une joueuse peut effectivement livrer sa part. */
function validateSide(state, playerId, side) {
  const player = playerById(state, playerId);
  if (!player || player.bankrupt) return `Joueuse introuvable.`;
  if (player.cash < side.cash) return `${player.name} n'a pas ${amountText(state, side.cash)}.`;
  if (player.getOutOfJailCards < side.jailCards)
    return `${player.name} n'a pas ${side.jailCards} carte(s) « libérée de prison ».`;
  for (const spaceId of side.spaceIds) {
    const prop = state.properties[spaceId];
    if (!prop || prop.ownerId !== playerId)
      return `${getSpace(state, spaceId).name} n'appartient pas à ${player.name}.`;
    if (buildingLevel(prop) > 0)
      return `${getSpace(state, spaceId).name} est construite : revendez les maisons avant de l'échanger.`;
  }
  return null;
}

/**
 * Propose un échange. L'autre joueuse répond quand elle veut — il n'y a pas
 * besoin d'attendre son tour.
 *
 * `settlesDebt` marque un **arrangement** : la débitrice propose des biens (ou de
 * l'argent) à sa créancière pour solder la dette en cours. Si l'arrangement est
 * accepté, la dette est effacée, quel que soit le montant cédé — c'est aux deux
 * joueuses de juger si le marché est bon.
 */
export function proposeTrade(state, fromPlayerId, toPlayerId, give, receive, options = {}) {
  if (fromPlayerId === toPlayerId) return { ok: false, error: 'Échange avec soi-même impossible.' };
  const from = playerById(state, fromPlayerId);
  const to = playerById(state, toPlayerId);
  if (!from || !to || from.bankrupt || to.bankrupt) return { ok: false, error: 'Joueuse indisponible.' };

  const settlesDebt = Boolean(options.settlesDebt);
  if (settlesDebt) {
    const debt = state.debt;
    if (!debt || debt.debtorId !== fromPlayerId)
      return { ok: false, error: "Vous n'avez pas de dette à solder." };
    if (debt.creditorId !== toPlayerId)
      return { ok: false, error: 'Un arrangement se négocie avec la créancière.' };
  }

  const giveSide = normalize(give ?? emptySide);
  const receiveSide = normalize(receive ?? emptySide);
  const error = validateSide(state, fromPlayerId, giveSide) ?? validateSide(state, toPlayerId, receiveSide);
  if (error) return { ok: false, error };

  const trade = {
    id: `t${++tradeCounter}`,
    fromPlayerId,
    toPlayerId,
    give: giveSide,
    receive: receiveSide,
    settlesDebt,
    debtAmount: settlesDebt ? state.debt.amount : null,
    status: 'pending',
  };
  state.trades.push(trade);
  log(
    state,
    'trade',
    settlesDebt
      ? say(state, 'tradeSettlementProposed', {
          from: from.name,
          to: to.name,
          amount: amountText(state, state.debt.amount),
        })
      : say(state, 'tradeProposed', { from: from.name, to: to.name }),
    { tradeId: trade.id, trade },
  );
  return { ok: true, trade };
}

/** Accepte ou refuse un échange. */
export function respondToTrade(state, playerId, tradeId, accept) {
  const trade = state.trades.find((t) => t.id === tradeId);
  if (!trade) return { ok: false, error: 'Échange introuvable.' };
  if (trade.status !== 'pending') return { ok: false, error: 'Cet échange est déjà résolu.' };
  if (trade.toPlayerId !== playerId) return { ok: false, error: "Cet échange ne vous est pas adressé." };

  const from = playerById(state, trade.fromPlayerId);
  const to = playerById(state, trade.toPlayerId);

  if (!accept) {
    trade.status = 'declined';
    log(
      state,
      'trade',
      trade.settlesDebt
        ? say(state, 'tradeSettlementDeclined', { from: from.name, to: to.name })
        : say(state, 'tradeDeclined', { from: from.name, to: to.name }),
      { tradeId },
    );
    return { ok: true, accepted: false };
  }

  // Un arrangement n'a de sens que tant que la dette existe.
  if (trade.settlesDebt && state.debt?.debtorId !== trade.fromPlayerId) {
    trade.status = 'cancelled';
    log(state, 'trade', say(state, 'tradeMoot'), { tradeId });
    return { ok: false, error: "Cette dette n'est plus en cours." };
  }

  // Revalidation : l'état a pu changer depuis la proposition.
  const error = validateSide(state, trade.fromPlayerId, trade.give) ?? validateSide(state, trade.toPlayerId, trade.receive);
  if (error) {
    trade.status = 'cancelled';
    log(state, 'trade', say(state, 'tradeImpossible', { error }), { tradeId });
    return { ok: false, error };
  }

  executeTrade(state, trade);
  trade.status = 'accepted';

  if (trade.settlesDebt && state.debt) {
    const amount = state.debt.amount;
    state.debt = null;
    state.pending = { kind: null, playerIds: [] };
    log(
      state,
      'debt',
      `${to.name} accepte l'arrangement : la dette de ${amountText(state, amount)} de ${from.name} est soldée.`,
      { playerId: trade.fromPlayerId, creditorId: trade.toPlayerId, amount },
    );
  }

  return { ok: true, accepted: true };
}

/** Annule une proposition qu'on a soi-même émise. */
export function cancelTrade(state, playerId, tradeId) {
  const trade = state.trades.find((t) => t.id === tradeId);
  if (!trade || trade.status !== 'pending') return { ok: false, error: 'Échange introuvable.' };
  if (trade.fromPlayerId !== playerId) return { ok: false, error: "Cet échange n'est pas le vôtre." };
  trade.status = 'cancelled';
  log(state, 'trade', say(state, 'tradeCancelled', { from: playerById(state, playerId).name }), { tradeId });
  return { ok: true };
}

function executeTrade(state, trade) {
  const from = playerById(state, trade.fromPlayerId);
  const to = playerById(state, trade.toPlayerId);

  from.cash -= trade.give.cash;
  to.cash += trade.give.cash;
  to.cash -= trade.receive.cash;
  from.cash += trade.receive.cash;

  from.getOutOfJailCards -= trade.give.jailCards;
  to.getOutOfJailCards += trade.give.jailCards;
  to.getOutOfJailCards -= trade.receive.jailCards;
  from.getOutOfJailCards += trade.receive.jailCards;

  for (const spaceId of trade.give.spaceIds) state.properties[spaceId].ownerId = to.id;
  for (const spaceId of trade.receive.spaceIds) state.properties[spaceId].ownerId = from.id;

  const describe = (side) =>
    [
      side.cash ? amountText(state, side.cash) : null,
      ...side.spaceIds.map((id) => getSpace(state, id).name),
      side.jailCards ? `${side.jailCards} carte(s) de prison` : null,
    ]
      .filter(Boolean)
      .join(', ') || say(state, 'nothing');

  log(
    state,
    'trade',
    say(state, 'tradeAccepted', { from: from.name, to: to.name, gives: describe(trade.give), receives: describe(trade.receive) }),
    { tradeId: trade.id, trade },
  );

  // Un échange peut avoir renfloué une joueuse endettée : le panneau de dette
  // se met à jour, mais c'est elle qui décide quand payer.
  refreshDebtPending(state);
}
