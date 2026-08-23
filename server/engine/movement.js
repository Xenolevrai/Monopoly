/**
 * Déplacements et résolution de la case d'arrivée.
 *
 * `resolveLanding` est le point d'entrée unique : quel que soit le chemin
 * emprunté (dés, carte, sortie de prison), on retombe toujours ici, donc une
 * règle de case n'est écrite qu'une seule fois.
 */
import { getSpace, boardOf, isOwnable } from '../../shared/index.js';
import { log, say, amountText } from './log.js';
import { playerById, rentFor, config } from './queries.js';
import { credit, charge } from './money.js';
import { resolveHazardOnLanding } from './hazard.js';
import { drawBonusCard, drawCorruptionCard, broadcastAction } from './cards.js';

/**
 * Les cases achetables encore libres franchies sans s'y arrêter.
 *
 * Une édition/extension peut décréter (`mechanics.auctionOnPass`) qu'on ne
 * laisse rien derrière soi : tout ce qu'on dépasse part aux enchères. On les
 * empile dans la file d'enchères déjà utilisée pour les faillites — le flux
 * existant les traitera une par une en fin de tour.
 */
function queuePassedSpaces(state, from, steps) {
  if (!config(state).mechanics?.auctionOnPass || steps <= 0) return;
  const size = boardOf(state).length;
  // On s'arrête à `steps - 1` : la case d'arrivée n'est pas « dépassée », elle
  // se résout normalement (achat ou enchère par refus).
  for (let step = 1; step < steps; step++) {
    const id = (from + step) % size;
    if (isOwnable(state, id) && !state.properties[id]?.ownerId && !state.auctionQueue.includes(id)) {
      state.auctionQueue.push(id);
    }
  }
}

/** Vérifie si le déplacement fait franchir la case Prison (position 10). */
function checkPassedJail(state, playerId, from, steps) {
  if (!config(state).mechanics?.jailPassBonus || steps <= 0) return;
  const size = boardOf(state).length;
  for (let step = 1; step <= steps; step++) {
    const id = (from + step) % size;
    if (id === 10) {
      drawCorruptionCard(state, playerId);
      break;
    }
  }
}

/** La prochaine case d'un type donné en avançant, ou null. */
export function nextSpaceOfType(state, from, type) {
  const board = boardOf(state);
  for (let step = 1; step <= board.length; step++) {
    const id = (from + step) % board.length;
    if (board[id].type === type) return id;
  }
  return null;
}

/** Avance de `steps` cases, en encaissant le salaire si on passe par Départ. */
export function advance(state, playerId, steps) {
  const player = playerById(state, playerId);
  const size = boardOf(state).length;
  const raw = player.position + steps;
  queuePassedSpaces(state, player.position, steps);
  checkPassedJail(state, playerId, player.position, steps);
  player.position = ((raw % size) + size) % size;
  if (steps > 0 && raw >= size) collectSalary(state, playerId, player.position === 0);
  return player.position;
}

/** Va directement sur une case, en avançant (donc en franchissant Départ si besoin). */
export function moveTo(state, playerId, target, collectGoSalary = true) {
  const player = playerById(state, playerId);
  const size = boardOf(state).length;
  const steps = (((target - player.position) % size) + size) % size;
  const passes = steps > 0 && player.position + steps >= size;
  queuePassedSpaces(state, player.position, steps);
  checkPassedJail(state, playerId, player.position, steps);
  player.position = target;
  if (passes && collectGoSalary) collectSalary(state, playerId, target === 0);
  return target;
}

/**
 * Verse le salaire de Départ. `landedOnGo` distingue « tombée pile dessus » de
 * « simplement passée devant » — seule la première profite de la règle maison
 * `doubleGoLanding`, quel que soit le moyen d'y arriver (dés, carte, raccourci) :
 * la case ne sait pas comment on l'a atteinte, seulement qu'on s'y arrête.
 */
