/**
 * Le cerveau : une action, pour la décision qu'on lui présente.
 *
 * Un bot est une fonction pure `(state, playerId) => action`. C'est le contrat
 * du moteur qui le permet : `state.pending` dit toujours qui doit décider et
 * quoi, et `dispatch` refuse tout le reste. Un bot ne peut donc pas tricher —
 * il passe exactement par la porte des joueuses humaines, et une action illégale
 * lui serait refusée comme à elles.
 *
 * Les quatre niveaux partagent ce fichier : la différence est dans le profil
 * (`profiles.js`) et dans les deux imperfections volontaires appliquées ici —
 * le bruit de jugement et la bourde franche.
 */
import {
  playerById, propertiesOf, buildingLevel, canBuild, canSellBuilding, canMortgage,
  maxRaisable, unmortgageCost, config,
} from '../engine/queries.js';
import { profileOf } from './profiles.js';
import { spaceWorth, spendable, cashFloor, buildRanking } from './evaluate.js';
import { findTradeOffer, findSettlementOffer, judgeTrade } from './negotiate.js';
import { bestOption, actionValue, landingValue, shouldRollBuyDie, saleCardToPlay } from './cards.js';

/** Bruit multiplicatif : un bot faible juge mal, il ne joue pas au hasard. */
function blur(value, profile, rng) {
  if (!profile.noise) return value;
  return value * (1 + (rng.next() * 2 - 1) * profile.noise);
}

/** Le bot se trompe-t-il franchement sur ce coup-ci ? */
function blunders(profile, rng) {
  return profile.blunderRate > 0 && rng.next() < profile.blunderRate;
}

/**
 * Décide de l'action à jouer, ou `null` si la décision ne le concerne pas.
 * @param {object} state
 * @param {string} playerId
 * @param {{next: () => number, int: (n: number) => number}} rng
 * @param {string} difficulty
 */
export function decideAction(state, playerId, rng, difficulty) {
  const profile = profileOf(difficulty);
  const pending = state.pending;
  if (!pending?.kind || !pending.playerIds.includes(playerId)) return null;
  const player = playerById(state, playerId);
  if (!player || player.bankrupt) return null;

  switch (pending.kind) {
    case 'roll':
      return decideRoll(state, player, profile);

    case 'reroll':
      // Relance offerte par un pouvoir de camp : on relance si le jet nous
      // envoie chez une adversaire bâtie, sinon on garde.
      return decideReroll(state, player, profile, rng);

    case 'buy_or_auction':
      return decideBuy(state, player, pending.payload, profile, rng);

    case 'auction_bid':
      return decideBid(state, player, profile, rng);

    case 'draw_card':
      return { type: 'DRAW_CARD' };

    case 'card_reveal':
      return { type: 'ACKNOWLEDGE_CARD' };

    // Toutes les invites à choix passent par ici : carte « payez ou piochez »,
    // sortie de prison sévère, raccourci de toile, coffre des ventes. On chiffre
    // chaque option et l'on prend la meilleure — c'est là qu'un bot cesse de
    // subir les règles pour s'en servir.
    case 'card_choice': {
      const count = pending.payload.options.length;
      if (blunders(profile, rng)) return { type: 'CARD_CHOICE', optionIndex: rng.int(count) };
      return { type: 'CARD_CHOICE', optionIndex: bestOption(state, playerId, pending.payload, profile) };
    }

    case 'pay_debt':
      return decideDebt(state, player, profile);

    case 'end_turn':
      return decideEndTurn(state, player, profile, rng);

    default:
      return null;
  }
}

/**
 * En prison : payer, jouer sa carte, ou tenter les doubles.
 *
 * Le calcul qui compte, et que les débutantes ratent : en début de partie on
 * veut sortir vite pour acheter, mais quand le plateau est bâti, la prison est
 * l'endroit le plus sûr — y rester coûte moins cher que d'en faire le tour.
 * `jailValue` chiffre exactement cet arbitrage sur la position réelle.
 */
function decideRoll(state, player, profile) {
  if (!player.inJail) return { type: 'ROLL_DICE' };

  const bail = config(state).jail?.bail ?? 50;
  // Positif = rester est bon. On sort donc quand c'est négatif.
  const stayValue = actionValue(state, player.id, { type: 'go_to_jail' }, profile);
  const wantOut = stayValue < 0;

  // La carte d'abord : elle ne coûte rien, autant s'en servir plutôt que payer.
  if (player.getOutOfJailCards > 0 && wantOut) return { type: 'USE_JAIL_CARD' };
  if (wantOut && player.cash - bail > cashFloor(state, player.id, profile)) return { type: 'PAY_BAIL' };
  return { type: 'ROLL_DICE' };
}

