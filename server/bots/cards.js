/**
 * Ce que vaut une carte, un choix, une case où l'on va tomber.
 *
 * Un bot qui pioche « payez 25 € ou tirez une carte Chance » et répond toujours
 * « la première » ne connaît pas les règles, il les subit. Ce fichier chiffre
 * chaque effet que le moteur sait appliquer, dans la monnaie du jeu, pour que
 * les choix se comparent — et se tranchent.
 *
 * Deux principes tenus partout :
 *  - **la valeur dépend de la position**, pas seulement de l'effet : aller en
 *    prison est mauvais au premier tour et bon en fin de partie, quand le
 *    plateau est bâti et qu'y circuler coûte cher ;
 *  - **on ne devine jamais l'aléatoire** : une carte à piocher vaut la moyenne
 *    de son paquet, calculée sur les cartes qu'il contient vraiment.
 */
import { boardOf, getSpace, isOwnable, rulesOf } from '../../shared/index.js';
import {
  playerById, propertiesOf, buildingLevel, buildingsOf,
  rentFor, activePlayers, config,
} from '../engine/queries.js';
import { getCard } from '../engine/cards.js';
import { landingOdds } from './odds.js';
import { spaceWorth } from './evaluate.js';

/** Combien coûte, en moyenne, de circuler un tour de plateau parmi les autres. */
function boardHeat(state, playerId) {
  const odds = landingOdds(state);
  let cost = 0;
  for (const space of boardOf(state)) {
    const prop = state.properties[space.id];
    if (!prop?.ownerId || prop.ownerId === playerId || prop.mortgaged) continue;
    cost += odds[space.id] * rentFor(state, space.id, { diceTotal: 7 });
  }
  return cost;
}

/**
 * Ce que vaut le fait d'atterrir sur cette case — en bien comme en mal.
 * C'est la brique qu'utilisent toutes les cartes qui déplacent.
 *
 * `depth` doit voyager jusqu'ici : une case à carte se chiffre par la moyenne
 * de son paquet, dont les cartes déplacent, dont les cases d'arrivée sont
 * parfois des cases à carte. Sans ce compteur, « reculez de trois cases » posée
 * trois cases après une case Chance se rappelait elle-même sans fin, et le bot
 * partait en débordement de pile. Le plateau agrandi rend le cycle courant.
 */
export function landingValue(state, playerId, spaceId, profile, depth = 0) {
  const space = getSpace(state, spaceId);
  const player = playerById(state, playerId);
  const prop = state.properties[spaceId];

  // Case tenue par une adversaire : on paiera le loyer.
  if (prop?.ownerId && prop.ownerId !== playerId && !prop.mortgaged) {
    return -rentFor(state, spaceId, { diceTotal: 7 });
  }

  // Case libre et achetable : elle vaut ce qu'on gagnerait à la prendre, si
  // l'on en a les moyens — sinon elle partira aux enchères et ne vaut rien.
  if (isOwnable(state, spaceId) && !prop?.ownerId) {
    const worth = spaceWorth(state, spaceId, playerId, profile);
    const gain = worth - space.price;
    return player.cash >= space.price ? Math.max(0, gain) : 0;
  }

  switch (space.type) {
    case 'go':
      return config(state).currency.goBonus;
    case 'tax':
      return -(space.amount ?? 0);
    case 'go_to_jail':
    case 'super_jail':
      return jailValue(state, playerId, profile);
    case 'free_parking':
      return state.settings?.freeParkingPot ? (state.freeParkingPot ?? 0) * 0.5 : 0;
    default:
      // Case à carte : la moyenne du paquet correspondant.
      if (state.decks?.[space.type]) return deckAverage(state, playerId, space.type, profile, depth);
      return 0;
  }
}

/**
 * Aller en prison : mauvais tant qu'il reste des terrains à acheter, bon quand
 * le plateau est bâti et qu'un tour de circulation coûte plus que la caution.
 */
