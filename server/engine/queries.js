/**
 * Lectures dérivées de l'état. Aucune fonction ici ne modifie quoi que ce soit :
 * tout ce qui peut se recalculer (loyer, groupe complet, valeur du patrimoine)
 * est calculé, jamais stocké — c'est ce qui évite les incohérences.
 */
import { getSpace, getGroup, boardOf, rulesOf } from '../../shared/index.js';

/** Les règles chiffrées de l'édition en cours. */
export const config = (state) => rulesOf(state);

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
  const group = getGroup(state, groupId);
  if (!group) return false;
  return group.spaces.every((id) => state.properties[id].ownerId === playerId);
}

/** Vrai si aucune case du groupe n'est hypothéquée. */
export function groupIsClear(state, groupId) {
  return getGroup(state, groupId).spaces.every((id) => !state.properties[id].mortgaged);
}

/** Cases d'un groupe détenues par une joueuse. */
export function ownedInGroup(state, playerId, groupId) {
  return (getGroup(state, groupId)?.spaces ?? []).filter((id) => state.properties[id]?.ownerId === playerId);
}

/**
 * Le seuil à partir duquel on peut bâtir sur un groupe.
 *
 * Par défaut, il faut le groupe entier. Une édition peut déclarer
 * `mechanics.majorityBuildRule` : la majorité suffit alors, calculée sur le
 * **nombre réel de cases du groupe** — deux sur trois, trois sur quatre —, ce
 * qui vaut aussi bien pour un plateau à 40 cases que pour un plateau agrandi.
 */
export function buildThreshold(state, groupId) {
  const size = getGroup(state, groupId)?.spaces.length ?? 0;
  return config(state).mechanics?.majorityBuildRule ? Math.floor(size / 2) + 1 : size;
}

/** Vrai si la joueuse tient assez du groupe pour y bâtir. */
export function ownsBuildMajority(state, playerId, groupId) {
  const size = getGroup(state, groupId)?.spaces.length ?? 0;
  if (!size) return false;
  return ownedInGroup(state, playerId, groupId).length >= buildThreshold(state, groupId);
}

/** Vrai si un gratte-ciel se dresse déjà sur ce groupe, chez cette joueuse. */
export function groupHasSkyscraper(state, playerId, groupId) {
  return ownedInGroup(state, playerId, groupId).some((id) => state.properties[id].skyscraper);
}

/**
 * Ce que coûte une construction à cette joueuse. Un camp peut annoncer un
 * `buildCostFactor` (pouvoir de héros) : le moteur applique le facteur sans
 * savoir de quel camp il s'agit.
 */
export function buildCostFor(state, player, baseCost) {
  const faction = config(state).factions?.options?.find((f) => f.id === player?.faction);
  const factor = faction?.buildCostFactor ?? 1;
  return Math.floor(baseCost * factor);
}

/**
 * Niveau de construction d'une case : 0-4 maisons, 5 = hôtel, 6 = gratte-ciel.
 * Le sixième palier n'existe que dans les éditions qui déclarent
 * `mechanics.skyscrapers` ; ailleurs le champ reste faux et rien ne change.
 */
export function buildingLevel(prop) {
  if (prop.skyscraper) return 6;
  return prop.hotel ? 5 : prop.houses;
}

/** Nombre de gares possédées par une joueuse. */
export function railroadCount(state, playerId) {
  return (getGroup(state, 'railroad')?.spaces ?? []).filter((id) => state.properties[id].ownerId === playerId)
    .length;
}

/** Nombre de compagnies possédées par une joueuse. */
export function utilityCount(state, playerId) {
  return (getGroup(state, 'utility')?.spaces ?? []).filter((id) => state.properties[id].ownerId === playerId)
    .length;
}

/**
 * Loyer dû sur une case possédée.
 * @param {number} spaceId
 * @param {{ diceTotal?: number, multiplier?: number }} [opts] - `multiplier` sert
 *   aux cartes « payez le double du loyer normal ».
 * @returns {number} 0 si la case est libre, hypothéquée, ou appartient au visiteur
 */