/** Relancer un jet : seulement si l'on tombe sur une case qui coûte cher. */
function decideReroll(state, player, profile, rng) {
  const total = (state.dice.values ?? []).reduce((a, b) => a + b, 0);
  const target = (player.position + total) % config(state).board.length;
  if (blunders(profile, rng)) return { type: 'KEEP_ROLL' };
  // On relance si la case d'arrivée nous coûte : loyer, taxe, prison mal placée.
  return landingValue(state, player.id, target, profile) < 0
    ? { type: 'REROLL_DICE' }
    : { type: 'KEEP_ROLL' };
}

/** Acheter la case où l'on vient de tomber, ou la laisser filer. */
function decideBuy(state, player, payload, profile, rng) {
  const price = payload.price;
  const worth = blur(spaceWorth(state, payload.spaceId, player.id, profile), profile, rng);

  // On peut toujours réunir de l'argent avant de renoncer : c'est exactement ce
  // que fait une joueuse humaine, et le moteur l'autorise à tout moment.
  if (player.cash < price) {
    const raise = raiseCash(state, player, profile, price - player.cash);
    if (raise && worth > price * 1.3) return raise;
  }
  if (player.cash < price) return { type: 'DECLINE_PROPERTY' };

  const affordable = player.cash - price >= cashFloor(state, player.id, profile) * 0.5;
  const wantsIt = worth > price;
  if (blunders(profile, rng)) return wantsIt ? { type: 'DECLINE_PROPERTY' } : { type: 'BUY_PROPERTY' };
  return wantsIt && affordable ? { type: 'BUY_PROPERTY' } : { type: 'DECLINE_PROPERTY' };
}

/** Enchérir jusqu'à sa propre estimation, jamais au-delà. */
function decideBid(state, player, profile, rng) {
  const auction = state.auction;
  if (!auction) return { type: 'AUCTION_PASS' };

  const worth = blur(spaceWorth(state, auction.spaceId, player.id, profile), profile, rng);
  const ceiling = Math.min(worth * profile.bidCeiling, spendable(state, player, profile));
  const next = auction.highestBid + Math.max(1, Math.round(auction.highestBid * 0.08));

  if (blunders(profile, rng)) return { type: 'AUCTION_PASS' };
  if (next > ceiling || next > player.cash) return { type: 'AUCTION_PASS' };
  return { type: 'AUCTION_BID', amount: next };
}

/**
 * Une dette à régler. L'ordre suit celui d'une joueuse sensée : payer si on
 * peut, sinon réunir la somme (vendre, hypothéquer), sinon négocier, et la
 * faillite en tout dernier recours.
 */
function decideDebt(state, player, profile) {
  const due = state.debt.amount;
  if (player.cash >= due) return { type: 'PAY_DEBT' };

  const raise = raiseCash(state, player, profile, due - player.cash);
  if (raise) return raise;

  // Plus rien à liquider : on tente un arrangement avant de mourir. Une seule
  // fois — une proposition refusée reste refusée, et la reproposer en boucle
  // fige la partie (l'invite de dette, elle, ne bouge pas tant qu'on n'a pas
  // payé ou déclaré forfait).
  if (maxRaisable(state, player.id) < due) {
    const tried = state.trades.some((t) => t.settlesDebt && t.fromPlayerId === player.id && t.status !== 'cancelled');
    if (!tried) {
      const offer = findSettlementOffer(state, player.id, profile);
      if (offer) {
        return {
          type: 'PROPOSE_TRADE',
          toPlayerId: offer.toPlayerId,
          give: offer.give,
          receive: offer.receive,
          settlesDebt: true,
        };
      }
    }
  }
  return { type: 'DECLARE_BANKRUPTCY' };
}

/**
 * Réunir `needed` : on vend les constructions les moins rentables, puis on
 * hypothèque les terrains les moins utiles. Une action à la fois — le moteur
 * nous redonnera la main tant que la dette est ouverte.
 */