function collectSalary(state, playerId, landedOnGo = false) {
  const bonus = config(state).currency.goBonus;
  const doubled = landedOnGo && state.settings.doubleGoLanding;
  credit(state, playerId, doubled ? bonus * 2 : bonus, say(state, doubled ? 'reasonGoDouble' : 'reasonGo'));
  grantLapWaivers(state, playerId);
}

/** Le camp d'une joueuse, si l'édition en propose. */
export function factionOf(state, player) {
  if (!player?.faction) return null;
  return config(state).factions?.options?.find((f) => f.id === player.faction) ?? null;
}

/**
 * Certains camps épargnent un loyer à chaque tour de plateau
 * (`rentWaiverPerLap`). On crédite le compteur au passage de la case Départ —
 * et une fois au lancement de la partie, pour que le premier tour compte.
 */
export function grantLapWaivers(state, playerId = null) {
  const targets = playerId ? [playerById(state, playerId)] : state.players;
  for (const player of targets) {
    const perLap = factionOf(state, player)?.rentWaiverPerLap ?? 0;
    if (perLap > 0) player.rentWaivers = (player.rentWaivers ?? 0) + perLap;
  }
}

/**
 * La case « chez soi » d'une joueuse, si l'édition en déclare une : la salle
 * commune de sa maison de Poudlard. `null` partout ailleurs.
 */
function homeSpaceOf(state, player) {
  if (!player.faction) return null;
  const faction = config(state).factions?.options?.find((f) => f.id === player.faction);
  return faction?.homeSpace ?? null;
}

/**
 * Envoie en prison : pas de salaire, pas de tour supplémentaire.
 * @param {'normal'|'super'} tier
 * @param {string|null} senderId - qui l'y a envoyée (pour Super Prison)
 */
export function sendToJail(state, playerId, tier = 'normal', senderId = null) {
  const player = playerById(state, playerId);
  const jail = config(state).jail;
  if (tier === 'super') {
    player.position = (jail.superSpace != null) ? jail.superSpace : 30;
    player.inJail = true;
    player.superJail = true;
    player.superJailSenderId = senderId;
    player.superJailTurns = 0;
    player.superJailCollectedCards = [];
    log(state, 'jail', say(state, 'sentToSuperJail', { name: player.name, by: playerById(state, senderId)?.name ?? 'Police' }), { playerId, senderId });
  } else {
    player.position = jail.space ?? 10;
    player.inJail = true;
    player.superJail = false;
    player.jailTurns = 0;
    log(state, 'jail', say(state, 'toJail', { name: player.name }), { playerId });
    if (config(state).mechanics?.corruptionCards) {
      drawCorruptionCard(state, playerId);
    }
  }
  player.jailTier = tier;
  state.dice.extraRoll = false;
  state.dice.doublesCount = 0;
  if (state.dealMobileOwnerId === playerId) {
    state.dealMobileOwnerId = null;
  }

  broadcastAction(state, {
    type: 'sent_to_jail',
    targetId: playerId,
    targetName: player.name,
    targetColor: player.color,
    targetToken: player.token,
    senderId,
    senderName: senderId ? playerById(state, senderId)?.name : null,
    tier,
  });
}

/**
 * Applique l'effet de la case sur laquelle la joueuse vient d'arriver.
 * @param {{ diceTotal?: number, rentMultiplier?: number, utilityFactor?: number }} [ctx]
 */