function jailValue(state, playerId, profile) {
  const bail = config(state).jail?.bail ?? 50;
  const heat = boardHeat(state, playerId);
  const free = boardOf(state).filter((s) => isOwnable(state, s.id) && !state.properties[s.id]?.ownerId).length;

  // Trois tours passés à l'abri contre les loyers qu'on aurait payés dehors.
  const shelter = heat * 3 - bail;
  // Mais chaque tour en prison est un tour où l'on n'achète pas.
  const missed = free > 0 ? free * 0.4 * profile.completesGroup : 0;
  return shelter - missed;
}

/** La valeur moyenne d'une carte de ce paquet, sur les cartes qu'il contient. */
function deckAverage(state, playerId, deck, profile, depth = 0) {
  const ids = state.decks?.[deck];
  if (!ids?.length || depth > 1) return 0;
  let total = 0;
  for (const id of ids) {
    const card = getCard(state, id);
    if (card?.action) total += actionValue(state, playerId, card.action, profile, depth + 1);
  }
  return total / ids.length;
}

/**
 * Ce que vaut un effet de carte, en monnaie du jeu.
 *
 * Couvre tout ce que `applyCardAction` sait faire : si le moteur apprend un
 * effet, il s'ajoute ici, sinon le bot le traitera comme neutre — jamais comme
 * une erreur, pour qu'une édition nouvelle ne le fasse pas trébucher.
 */
export function actionValue(state, playerId, action, profile, depth = 0) {
  if (!action) return 0;
  const player = playerById(state, playerId);
  const rivals = activePlayers(state).filter((p) => p.id !== playerId).length;
  const size = boardOf(state).length;

  switch (action.type) {
    case 'collect':
      return action.amount ?? 0;
    case 'pay':
      return -(action.amount ?? 0);

    case 'collect_from_each':
      return (action.amount ?? 0) * rivals;
    case 'pay_to_each':
      return -(action.amount ?? 0) * rivals;

    case 'pay_per_building': {
      const { houses, hotels } = buildingsOf(state, playerId);
      return -(houses * (action.perHouse ?? 0) + hotels * (action.perHotel ?? 0));
    }

    case 'move_to': {
      const passesGo = action.collectGoSalary !== false && action.target < player.position;
      const salary = passesGo ? config(state).currency.goBonus : 0;
      return landingValue(state, playerId, action.target, profile, depth) + salary;
    }

    case 'move_relative': {
      const target = ((player.position + (action.offset ?? 0)) % size + size) % size;
      return landingValue(state, playerId, target, profile, depth);
    }

    case 'nearest':
    case 'nearest_unowned': {
      // On regarde la prochaine case du type visé, en avançant.
      for (let step = 1; step <= size; step++) {
        const id = (player.position + step) % size;
        if (getSpace(state, id).type !== action.spaceType) continue;
        if (action.type === 'nearest_unowned' && state.properties[id]?.ownerId) continue;
        const base = landingValue(state, playerId, id, profile, depth);
        // Le multiplicateur de loyer des cartes « payez le double ».
        return action.rentMultiplier && base < 0 ? base * action.rentMultiplier : base;
      }
      return 0;
    }

    case 'go_to_jail':
      return jailValue(state, playerId, profile);

    case 'pay_bail':
      return -(config(state).jail?.bail ?? 50);

    case 'get_out_of_jail_free':
      // Elle vaut la caution qu'elle évitera, et se revend.
      return (config(state).jail?.bail ?? 50) * 1.2;

    case 'draw_card':
      return deckAverage(state, playerId, action.deck, profile, depth);

    case 'sequence':
      return (action.actions ?? []).reduce((sum, a) => sum + actionValue(state, playerId, a, profile, depth), 0);

    case 'choice':
      // On prendra la meilleure option : c'est donc elle qui donne sa valeur.
      return Math.max(...(action.options ?? []).map((o) => actionValue(state, playerId, o.action, profile, depth)));

    // — Effets apportés par les extensions ————————————————————
    case 'collect_from_pot':
    case 'jackpot':
      return state.freeParkingPot ?? 0;
    case 'pay_to_pot':
      return -(action.amount ?? 0);

    case 'take_sale_card':
      return saleCardValue(state, playerId, action.cardId, profile, depth);
    case 'lose_sale_card':
      return -(player.saleCards ?? []).length * 60;

    case 'warp': {
      const gain = landingValue(state, playerId, action.target, profile, depth);
      return gain - (action.cost ?? 0);
    }

    case 'free_building':
      return (action.count ?? 1) * 120;
    case 'grant_rent_waiver':
      return (action.count ?? 1) * boardHeat(state, playerId);
    case 'clear_hazard':
      return 40;
    case 'steal_from_richest':
      return action.amount ?? 0;

    // Le pion hostile : l'éloigner de soi est bon, le poser sur une adversaire
    // aussi. On reste prudent, faute de savoir où il ira ensuite.
    case 'move_hazard':
    case 'place_hazard':
      return 25;

    case 'rival_move_relative':
      return 20;

    default:
      return 0;
  }
}