export function rentFor(state, spaceId, opts = {}) {
  const space = getSpace(state, spaceId);
  const prop = state.properties[spaceId];
  if (!prop || !prop.ownerId || prop.mortgaged) return 0;

  const multiplier = opts.multiplier ?? 1;

  if (space.type === 'railroad') {
    const count = railroadCount(state, prop.ownerId);
    if (count === 0) return 0;
    // Un dépôt double le tarif de cette gare-là, indépendamment des autres.
    // Il se cumule avec le doublement d'une carte « la gare la plus proche » :
    // c'est bien un loyer quadruple qui est dû, comme l'annonce la règle.
    const depot = prop.depot ? (config(state).mechanics?.trainDepots?.rentFactor ?? 2) : 1;
    return space.rent[count - 1] * depot * multiplier;
  }

  if (space.type === 'utility') {
    const count = utilityCount(state, prop.ownerId);
    // Le multiplicateur suit le nombre de compagnies détenues, quel qu'en soit
    // le nombre sur le plateau : deux au classique, trois à la Mega Edition.
    // `utilityFactor` sert aux cartes « rendez-vous au service le plus proche et
    // payez dix fois le jet » : la carte impose alors son propre multiple.
    const table = space.rentMultipliers;
    const factor = opts.utilityFactor ?? table[Math.min(Math.max(count, 1), table.length) - 1];
    return (opts.diceTotal ?? 0) * factor * multiplier;
  }

  if (space.group === 'corners') {
    const corners = (getGroup(state, 'corners')?.spaces ?? []).filter((id) => state.properties[id]?.ownerId === prop.ownerId).length;
    const rentArray = space.rent ?? [50, 100, 200, 400];
    const baseRent = rentArray[Math.max(0, Math.min(corners - 1, rentArray.length - 1))] ?? 50;
    return baseRent * multiplier;
  }

  if (space.type === 'landmark') {
    return (space.rent?.[0] ?? 50) * multiplier;
  }

  // Terrain : loyer indexé par le niveau de construction. Le gratte-ciel n'a pas
  // de palier dans la table imprimée : il ajoute une prime au tarif de l'hôtel,
  // prime que le groupe déclare (`skyscraperBonus`).
  const level = buildingLevel(prop);
  if (level === 6) {
    const bonus = getGroup(state, space.group)?.skyscraperBonus ?? 0;
    return (space.rent[5] + bonus) * multiplier;
  }
  if (level > 0) return space.rent[level] * multiplier;

  // Terrain nu : le tarif de base est majoré selon ce que sa propriétaire tient
  // du groupe. Au classique, il n'y a qu'un cas — le groupe entier, doublé.
  // Une édition à règle de majorité en ajoute un second : tant que le groupe
  // n'est pas complet mais qu'un gratte-ciel s'y dresse, le terrain nu rapporte
  // le triple.
  return space.rent[0] * bareRentFactor(state, prop.ownerId, space.group) * multiplier;
}

