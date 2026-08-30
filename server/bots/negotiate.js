/**
 * Négocier : proposer, évaluer, accepter ou refuser.
 *
 * C'est ce qui sépare un bot qui « joue » d'un bot qui *gagne* : au Monopoly,
 * les groupes se ferment presque toujours par un échange, pas par la chance des
 * dés. Le principe tenu ici est celui d'un échange honnête mais intéressé — on
 * mesure sa position avant et après (`positionScore`), et l'on n'accepte que ce
 * qui améliore la sienne d'une marge que le profil fixe.
 *
 * Un bot ne triche jamais : il ne lit que ce que `state` expose déjà à toute
 * joueuse humaine — les biens de chacune, les soldes, le plateau. Aucun accès
 * aux dés à venir ni aux cartes de la pile.
 */
import { getSpace, rulesOf } from '../../shared/index.js';
import { propertiesOf, buildingLevel, playerById, activePlayers } from '../engine/queries.js';
import { groupStatus, positionScore, spaceWorth, spendable } from './evaluate.js';

/**
 * Le score d'une position dans un monde hypothétique.
 *
 * On applique l'échange sur une copie de l'état, on mesure, on jette la copie.
 * C'est possible — et bon marché — précisément parce que l'état du jeu est du
 * JSON pur : `structuredClone` suffit, aucune classe ni référence vivante à
 * reconstruire.
 */
function scoreAfterTrade(state, playerId, trade, profile) {
  const draft = structuredClone(state);
  const from = playerById(draft, trade.fromPlayerId);
  const to = playerById(draft, trade.toPlayerId);
  if (!from || !to) return null;

  for (const spaceId of trade.give.spaceIds ?? []) draft.properties[spaceId].ownerId = to.id;
  for (const spaceId of trade.receive.spaceIds ?? []) draft.properties[spaceId].ownerId = from.id;
  from.cash += (trade.receive.cash ?? 0) - (trade.give.cash ?? 0);
  to.cash += (trade.give.cash ?? 0) - (trade.receive.cash ?? 0);

  return positionScore(draft, playerId, profile);
}

/**
 * Faut-il accepter cet échange ?
 *
 * `settlesDebt` change tout : une proposition qui efface une dette vaut d'être
 * refusée si l'on préfère voir l'adversaire faire faillite et récupérer ses
 * biens — mais l'accepter garde une joueuse en vie, ce qu'un bot doux préfère.
 */
export function judgeTrade(state, playerId, trade, profile) {
  const before = positionScore(state, playerId, profile);
  const after = scoreAfterTrade(state, playerId, trade, profile);
  if (after == null) return false;

  // Ne jamais se laisser vider sa trésorerie sous le matelas de sécurité.
  const me = playerById(state, playerId);
  const outgoing = playerId === trade.fromPlayerId ? (trade.give.cash ?? 0) : (trade.receive.cash ?? 0);
  if (outgoing > 0 && outgoing > spendable(state, me, profile)) return false;

  const margin = Math.abs(before) * profile.tradeMargin;
  return after > before + margin;
}

/**
 * Cherche un échange à proposer : un terrain que je veux, contre un terrain
 * qu'elle veut, plus du liquide pour équilibrer.
 *
 * On ne fabrique pas mille combinaisons : on vise le cas qui gagne vraiment les
 * parties — le terrain qui ferme mon groupe, échangé contre celui qui ferme le
 * sien. Un échange qui profite aux deux se conclut ; c'est ce qui le rend
 * acceptable par une humaine comme par un autre bot.
 */
function offerSignature(trade) {
  return [
    trade.toPlayerId,
    [...(trade.give.spaceIds ?? [])].sort().join('.'),
    [...(trade.receive.spaceIds ?? [])].sort().join('.'),
  ].join('|');
}

/** Les marchés déjà refusés : on ne remet pas deux fois la même offre. */
function refusedOffers(state, playerId) {
  return new Set(
    (state.trades ?? [])
      .filter((t) => t.fromPlayerId === playerId && t.status === 'declined')
      .map(offerSignature),
  );
}