export function resolveLanding(state, playerId, ctx = {}) {
  const player = playerById(state, playerId);
  const space = getSpace(state, player.position);
  log(state, 'land', say(state, 'lands', { name: player.name, space: space.name }), { playerId, spaceId: space.id });

  switch (space.type) {
    // `landmark` est un titre posé sur une case qui n'en portait pas (Départ,
    // Prison, Parc Gratuit) : il s'achète et rapporte un loyer fixe, mais ne se
    // construit pas — d'où la même résolution que les autres cases achetables.
    case 'property':
    case 'railroad':
    case 'utility':
    case 'landmark':
      return resolveOwnable(state, player, space, ctx);

    case 'tax':
      charge(state, playerId, space.amount, space.name.toLowerCase());
      return;

    case 'go_to_jail':
      sendToJail(state, playerId);
      return;

    case 'super_jail':
      // Seul un autre joueur peut vous envoyer en Super Prison. Si on y atterrit normalement, simple visite.
      return;

    case 'escape_die':
      state.pending = {
        kind: 'roll_escape_die',
        playerIds: [playerId],
        payload: { spaceId: space.id },
      };
      return;

    case 'heist_die':
      state.pending = {
        kind: 'roll_heist_die',
        playerIds: [playerId],
        payload: { spaceId: space.id },
      };
      return;


    case 'free_parking':
      if ((state.settings?.freeParkingPot || config(state).mechanics?.jackpotPot) && state.freeParkingPot > 0) {
        const pot = state.freeParkingPot;
        state.freeParkingPot = 0;
        credit(state, playerId, pot, say(state, 'reasonParking'));
      }
      if (config(state).mechanics?.dealMobile) {
        state.dealMobileOwnerId = playerId;
        log(state, 'card', say(state, 'takesDealMobile', { name: player.name }), { playerId });
      }
      if (config(state).mechanics?.bonusCardsDeck) {
        drawBonusCard(state, playerId);
      }
      return;

    case 'spin':
      state.pending = {
        kind: 'spin_spinner',
        playerIds: [playerId],
        payload: { spaceId: space.id, diceTotal: ctx.diceTotal ?? 0 },
      };
      return;

    case 'go':
    case 'jail':
      return; // Départ (salaire déjà versé) et simple visite : rien à faire.

    // Raccourci : on peut se balancer jusqu'au prochain raccourci du plateau.
    // Le prix est celui de l'édition, gratuit pour un camp qui l'annonce.
    case 'warp': {
      const warp = config(state).mechanics?.warpSpaces;
      const target = nextSpaceOfType(state, player.position, 'warp');
      if (!warp || target == null) return;
      const cost = factionOf(state, player)?.freeWarp ? 0 : (warp.cost ?? 0);
      if (player.cash < cost) return; // pas les moyens : on reste, sans invite
      state.pending = {
        kind: 'card_choice',
        playerIds: [playerId],
        payload: {
          options: [
            { index: 0, label: say(state, 'warpGo', { space: getSpace(state, target).name, amount: amountText(state, cost) }) },
            { index: 1, label: say(state, 'warpStay') },
          ],
          actions: [{ type: 'warp', target, cost }, { type: 'collect', amount: 0 }],
        },
      };
      return;
    }

    default:
      // Toute case dont le type nomme un paquet de cartes existant (chance,
      // community_chest, mais aussi les paquets ajoutés par une extension —
      // spin, évasion, casse…) déclenche un tirage. On ne pioche pas à la
      // place de la joueuse : elle doit tirer la carte elle-même.
      if (state.decks?.[space.type]) {
        state.pending = {
          kind: 'draw_card',
          playerIds: [playerId],
          payload: { deck: space.type, diceTotal: ctx.diceTotal ?? 0 },
        };
      }
      return;
  }
}