/** Le facteur appliqué au loyer d'un terrain nu : 1, 2 ou 3. */
function bareRentFactor(state, ownerId, groupId) {
  if (groupHasSkyscraper(state, ownerId, groupId)) return 3;
  return ownsBuildMajority(state, ownerId, groupId) ? 2 : 1;
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
  const space = getSpace(state, spaceId);
  const prop = state.properties[spaceId];
  const mechanics = config(state).mechanics;

  // Un dépôt se pose sur une gare, sans condition de groupe : c'est le seul
  // aménagement qui ne suit pas la règle de répartition des maisons.
  if (space.type === 'railroad' && mechanics?.trainDepots) {
    return canBuildDepot(state, playerId, spaceId);
  }

  if (!prop || space.type !== 'property') return { ok: false, reason: 'Cette case ne se construit pas.' };
  if (prop.ownerId !== playerId) return { ok: false, reason: "Cette propriété n'est pas à vous." };
  if (!ownsBuildMajority(state, playerId, space.group)) {
    const need = buildThreshold(state, space.group);
    const size = getGroup(state, space.group).spaces.length;
    return {
      ok: false,
      reason: need < size
        ? `Il faut posséder au moins ${need} propriétés sur ${size} dans ce groupe.`
        : 'Il faut posséder tout le groupe de couleur.',
    };
  }
  if (!groupIsClear(state, space.group))
    return { ok: false, reason: 'Un terrain du groupe est hypothéqué.' };
  if (prop.skyscraper) return { ok: false, reason: 'Cette propriété est déjà au maximum.' };

  // Une édition sans hôtel (les blasons de maison) plafonne au dernier palier
  // de construction : il n'y a rien au-dessus.
  if (prop.houses === 4 && !mechanics.hotels)
    return { ok: false, reason: 'Ce lieu est au maximum.' };

  // Le gratte-ciel remplace l'hôtel, et seulement quand le groupe est **entier**
  // et coiffé d'hôtels partout : la majorité suffit à bâtir, pas à couronner.
  const isSkyscraper = prop.hotel;
  if (isSkyscraper) {
    if (!mechanics.skyscrapers) return { ok: false, reason: 'Cette propriété a déjà un hôtel.' };
    if (!ownsFullGroup(state, playerId, space.group))
      return { ok: false, reason: 'Il faut posséder tout le groupe pour bâtir un gratte-ciel.' };
    if (!getGroup(state, space.group).spaces.every((id) => buildingLevel(state.properties[id]) >= 5))
      return { ok: false, reason: 'Il faut un hôtel sur chaque propriété du groupe.' };
    if ((state.bank.skyscrapers ?? 0) < 1)
      return { ok: false, reason: "Il n'y a plus de gratte-ciel disponible à la banque." };
  }

  const isHotel = !isSkyscraper && prop.houses === 4;
  if (isHotel && state.bank.hotels < 1)
    return { ok: false, reason: "Il n'y a plus d'hôtel disponible à la banque." };
  if (!isHotel && !isSkyscraper && state.bank.houses < 1)
    return { ok: false, reason: "Il n'y a plus de maison disponible à la banque." };

  // Répartition égale : on ne construit que sur le terrain le moins bâti — parmi
  // ceux qu'on possède. À la règle de majorité, le groupe compte des terrains
  // qui ne sont pas à nous : les inclure interdirait toute construction.
  const levels = ownedInGroup(state, playerId, space.group).map((id) => buildingLevel(state.properties[id]));
  if (buildingLevel(prop) > Math.min(...levels))
    return { ok: false, reason: 'La construction doit être répartie également sur le groupe.' };

  const player = playerById(state, playerId);
  const cost = buildCostFor(state, player, space.houseCost);
  if (player.cash < cost) return { ok: false, reason: 'Fonds insuffisants.' };

  return { ok: true, cost, isHotel, isSkyscraper };
}

/**
 * Le dépôt de train : une construction posée sur une gare, qui en double le
 * loyer. Générique — le coût et le facteur viennent de `mechanics.trainDepots`.
 */
export function canBuildDepot(state, playerId, spaceId) {
  const depots = config(state).mechanics?.trainDepots;
  if (!depots) return { ok: false, reason: 'Cette édition ne connaît pas les dépôts.' };
  const prop = state.properties[spaceId];
  if (!prop || prop.ownerId !== playerId) return { ok: false, reason: "Cette gare n'est pas à vous." };
  if (prop.mortgaged) return { ok: false, reason: 'Cette gare est hypothéquée.' };
  if (prop.depot) return { ok: false, reason: 'Cette gare a déjà un dépôt.' };
  const player = playerById(state, playerId);
  const cost = buildCostFor(state, player, depots.cost ?? 100);
  if (player.cash < cost) return { ok: false, reason: 'Fonds insuffisants.' };
  return { ok: true, cost, isDepot: true };
}

/**
 * Peut-on revendre une construction sur cette case ?
 * @returns {{ ok: boolean, reason?: string, refund?: number, fromHotel?: boolean, razeHotel?: boolean }}
 */