export function findTradeOffer(state, playerId, profile) {
  if (!profile.proposesTrades) return null;
  const me = playerById(state, playerId);
  const groups = rulesOf(state).groups;
  const refused = refusedOffers(state, playerId);

  /** Ce qui me manque pour fermer un groupe, chez qui, et ce que ça vaut. */
  const wanted = [];
  for (const [groupId, group] of Object.entries(groups)) {
    const status = groupStatus(state, groupId, playerId);
    // Il ne me manque qu'une case, et elle appartient à quelqu'un.
    if (!status || status.mine !== status.size - 1 || status.free > 0) continue;
    for (const spaceId of group.spaces) {
      const prop = state.properties[spaceId];
      if (!prop?.ownerId || prop.ownerId === playerId) continue;
      if (buildingLevel(prop) > 0) continue; // on n'échange pas un terrain bâti
      wanted.push({ spaceId, ownerId: prop.ownerId, worth: spaceWorth(state, spaceId, playerId, profile) });
    }
  }
  if (!wanted.length) return null;
  wanted.sort((a, b) => b.worth - a.worth);

  for (const target of wanted) {
    const partner = playerById(state, target.ownerId);
    if (!partner || partner.bankrupt) continue;

    // Ce que je peux offrir : mes terrains nus, en commençant par ceux qui me
    // servent le moins et qui lui servent le plus.
    const offers = propertiesOf(state, playerId)
      .filter((prop) => buildingLevel(prop) === 0 && !prop.mortgaged)
      .map((prop) => ({
        spaceId: prop.spaceId,
        costToMe: spaceWorth(state, prop.spaceId, playerId, profile),
        valueToThem: spaceWorth(state, prop.spaceId, partner.id, profile),
      }))
      // Un terrain qui lui ferme un groupe et ne me sert à rien : la monnaie
      // d'échange idéale.
      .sort((a, b) => b.valueToThem - b.costToMe - (a.valueToThem - a.costToMe));

    // Une offre en **liquide pur** ferme la liste : on n'a pas toujours un
    // terrain dont l'autre veuille, et l'argent intéresse tout le monde. Sans
    // ce cas, un bot assis sur 2 000 € à qui il ne manquait qu'une case ne
    // pouvait rien proposer du tout, faute d'avoir un terrain nu à céder.
    const candidats = [...offers.slice(0, 3), { spaceId: null, costToMe: 0, valueToThem: 0 }];

    for (const offer of candidats) {
      // On ne donne pas un terrain qui vaut plus pour nous que ce qu'on prend.
      if (offer.costToMe > target.worth) continue;

      // Le liquide qui équilibre, du point de vue de l'autre : on comble ce qui
      // lui manque pour que l'échange lui soit favorable, dans nos moyens.
      const gap = Math.max(0, spaceWorth(state, target.spaceId, partner.id, profile) - offer.valueToThem);
      const cash = Math.min(Math.round(gap), Math.max(0, Math.floor(spendable(state, me, profile))));

      const trade = {
        fromPlayerId: playerId,
        toPlayerId: partner.id,
        give: { cash, spaceIds: offer.spaceId == null ? [] : [offer.spaceId], jailCards: 0 },
        receive: { cash: 0, spaceIds: [target.spaceId], jailCards: 0 },
      };

      // On ne propose que ce qui nous sert *et* a une chance d'être accepté :
      // proposer un marché de dupes à répétition ne fait qu'agacer.
      if (refused.has(offerSignature(trade))) continue;
      const goodForMe = judgeTrade(state, playerId, trade, profile);
      const plausibleForThem = scoreAfterTrade(state, partner.id, trade, profile) > positionScore(state, partner.id, profile);
      if (goodForMe && plausibleForThem) return trade;
    }
  }
  return null;
}

/**
 * Face à une dette qu'on ne peut pas payer : à qui proposer un arrangement ?
 * On cède ce qu'il faut à la créancière plutôt que de faire faillite — un bot
 * qui préfère mourir que négocier n'apprend rien à personne.
 */
export function findSettlementOffer(state, playerId, profile) {
  const debt = state.debt;
  if (!debt || debt.debtorId !== playerId || !debt.creditorId) return null;
  const creditor = playerById(state, debt.creditorId);
  if (!creditor || creditor.bankrupt) return null;

  const me = playerById(state, playerId);
  // On propose les terrains les moins utiles d'abord, jusqu'à couvrir la dette
  // aux yeux de la créancière.
  const mine = propertiesOf(state, playerId)
    .filter((prop) => buildingLevel(prop) === 0)
    .map((prop) => ({
      spaceId: prop.spaceId,
      costToMe: spaceWorth(state, prop.spaceId, playerId, profile),
      valueToThem: spaceWorth(state, prop.spaceId, creditor.id, profile),
    }))
    .sort((a, b) => a.costToMe - b.costToMe);

  const give = [];
  let offered = me.cash;
  for (const candidate of mine) {
    if (offered >= debt.amount) break;
    give.push(candidate.spaceId);
    offered += candidate.valueToThem;
  }
  if (!give.length) return null;

  return {
    fromPlayerId: playerId,
    toPlayerId: creditor.id,
    give: { cash: Math.min(me.cash, debt.amount), spaceIds: give, jailCards: 0 },
    receive: { cash: 0, spaceIds: [], jailCards: 0 },
    settlesDebt: true,
  };
}

/** Les adversaires encore en jeu, hors soi-même. */
export function rivalsOf(state, playerId) {
  return activePlayers(state).filter((p) => p.id !== playerId);
}

/** Sert aux tests : la valeur qu'un bot donne à une case, sans jouer. */
export function appraise(state, spaceId, playerId, profile) {
  return { worth: spaceWorth(state, spaceId, playerId, profile), price: getSpace(state, spaceId).price };
}
