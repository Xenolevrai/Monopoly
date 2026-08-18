/**
 * Lectures dérivées de l'état. Aucune fonction ici ne modifie quoi que ce soit :
 * tout ce qui peut se recalculer (loyer, groupe complet, valeur du patrimoine)
 * est calculé, jamais stocké — c'est ce qui évite les incohérences.
 */
import { getSpace, getGroup, board, rules } from '../../shared/index.js';

export function playerById(state, playerId) {
  return state.players.find((p) => p.id === playerId) ?? null;
}

export function currentPlayer(state) {
  return state.players[state.currentPlayerIndex] ?? null;
}

/** Joueuses encore en lice, dans l'ordre de jeu. */
export function activePlayers(state) {
  return state.players.filter((p) => !p.bankrupt);
}

/** Les états de propriété détenus par une joueuse. */
export function propertiesOf(state, playerId) {
  return Object.values(state.properties).filter((p) => p.ownerId === playerId);
}

/** Vrai si la joueuse possède tout le groupe de couleur de cette case. */
export function ownsFullGroup(state, playerId, groupId) {
  const group = getGroup(groupId);
  if (!group) return false;
  return group.spaces.every((id) => state.properties[id].ownerId === playerId);
}

/** Vrai si aucune case du groupe n'est hypothéquée. */
export function groupIsClear(state, groupId) {
  return getGroup(groupId).spaces.every((id) => !state.properties[id].mortgaged);
}

/** Niveau de construction d'une case : 0-4 maisons, 5 = hôtel. */
export function buildingLevel(prop) {
  return prop.hotel ? 5 : prop.houses;
}

/** Nombre de gares possédées par une joueuse. */
export function railroadCount(state, playerId) {
  return getGroup('railroad').spaces.filter((id) => state.properties[id].ownerId === playerId).length;
}

/** Nombre de compagnies possédées par une joueuse. */
export function utilityCount(state, playerId) {
  return getGroup('utility').spaces.filter((id) => state.properties[id].ownerId === playerId).length;
}

/**
 * Loyer dû sur une case possédée.
 * @param {number} spaceId
 * @param {{ diceTotal?: number, multiplier?: number }} [opts] - `multiplier` sert
 *   aux cartes « payez le double du loyer normal ».
 * @returns {number} 0 si la case est libre, hypothéquée, ou appartient au visiteur
 */
export function rentFor(state, spaceId, opts = {}) {
  const space = getSpace(spaceId);
  const prop = state.properties[spaceId];
  if (!prop || !prop.ownerId || prop.mortgaged) return 0;

  const multiplier = opts.multiplier ?? 1;

  if (space.type === 'railroad') {
    const count = railroadCount(state, prop.ownerId);
    return count === 0 ? 0 : space.rent[count - 1] * multiplier;
  }

  if (space.type === 'utility') {
    const count = utilityCount(state, prop.ownerId);
    const factor = space.rentMultipliers[count === 2 ? 1 : 0];
    return (opts.diceTotal ?? 0) * factor * multiplier;
  }

  // Terrain : loyer indexé par le niveau de construction.
  const level = buildingLevel(prop);
  if (level > 0) return space.rent[level] * multiplier;

  // Terrain nu : loyer doublé si le propriétaire tient tout le groupe.
  const doubled = ownsFullGroup(state, prop.ownerId, space.group);
  return space.rent[0] * (doubled ? 2 : 1) * multiplier;
}

/** Maisons et hôtels détenus par une joueuse (pour les cartes de réparations). */
export function buildingsOf(state, playerId) {
  let houses = 0;
  let hotels = 0;
  for (const prop of propertiesOf(state, playerId)) {
    if (prop.hotel) hotels += 1;
    else houses += prop.houses;
  }
  return { houses, hotels };
}

/**
 * Peut-on construire une maison (ou un hôtel) sur cette case ?
 * @returns {{ ok: boolean, reason?: string, cost?: number, isHotel?: boolean }}
 */