export function canSellBuilding(state, playerId, spaceId) {
  const space = getSpace(state, spaceId);
  const prop = state.properties[spaceId];

  // Un dépôt se revend seul, comme il s'est posé seul.
  if (space.type === 'railroad' && config(state).mechanics?.trainDepots) {
    if (!prop || prop.ownerId !== playerId) return { ok: false, reason: "Cette gare n'est pas à vous." };
    if (!prop.depot) return { ok: false, reason: 'Aucun dépôt à revendre.' };
    return { ok: true, fromDepot: true, refund: (config(state).mechanics.trainDepots.cost ?? 100) / 2 };
  }

  if (!prop || space.type !== 'property') return { ok: false, reason: 'Cette case ne se construit pas.' };
  if (prop.ownerId !== playerId) return { ok: false, reason: "Cette propriété n'est pas à vous." };
  if (buildingLevel(prop) === 0) return { ok: false, reason: 'Aucune construction à revendre.' };

  const levels = ownedInGroup(state, playerId, space.group).map((id) => buildingLevel(state.properties[id]));
  if (buildingLevel(prop) < Math.max(...levels))
    return { ok: false, reason: 'La revente doit être répartie également sur le groupe.' };

  const half = space.houseCost / 2;
  // Le gratte-ciel redescend d'un cran : il redevient l'hôtel qu'il coiffait.
  if (prop.skyscraper) return { ok: true, fromSkyscraper: true, refund: half };
  if (prop.hotel) {
    // L'hôtel redevient 4 maisons ; si la banque n'en a pas assez, il est rasé
    // d'un coup et remboursé intégralement (évite de bloquer une joueuse endettée).
    const razeHotel = state.bank.houses < 4;
    return { ok: true, fromHotel: true, razeHotel, refund: razeHotel ? half * 5 : half };
  }
  return { ok: true, refund: half };
}

/**
 * Peut-on hypothéquer ce terrain ?
 *
 * Règle officielle, et le piège qu'elle évite : on n'hypothèque pas un terrain
 * d'un groupe encore bâti, **même si ce terrain-là est nu**. Sans ça on gèlerait
 * une case tout en continuant d'encaisser les loyers majorés des deux autres.
 * Le moteur et les bots lisent tous les deux cette fonction : une seule règle,
 * un seul endroit.
 */
export function canMortgage(state, playerId, spaceId) {
  if (!config(state).mechanics?.mortgage)
    return { ok: false, reason: "Cette édition ne connaît pas l'hypothèque." };
  const space = getSpace(state, spaceId);
  const prop = state.properties[spaceId];
  if (!prop || prop.ownerId !== playerId) return { ok: false, reason: "Cette propriété n'est pas à vous." };
  if (prop.mortgaged) return { ok: false, reason: 'Déjà hypothéquée.' };
  if (space.mortgage === 0 || (config(state).mechanics?.noMortgageSpecialDeeds && space.type === 'landmark')) {
    return { ok: false, reason: "Ce titre de propriété spécial ne peut pas être hypothéqué." };
  }

  // Un dépôt appartient à sa gare seule : il ne gèle pas les trois autres, mais
  // il faut le revendre avant d'hypothéquer la sienne.
  if (prop.depot) return { ok: false, reason: "Revendez d'abord le dépôt de cette gare.", built: [spaceId] };

  const groupSpaces = space.group ? getGroup(state, space.group).spaces : [spaceId];
  const built = groupSpaces.filter((id) => buildingLevel(state.properties[id]) > 0);
  if (built.length) {
    const names = built.map((id) => getSpace(state, id).name).join(', ');
    return { ok: false, reason: `Revendez d'abord les constructions du groupe (${names}).`, built };
  }
  return { ok: true, amount: space.mortgage };
}

/** Coût pour lever une hypothèque : montant + 10 % d'intérêt, arrondi au supérieur. */
export function unmortgageCost(state, spaceId) {
  return Math.ceil(getSpace(state, spaceId).mortgage * (1 + config(state).mortgage.interestRate));
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
    const space = getSpace(state, prop.spaceId);
    const level = buildingLevel(prop);
    if (level > 0) total += level * (space.houseCost / 2);
    if (prop.depot) total += (config(state).mechanics?.trainDepots?.cost ?? 100) / 2;
    if (!prop.mortgaged) total += space.mortgage;
  }
  return total;
}

/** Valeur du patrimoine (pour le classement de fin de partie). */
export function netWorth(state, playerId) {
  const player = playerById(state, playerId);
  let total = player.cash;
  for (const prop of propertiesOf(state, playerId)) {
    const space = getSpace(state, prop.spaceId);
    total += prop.mortgaged ? space.mortgage : space.price;
    // Les gares et compagnies n'ont pas de coût de maison : sans ce garde-fou,
    // `0 * undefined` donnait NaN et emportait tout le patrimoine avec lui.
    total += buildingLevel(prop) * (space.houseCost ?? 0);
    if (prop.depot) total += config(state).mechanics?.trainDepots?.cost ?? 100;
  }
  return total;
}

/** Toutes les cases achetables encore libres. */
export function unownedSpaces(state) {
  return boardOf(state).filter((s) => state.properties[s.id]?.ownerId == null && state.properties[s.id]);
}
