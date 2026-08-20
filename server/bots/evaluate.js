/**
 * Ce qu'une position « vaut » aux yeux d'un bot.
 *
 * Toute la force d'un bot tient ici : savoir qu'un terrain n'a pas le prix
 * inscrit sur sa carte. Il vaut ce qu'il rapportera — donc sa fréquence de
 * visite multipliée par son loyer une fois construit — et surtout ce qu'il
 * débloque : le troisième terrain d'un groupe vaut bien plus que les deux
 * premiers, et celui qui empêche une adversaire de compléter son groupe vaut
 * cher même si l'on n'en fera jamais rien.
 *
 * Rien ici n'est propre à une édition : tout se déduit du plateau reçu, donc un
 * reskin, une extension ou une boîte à points passent sans une ligne de plus.
 */
import { boardOf, getSpace, rulesOf, isOwnable } from '../../shared/index.js';
import { propertiesOf, ownsFullGroup, rentFor, buildingLevel, netWorth } from '../engine/queries.js';
import { landingOdds } from './odds.js';

/** Qui tient quoi dans un groupe, et où en est la course. */
export function groupStatus(state, groupId, playerId) {
  const group = rulesOf(state).groups[groupId];
  if (!group) return null;

  let mine = 0;
  let free = 0;
  const opponents = new Map();
  for (const spaceId of group.spaces) {
    const owner = state.properties[spaceId]?.ownerId;
    if (!owner) free += 1;
    else if (owner === playerId) mine += 1;
    else opponents.set(owner, (opponents.get(owner) ?? 0) + 1);
  }

  // La meilleure position adverse : c'est elle qui rend un blocage urgent.
  let bestRival = null;
  let bestRivalCount = 0;
  for (const [id, count] of opponents) {
    if (count > bestRivalCount) {
      bestRival = id;
      bestRivalCount = count;
    }
  }

  return {
    size: group.spaces.length,
    mine,
    free,
    bestRival,
    bestRivalCount,
    // Personne ne peut plus le compléter : le groupe est mort, ses terrains ne
    // valent plus que leur loyer nu.
    dead: mine > 0 && opponents.size > 0,
    minePossible: mine + free === group.spaces.length,
    rivalPossible: bestRival != null && bestRivalCount + free === group.spaces.length,
  };
}

/** Le loyer qu'on toucherait sur cette case avec `level` constructions. */
function rentAtLevel(state, spaceId, level) {
  const space = getSpace(state, spaceId);
  if (space.type !== 'property') {
    // Gares et compagnies : on prend le loyer courant tel que le moteur le
    // calcule, sans supposer qu'on en possédera d'autres.
    return rentFor(state, spaceId) || (space.rent?.[0] ?? space.price * 0.1);
  }
  if (level <= 0) return space.rent[0] * 2; // groupe complet, terrain nu
  return space.rent[Math.min(level, space.rent.length - 1)];
}

/**
 * Le rendement d'une case si l'on possédait tout son groupe et qu'on y bâtissait
 * `level` constructions : ce que ça rapporte par tour de plateau adverse.
 */
export function yieldOf(state, spaceId, level = 3) {
  return landingOdds(state)[spaceId] * rentAtLevel(state, spaceId, level);
}

/**
 * Ce que vaut *pour cette joueuse* le fait d'acquérir cette case.
 *
 * Renvoie une valeur en monnaie du jeu, comparable à un prix d'achat : c'est ce
 * qui permet de décider d'un achat, d'une enchère ou d'un échange avec la même
 * unité de mesure.
 */