export function canBuild(state, playerId, spaceId) {
  const space = getSpace(spaceId);
  const prop = state.properties[spaceId];
  if (!prop || space.type !== 'property') return { ok: false, reason: 'Cette case ne se construit pas.' };
  if (prop.ownerId !== playerId) return { ok: false, reason: "Cette propriété n'est pas à vous." };
  if (!ownsFullGroup(state, playerId, space.group))
    return { ok: false, reason: 'Il faut posséder tout le groupe de couleur.' };
  if (!groupIsClear(state, space.group))
    return { ok: false, reason: 'Un terrain du groupe est hypothéqué.' };
  if (prop.hotel) return { ok: false, reason: 'Cette propriété a déjà un hôtel.' };

  const isHotel = prop.houses === 4;
  if (isHotel && state.bank.hotels < 1)
    return { ok: false, reason: "Il n'y a plus d'hôtel disponible à la banque." };
  if (!isHotel && state.bank.houses < 1)
    return { ok: false, reason: "Il n'y a plus de maison disponible à la banque." };

  // Répartition égale : on ne construit que sur le terrain le moins bâti du groupe.
  const levels = getGroup(space.group).spaces.map((id) => buildingLevel(state.properties[id]));
  if (buildingLevel(prop) > Math.min(...levels))
    return { ok: false, reason: 'La construction doit être répartie également sur le groupe.' };

  const cost = space.houseCost;
  const player = playerById(state, playerId);
  if (player.cash < cost) return { ok: false, reason: 'Fonds insuffisants.' };

  return { ok: true, cost, isHotel };
}

/**
 * Peut-on revendre une construction sur cette case ?
 * @returns {{ ok: boolean, reason?: string, refund?: number, fromHotel?: boolean, razeHotel?: boolean }}
 */
export function canSellBuilding(state, playerId, spaceId) {
  const space = getSpace(spaceId);
  const prop = state.properties[spaceId];
  if (!prop || space.type !== 'property') return { ok: false, reason: 'Cette case ne se construit pas.' };
  if (prop.ownerId !== playerId) return { ok: false, reason: "Cette propriété n'est pas à vous." };
  if (buildingLevel(prop) === 0) return { ok: false, reason: 'Aucune construction à revendre.' };

  const levels = getGroup(space.group).spaces.map((id) => buildingLevel(state.properties[id]));
  if (buildingLevel(prop) < Math.max(...levels))
    return { ok: false, reason: 'La revente doit être répartie également sur le groupe.' };

  const half = space.houseCost / 2;
  if (prop.hotel) {
    // L'hôtel redevient 4 maisons ; si la banque n'en a pas assez, il est rasé
    // d'un coup et remboursé intégralement (évite de bloquer une joueuse endettée).
    const razeHotel = state.bank.houses < 4;
    return { ok: true, fromHotel: true, razeHotel, refund: razeHotel ? half * 5 : half };
  }
  return { ok: true, refund: half };
}

/** Coût pour lever une hypothèque : montant + 10 % d'intérêt, arrondi au supérieur. */
export function unmortgageCost(state, spaceId) {
  return Math.ceil(getSpace(spaceId).mortgage * (1 + rules.mortgageInterestRate));
}

/**
 * Somme maximale qu'une joueuse peut réunir : liquide + hypothèques possibles +
 * revente de toutes ses constructions. Sert à savoir si une dette est payable
 * ou si la faillite est inévitable.
 */
export function maxRaisable(state, playerId) {
  const player = playerById(state, playerId);
  let total = player.cash;
  for (const prop of propertiesOf(state, playerId)) {
    const space = getSpace(prop.spaceId);
    const level = buildingLevel(prop);
    if (level > 0) total += level * (space.houseCost / 2);
    if (!prop.mortgaged) total += space.mortgage;
  }
  return total;
}

/** Valeur du patrimoine (pour le classement de fin de partie). */
export function netWorth(state, playerId) {
  const player = playerById(state, playerId);
  let total = player.cash;
  for (const prop of propertiesOf(state, playerId)) {
    const space = getSpace(prop.spaceId);
    total += prop.mortgaged ? space.mortgage : space.price;
    // Les gares et compagnies n'ont pas de coût de maison : sans ce garde-fou,
    // `0 * undefined` donnait NaN et emportait tout le patrimoine avec lui.
    total += buildingLevel(prop) * (space.houseCost ?? 0);
  }
  return total;
}

/** Toutes les cases achetables encore libres. */
export function unownedSpaces(state) {
  return board.filter((s) => state.properties[s.id]?.ownerId == null && state.properties[s.id]);
}
