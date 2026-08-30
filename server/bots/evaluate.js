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

/**
 * Le loyer qu'on toucherait sur cette case avec `level` constructions.
 *
 * ⚠️ **Deux poids, deux mesures — le défaut corrigé ici.** Un terrain est
 * chiffré comme si l'on tenait tout son groupe et qu'on y avait bâti ; une gare
 * l'était sur son loyer courant, « sans supposer qu'on en possédera d'autres ».
 * Résultat mesuré : une gare à 200 € valait 14 à 55 € selon le niveau, quand un
 * terrain à 100 € en valait 384. Les bots laissaient donc filer des gares à 1 €
 * en ayant 1 500 € en poche — le coup bête le plus fréquent de l'archive,
 * 809 fois sur 40 parties.
 *
 * Gares et compagnies sont donc chiffrées sur la même hypothèse que les
 * terrains : **celle d'en posséder une de plus**, c'est-à-dire celle qu'on est
 * en train de créer en achetant. Les multiplicateurs de groupe de `spaceWorth`
 * font le reste, exactement comme pour un terrain.
 */
function rentAtLevel(state, spaceId, level, playerId = null) {
  const space = getSpace(state, spaceId);

  if (space.type === 'railroad' || space.type === 'utility') {
    const group = rulesOf(state).groups[space.group];
    const spaces = group?.spaces ?? [spaceId];
    let mine = 0;
    let free = 0;
    for (const id of spaces) {
      const owner = state.properties[id]?.ownerId;
      if (!owner) free += 1;
      else if (owner === playerId) mine += 1;
    }
    // La même hypothèse que pour un terrain : **on chiffre le plan, pas
    // l'instant**. Un terrain vaut son loyer groupe complet et bâti ; une gare
    // vaut donc le loyer du lot qu'on peut encore réunir — les quatre si
    // personne ne s'y est mis, sinon ce qui reste atteignable. En la chiffrant
    // sur la seule gare qu'on tient à l'instant, on obtenait 25 € de loyer pour
    // un bien à 200 €, et les bots les laissaient filer à 1 €.
    const reachable = Math.max(1, Math.min(mine + free, spaces.length));

    if (space.type === 'utility') {
      // Une compagnie ne se chiffre **pas** sur le lot entier, contrairement à
      // une gare. Deux raisons mesurées : son loyer dépend du jet et non d'un
      // barème qui grimpe, et son groupe ne compte que deux cases — si bien que
      // la prime « il n'en manque plus qu'une » se déclenche dès la première.
      // En la chiffrant sur le lot, une compagnie à 150 € en valait 1 239, plus
      // qu'une gare : l'inverse de ce que vaut vraiment le plateau.
      const held = Math.max(1, mine + 1);
      const factor = space.rentMultipliers?.[held - 1] ?? space.rentMultipliers?.[0] ?? 4;
      return factor * 7;
    }
    return space.rent?.[reachable - 1] ?? space.rent?.[0] ?? space.price * 0.1;
  }

  if (space.type !== 'property') {
    // Les titres posés par une extension (`landmark`) n'ont ni groupe ni
    // paliers : leur loyer courant est tout ce qu'on peut en dire.
    return rentFor(state, spaceId) || (space.rent?.[0] ?? space.price * 0.1);
  }
  if (level <= 0) return space.rent[0] * 2; // groupe complet, terrain nu
  // Le gratte-ciel n'a pas de palier imprimé : il ajoute la prime du groupe au
  // tarif de l'hôtel. Sans ça, le bot le chiffrait comme un hôtel — un gain
  // marginal de zéro, donc un palier qu'il ne construisait jamais.
  const top = space.rent.length - 1;
  if (level > top) {
    return space.rent[top] + (rulesOf(state).groups[space.group]?.skyscraperBonus ?? 0);
  }
  return space.rent[level];
}

/**
 * Le rendement d'une case si l'on possédait tout son groupe et qu'on y bâtissait
 * `level` constructions : ce que ça rapporte par tour de plateau adverse.
 */
export function yieldOf(state, spaceId, level = 3, playerId = null) {
  return landingOdds(state)[spaceId] * rentAtLevel(state, spaceId, level, playerId);
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
  let worth = yieldOf(state, spaceId, profile.buildTarget, playerId) * profile.yieldToPrice;

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
    worth += yieldOf(state, spaceId, profile.buildTarget, playerId) * profile.yieldToPrice * profile.blockRival * urgency;
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
    const potential = owned.reduce((sum, id) => sum + yieldOf(state, id, profile.buildTarget, playerId), 0) * profile.yieldToPrice;

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
  const mechanics = rulesOf(state).mechanics ?? {};
  // Le plafond suit ce que la boîte propose : un palier de plus là où le
  // gratte-ciel existe, sinon rien ne change.
  const cap = (profile.buildTarget ?? 3) + 2 + (mechanics.skyscrapers ? 1 : 0);
  const odds = landingOdds(state);
  const entries = [];

  for (const prop of propertiesOf(state, playerId)) {
    const space = getSpace(state, prop.spaceId);
    // Le dépôt de gare est un palier à part : il ne suit pas l'échelle des
    // maisons, il multiplie le loyer de sa gare. On le chiffre donc à part,
    // sans quoi son gain marginal se calculait à zéro et le bot l'ignorait.
    if (space.type === 'railroad') {
      if (!mechanics.trainDepots) continue;
      const factor = mechanics.trainDepots.rentFactor ?? 2;
      // Le loyer courant inclut déjà le dépôt s'il est posé : le gain de l'avoir
      // se lit donc différemment selon qu'on le construit ou qu'on le revend.
      // On classe la gare dans les deux cas — `canBuild` / `canSellBuilding`
      // trancheront, et sans cette entrée on ne saurait jamais revendre un dépôt.
      const rent = rentFor(state, prop.spaceId);
      entries.push({
        spaceId: prop.spaceId,
        gain: odds[prop.spaceId] * rent * (prop.depot ? (factor - 1) / factor : factor - 1),
      });
      continue;
    }
    const level = buildingLevel(prop);
    if (level >= cap) continue;
    entries.push({
      spaceId: prop.spaceId,
      gain: yieldOf(state, prop.spaceId, level + 1, playerId) - yieldOf(state, prop.spaceId, level, playerId),
    });
  }
  return entries.sort((a, b) => b.gain - a.gain);
}