export function spaceWorth(state, spaceId, playerId, profile) {
  if (!isOwnable(state, spaceId)) return 0;
  const space = getSpace(state, spaceId);
  const status = space.group ? groupStatus(state, space.group, playerId) : null;

  // Socle : le rendement du groupe complet, ramené à une échelle de prix. Le
  // facteur convertit « gain par tour de plateau » en valeur d'actif ; sa
  // valeur exacte importe peu, seule la comparaison entre cases compte.
  let worth = yieldOf(state, spaceId, profile.buildTarget) * profile.yieldToPrice;

  if (!status) return Math.max(worth, space.price);

  // Ce qui compte vraiment : où ce terrain place-t-il la course au groupe ?
  const wouldOwn = status.mine + 1;
  if (wouldOwn === status.size) {
    worth *= profile.completesGroup; // il ferme le groupe : c'est le gros lot
  } else if (status.minePossible && wouldOwn === status.size - 1) {
    worth *= profile.nearlyGroup; // il n'en manquera plus qu'un
  } else if (!status.minePossible) {
    worth *= profile.deadGroup; // groupe déjà cassé : simple loyer nu
  }

  // Valeur défensive : priver une adversaire de son groupe vaut cher, d'autant
  // plus qu'elle en est proche. Les bots faibles n'y pensent pas.
  if (status.rivalPossible && status.bestRivalCount > 0) {
    const urgency = status.bestRivalCount / (status.size - 1);
    worth += yieldOf(state, spaceId, profile.buildTarget) * profile.yieldToPrice * profile.blockRival * urgency;
  }

  return worth;
}

/** Le matelas de trésorerie qu'on veut garder pour encaisser un loyer. */
export function cashFloor(state, playerId, profile) {
  const board = boardOf(state);
  const odds = landingOdds(state);

  // L'espérance de ce qu'on paiera en tombant chez les autres, sur un tour de
  // plateau. Un bot prudent garde de quoi encaisser plusieurs fois ça.
  let exposure = 0;
  for (const space of board) {
    const prop = state.properties[space.id];
    if (!prop?.ownerId || prop.ownerId === playerId || prop.mortgaged) continue;
    exposure += odds[space.id] * rentFor(state, space.id, { diceTotal: 7 });
  }
  return exposure * profile.cashReserve;
}

/** Ce qu'il reste après avoir mis de côté le matelas : de quoi dépenser. */
export function spendable(state, player, profile) {
  return player.cash - cashFloor(state, player.id, profile);
}

/**
 * Score global d'une position, pour comparer deux mondes possibles (avant et
 * après un échange). Patrimoine, plus la valeur stratégique des groupes tenus.
 */
export function positionScore(state, playerId, profile) {
  let score = netWorth(state, playerId);

  const groups = rulesOf(state).groups;
  for (const groupId of Object.keys(groups)) {
    const status = groupStatus(state, groupId, playerId);
    if (!status || status.mine === 0) continue;

    const owned = groups[groupId].spaces.filter((id) => state.properties[id]?.ownerId === playerId);
    const potential = owned.reduce((sum, id) => sum + yieldOf(state, id, profile.buildTarget), 0) * profile.yieldToPrice;

    if (ownsFullGroup(state, playerId, groupId)) score += potential * profile.completesGroup;
    else if (status.minePossible) score += potential * (status.mine / status.size) * profile.nearlyGroup;
  }

  // Les terrains hypothéqués ne rapportent rien tant qu'ils dorment.
  for (const prop of propertiesOf(state, playerId)) {
    if (prop.mortgaged) score -= getSpace(state, prop.spaceId).mortgage * profile.mortgagePenalty;
  }

  return score;
}

/** Les constructions qu'on peut poser, de la plus rentable à la moins. */
export function buildRanking(state, playerId, profile) {
  return propertiesOf(state, playerId)
    .filter((prop) => buildingLevel(prop) < (profile.buildTarget ?? 3) + 2)
    .map((prop) => ({ spaceId: prop.spaceId, gain: yieldOf(state, prop.spaceId, buildingLevel(prop) + 1) - yieldOf(state, prop.spaceId, buildingLevel(prop)) }))
    .sort((a, b) => b.gain - a.gain);
}