/** Ce que vaut une carte du coffre des ventes, selon sa couleur. */
export function saleCardValue(state, playerId, cardId, profile, depth = 0) {
  const card = getCard(state, cardId);
  if (!card) return 0;

  // Verte : elle gagne la partie si sa condition tombe. On la prend si l'on en
  // est proche, sinon elle ne vaut presque rien.
  if (card.victory) return victoryProximity(state, playerId, card.victory) * 5000;

  // Jaune : un revenu à chaque tour, d'autant plus précieux qu'il reste des
  // tours à jouer. On table sur une dizaine.
  if (card.perTurn) return actionValue(state, playerId, card.perTurn, profile, depth) * 10;

  return actionValue(state, playerId, card.action, profile, depth);
}

/** À quel point est-on près de remplir une condition de victoire (0 → 1). */
function victoryProximity(state, playerId, victory) {
  const player = playerById(state, playerId);
  switch (victory.type) {
    case 'cash_at_least':
      return Math.min(1, player.cash / (victory.amount || 1));
    case 'own_at_least':
      return Math.min(1, propertiesOf(state, playerId).length / (victory.count || 1));
    case 'buildings_at_least': {
      const built = propertiesOf(state, playerId).reduce((sum, p) => sum + buildingLevel(p), 0);
      return Math.min(1, built / (victory.count || 1));
    }
    default:
      return 0;
  }
}

/**
 * Devant plusieurs options (carte à choix, sortie de prison, coffre des
 * ventes) : l'index de la meilleure.
 */
export function bestOption(state, playerId, payload, profile) {
  const actions = payload?.actions ?? [];
  if (!actions.length) return 0;
  let best = 0;
  let bestValue = -Infinity;
  actions.forEach((action, index) => {
    const value = actionValue(state, playerId, action, profile);
    if (value > bestValue) {
      bestValue = value;
      best = index;
    }
  });
  return best;
}

/**
 * Faut-il lancer le dé d'Achat ? Il est facultatif et sans risque direct : la
 * face basse fait perdre une carte à une adversaire, jamais à soi. On le lance
 * donc dès qu'il y a quelque chose à gagner.
 */
export function shouldRollBuyDie(state) {
  const cfg = rulesOf(state).mechanics?.buyDie;
  if (!cfg || state.dice?.buyDieUsed) return false;
  return (state.saleVault?.visible ?? []).length > 0;
}

/**
 * Une carte du coffre à jouer maintenant ? On ne joue que ce qui rapporte, et
 * l'on garde les cartes de sortie de prison pour le moment où elles servent.
 */
export function saleCardToPlay(state, playerId, profile) {
  const player = playerById(state, playerId);
  for (const cardId of player.saleCards ?? []) {
    if (player.saleCardsDrawnTurn?.[cardId] === state.turnCount) continue;
    const card = getCard(state, cardId);
    if (!card?.action) continue; // jaune (permanente) ou verte (victoire) : rien à jouer
    if (card.action.type === 'get_out_of_jail_free' && !player.inJail) continue;
    const value = actionValue(state, playerId, card.action, profile);
    if (value > 0) return cardId;
  }
  return null;
}

/** Sert aux tests : la valeur qu'un bot donne à un effet, sans jouer. */
export { boardHeat };
