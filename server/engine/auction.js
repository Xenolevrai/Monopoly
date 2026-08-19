/**
 * Enchères.
 *
 * Déclenchées quand une joueuse refuse d'acheter (règle officielle) et pour
 * liquider les biens d'une faillite envers la banque. Départ à 0 €, chacune
 * mise ou passe à son tour, la dernière en lice emporte le lot.
 */
import { getSpace } from '../../shared/index.js';
import { log, amountText } from './log.js';
import { playerById, activePlayers } from './queries.js';
import { buyProperty } from './property.js';

/** Ouvre une enchère sur une case, en commençant par `openerId` s'il est fourni. */
export function startAuction(state, spaceId, openerId = null) {
  const bidders = activePlayers(state).map((p) => p.id);
  if (bidders.length === 0) return { ok: false, error: 'Aucune joueuse pour enchérir.' };

  const startIndex = openerId && bidders.includes(openerId) ? bidders.indexOf(openerId) : 0;
  state.auction = {
    spaceId,
    highestBid: 0,
    highestBidderId: null,
    activeBidders: bidders,
    currentBidderId: bidders[startIndex],
    minimumRaise: 1,
  };
  state.pending = { kind: 'auction_bid', playerIds: [bidders[startIndex]], payload: { spaceId } };
  log(state, 'auction', `${getSpace(state, spaceId).name} est mise aux enchères.`, { spaceId });
  return { ok: true };
}

/** Mise. Doit dépasser l'enchère courante et rester dans les moyens de la joueuse. */
export function placeBid(state, playerId, amount) {
  const auction = state.auction;
  if (!auction) return { ok: false, error: 'Aucune enchère en cours.' };
  if (auction.currentBidderId !== playerId) return { ok: false, error: "Ce n'est pas à vous d'enchérir." };

  const player = playerById(state, playerId);
  if (!Number.isInteger(amount) || amount <= auction.highestBid)
    return { ok: false, error: `Il faut miser plus de ${amountText(state, auction.highestBid)}.` };
  if (amount > player.cash) return { ok: false, error: 'Vous ne pouvez pas miser plus que votre solde.' };

  auction.highestBid = amount;
  auction.highestBidderId = playerId;
  log(state, 'auction', `${player.name} mise ${amountText(state, amount)}.`, { playerId, amount, spaceId: auction.spaceId });
  return advanceAuction(state);
}

/** Passe : la joueuse sort de l'enchère définitivement. */
export function passBid(state, playerId) {
  const auction = state.auction;
  if (!auction) return { ok: false, error: 'Aucune enchère en cours.' };
  if (auction.currentBidderId !== playerId) return { ok: false, error: "Ce n'est pas à vous d'enchérir." };

  auction.activeBidders = auction.activeBidders.filter((id) => id !== playerId);
  log(state, 'auction', `${playerById(state, playerId).name} passe.`, { playerId, spaceId: auction.spaceId });
  return advanceAuction(state);
}

/**
 * Passe la main, ou clôt l'enchère.
 *
 * On ne clôt que si plus personne n'est en lice, ou si la dernière en lice est
 * déjà la meilleure enchérisseuse. Sinon elle garde la main : sans ça, la
 * dernière joueuse restante n'aurait jamais l'occasion de faire sa première mise.
 */
function advanceAuction(state) {
  const auction = state.auction;

  if (auction.activeBidders.length === 0) return closeAuction(state);
  if (auction.activeBidders.length === 1) {
    const [lastBidder] = auction.activeBidders;
    if (auction.highestBidderId === lastBidder) return closeAuction(state);
    auction.currentBidderId = lastBidder;
    state.pending = { kind: 'auction_bid', playerIds: [lastBidder], payload: { spaceId: auction.spaceId } };
    return { ok: true };
  }

  const order = activePlayers(state)
    .map((p) => p.id)
    .filter((id) => auction.activeBidders.includes(id));
  const currentIndex = order.indexOf(auction.currentBidderId);
  const nextId = order[(currentIndex + 1) % order.length];
  auction.currentBidderId = nextId;
  state.pending = { kind: 'auction_bid', playerIds: [nextId], payload: { spaceId: auction.spaceId } };
  return { ok: true };
}

/** Attribue le lot, ou le laisse à la banque si personne n'a misé. */
function closeAuction(state) {
  const { spaceId, highestBid, highestBidderId } = state.auction;
  const space = getSpace(state, spaceId);
  state.auction = null;
  state.pending = { kind: null, playerIds: [] };

  if (highestBidderId && highestBid > 0) {
    buyProperty(state, highestBidderId, spaceId, highestBid);
    log(state, 'auction', `${playerById(state, highestBidderId).name} remporte ${space.name} pour ${amountText(state, highestBid)}.`, {
      playerId: highestBidderId,
      spaceId,
      amount: highestBid,
    });
  } else {
    log(state, 'auction', `Personne n'a misé : ${space.name} reste à la banque.`, { spaceId });
  }
  return { ok: true, sold: Boolean(highestBidderId) };
}

/**
 * Lance l'enchère suivante de la file (biens d'une faillite).
 * @returns {boolean} true si une enchère a été ouverte
 */
export function startQueuedAuction(state) {
  while (state.auctionQueue?.length) {
    const spaceId = state.auctionQueue.shift();
    if (state.properties[spaceId].ownerId) continue;
    const result = startAuction(state, spaceId);
    if (result.ok) return true;
  }
  return false;
}