function raiseCash(state, player, profile, needed) {
  if (needed <= 0) return null;

  // Vendre une construction : on commence par celle dont la perte coûte le moins.
  const sellable = buildRanking(state, player.id, profile)
    .filter(({ spaceId }) => canSellBuilding(state, player.id, spaceId).ok)
    .reverse();
  if (sellable.length) return { type: 'SELL_BUILDING', spaceId: sellable[0].spaceId };

  // Hypothéquer : le terrain le moins précieux d'abord. Toutes les boîtes ne
  // connaissent pas l'hypothèque — la Coupe des Quatre Maisons s'en passe — et
  // insister y faisait tourner le bot en rond (4 852 refus mesurés).
  if (config(state).mechanics?.mortgage) {
    const mortgageable = propertiesOf(state, player.id)
      // `canMortgage` porte la règle du groupe entier : s'en remettre à elle
      // évite que le bot s'entête sur un terrain nu d'un groupe encore bâti.
      .filter((prop) => canMortgage(state, player.id, prop.spaceId).ok)
      .map((prop) => ({ spaceId: prop.spaceId, worth: spaceWorth(state, prop.spaceId, player.id, profile) }))
      .sort((a, b) => a.worth - b.worth);
    if (mortgageable.length) return { type: 'MORTGAGE', spaceId: mortgageable[0].spaceId };
  }

  return null;
}

/**
 * Avant de passer la main : bâtir, lever une hypothèque, proposer un échange.
 * C'est là que se gagne une partie — un bot qui se contente de finir son tour
 * ne construit jamais rien.
 */
function decideEndTurn(state, player, profile, rng) {
  const budget = spendable(state, player, profile);

  // Le dé d'Achat (extension Tout Acheter) est facultatif et ne peut rien nous
  // coûter : sa face basse frappe une adversaire, jamais soi. On le lance donc
  // dès qu'il y a une carte à prendre.
  if (shouldRollBuyDie(state)) return { type: 'ROLL_BUY_DIE' };

  // Une carte rouge du coffre ne sert à rien tant qu'elle dort en main.
  const playable = saleCardToPlay(state, player.id, profile);
  if (playable) return { type: 'PLAY_SALE_CARD', cardId: playable };

  // Bâtir, tant que ça reste dans le budget et que ça rapporte.
  if (budget > 0) {
    for (const { spaceId } of buildRanking(state, player.id, profile)) {
      const check = canBuild(state, player.id, spaceId);
      if (!check.ok || check.cost > budget) continue;
      const prop = state.properties[spaceId];
      // Le palier des trois maisons est le meilleur rendement par euro investi :
      // au-delà, on n'y va que si la trésorerie est confortable.
      if (buildingLevel(prop) >= profile.buildTarget && budget < check.cost * 3) continue;
      if (blunders(profile, rng)) break;
      return { type: 'BUILD_HOUSE', spaceId };
    }
  }

  // Réveiller un terrain hypothéqué quand on a de quoi, il ne rapporte rien.
  for (const prop of config(state).mechanics?.mortgage ? propertiesOf(state, player.id) : []) {
    if (!prop.mortgaged) continue;
    const cost = unmortgageCost(state, prop.spaceId);
    if (cost <= budget - cashFloor(state, player.id, profile) * 0.2) {
      return { type: 'UNMORTGAGE', spaceId: prop.spaceId };
    }
  }

  // Proposer un échange — mais pas en boucle. Deux garde-fous : une seule offre
  // en attente à la fois, et pas plus d'une proposition par tour de table en
  // moyenne. Sans le second, un bot enchaîne les variantes d'un même marché à
  // chaque fin de tour et la partie n'avance plus (mesuré : 2 800 propositions
  // pour 90 tours joués).
  const alreadyOffering = state.trades.some((t) => t.status === 'pending' && t.fromPlayerId === player.id);
  const proposedSoFar = state.trades.filter((t) => t.fromPlayerId === player.id).length;
  if (!alreadyOffering && proposedSoFar < state.turnCount) {
    const offer = findTradeOffer(state, player.id, profile);
    if (offer) {
      return { type: 'PROPOSE_TRADE', toPlayerId: offer.toPlayerId, give: offer.give, receive: offer.receive };
    }
  }

  return { type: 'END_TURN' };
}

/**
 * Les échanges reçus se répondent hors de `state.pending` : le moteur les
 * accepte à tout moment. On les traite donc à part, avant chaque décision.
 * @returns {{type: string, tradeId: string, accept: boolean}|null}
 */
export function answerPendingTrade(state, playerId, difficulty) {
  const profile = profileOf(difficulty);
  const trade = state.trades?.find((t) => t.status === 'pending' && t.toPlayerId === playerId);
  if (!trade) return null;
  return { type: 'RESPOND_TRADE', tradeId: trade.id, accept: judgeTrade(state, playerId, trade, profile) };
}