function resolveOwnable(state, player, space, ctx) {
  const prop = state.properties[space.id];
  const home = homeSpaceOf(state, player);

  // Une case piégée coûte une pénalité à qui s'y arrête et ne rapporte aucun
  // loyer à sa propriétaire pour cette visite. Elle reste **achetable** : la
  // règle de la boîte verrouille le loyer du propriétaire, pas la capture.
  // (Le bloquer aussi à l'achat asséchait la partie — les pièges s'accumulaient
  // plus vite que les captures et la victoire « tout capturé » ne tombait
  // jamais. Mesuré, puis corrigé.)
  const wasHazarded = resolveHazardOnLanding(state, player.id, space.id);
  // La pénalité peut avoir ouvert une dette : on ne pose surtout pas d'invite
  // d'achat par-dessus, elle écraserait le règlement en cours.
  if (wasHazarded && state.debt) return;

  // Libre : achat ou enchère. Sauf le fief de sa propre maison — sa salle
  // commune —, qu'on explore gratuitement en y arrivant : on est chez soi.
  if (!prop.ownerId) {
    if (home === space.id) {
      prop.ownerId = player.id;
      log(state, 'buy', say(state, 'homeFree', { name: player.name, space: space.name }), {
        playerId: player.id,
        spaceId: space.id,
        amount: 0,
      });
      return;
    }
    if (state.dealMobileOwnerId === player.id) {
      prop.ownerId = player.id;
      log(state, 'buy', say(state, 'dealMobileClaim', { name: player.name, space: space.name }), {
        playerId: player.id,
        spaceId: space.id,
        amount: 0,
      });
      return;
    }
    state.pending = {
      kind: 'buy_or_auction',
      playerIds: [player.id],
      payload: {
        spaceId: space.id,
        price: space.price,
        canAfford: player.cash >= space.price,
      },
    };
    return;
  }

  // À soi, ou hypothéquée : rien à payer.
  if (prop.ownerId === player.id) {
    if (config(state).mechanics?.spinOnOwn) {
      state.pending = {
        kind: 'spin_spinner',
        playerIds: [player.id],
        payload: { spaceId: space.id, reason: 'own_property' },
      };
    }
    return;
  }

  // Le piège vient d'être encaissé : le loyer saute pour cette visite.
  if (wasHazarded) {
    log(state, 'rent', say(state, 'rentBlocked', { space: space.name }), {
      playerId: player.id,
      spaceId: space.id,
    });
    return;
  }

  // Chez soi, même si quelqu'un d'autre y est passé avant : aucun droit à payer.
  if (home === space.id) {
    log(state, 'rent', say(state, 'rentHome', { space: space.name, name: player.name }), {
      playerId: player.id,
      spaceId: space.id,
    });
    return;
  }
  if (prop.mortgaged) {
    log(state, 'rent', say(state, 'rentMortgaged', { space: space.name }), {
      playerId: player.id,
      spaceId: space.id,
    });
    return;
  }

  if ((player.rentWaivers ?? 0) > 0) {
    player.rentWaivers -= 1;
    log(state, 'rent', say(state, 'rentWaived', { name: player.name, space: space.name }), {
      playerId: player.id,
      spaceId: space.id,
    });
    return;
  }

  const owner = playerById(state, prop.ownerId);
  const rent = rentFor(state, space.id, {
    diceTotal: ctx.diceTotal ?? 0,
    multiplier: ctx.rentMultiplier ?? 1,
    utilityFactor: ctx.utilityFactor,
  });
  if (rent <= 0) return;

  if (state.dealMobileOwnerId === player.id) {
    log(state, 'rent', say(state, 'dealMobileNoRent', { name: player.name, space: space.name }), {
      playerId: player.id,
      spaceId: space.id,
    });
    if (config(state).mechanics?.rentChoiceChip) {
      state.pending = {
        kind: 'choose_rent_or_chip',
        playerIds: [owner.id],
        payload: { tenantId: player.id, spaceId: space.id, rent: 0, dealMobile: true },
      };
    }
    return;
  }

  if (config(state).mechanics?.rentChoiceChip) {
    state.pending = {
      kind: 'choose_rent_or_chip',
      playerIds: [owner.id],
      payload: { tenantId: player.id, spaceId: space.id, rent, dealMobile: false },
    };
    return;
  }

  log(state, 'rent', say(state, 'rentDue', { name: player.name, amount: amountText(state, rent), owner: owner.name, space: space.name }), {
    playerId: player.id,
    creditorId: owner.id,
    spaceId: space.id,
    amount: rent,
  });
  // Un loyer se règle, se négocie, ou mène à la faillite : jamais un prélèvement d'office.
  charge(state, player.id, rent, say(state, 'reasonRent', { space: space.name }), owner.id, { negotiable: true });
}
