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

/** Avance de `steps` cases, en encaissant le salaire si on passe par Départ. */
export function advance(state, playerId, steps) {
  const player = playerById(state, playerId);
  const size = boardOf(state).length;
  const raw = player.position + steps;
  queuePassedSpaces(state, player.position, steps);
  player.position = ((raw % size) + size) % size;
  if (steps > 0 && raw >= size) collectSalary(state, playerId);
  return player.position;
}

/** Va directement sur une case, en avançant (donc en franchissant Départ si besoin). */
export function moveTo(state, playerId, target, collectGoSalary = true) {
  const player = playerById(state, playerId);
  const size = boardOf(state).length;
  const steps = (((target - player.position) % size) + size) % size;
  const passes = steps > 0 && player.position + steps >= size;
  queuePassedSpaces(state, player.position, steps);
  player.position = target;
  if (passes && collectGoSalary) collectSalary(state, playerId);
  return target;
}

function collectSalary(state, playerId) {
  credit(state, playerId, config(state).currency.goBonus, say(state, 'reasonGo'));
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
 * @param {'normal'|'super'} tier - une extension (Prison Hasbro) peut définir
 *   `jail.superSpace`/`jail.superBail`/`jail.superDeck` pour une geôle plus
 *   sévère ; sans ça, `tier` n'a aucun effet et tout retombe sur `jail.space`.
 */
export function sendToJail(state, playerId, tier = 'normal') {
  const player = playerById(state, playerId);
  const jail = config(state).jail;
  player.position = (tier === 'super' && jail.superSpace != null) ? jail.superSpace : jail.space;
  player.inJail = true;
  player.jailTier = tier;
  player.jailTurns = 0;
  state.dice.extraRoll = false;
  state.dice.doublesCount = 0;
  log(state, 'jail', say(state, 'toJail', { name: player.name }), { playerId });
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

    // Geôle plus sévère qu'une extension peut ajouter en plus de `go_to_jail`
    // (case et paquet distincts, caution plus haute) : générique, jamais lié à
    // un nom d'extension — juste un second niveau de sévérité.
    case 'super_jail':
      sendToJail(state, playerId, 'super');
      return;

    case 'free_parking':
      if (state.settings.freeParkingPot && state.freeParkingPot > 0) {
        const pot = state.freeParkingPot;
        state.freeParkingPot = 0;
        credit(state, playerId, pot, say(state, 'reasonParking'));
      }
      return;

    case 'go':
    case 'jail':
      return; // Départ (salaire déjà versé) et simple visite : rien à faire.

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
  if (prop.ownerId === player.id) return;

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

  const owner = playerById(state, prop.ownerId);
  const rent = rentFor(state, space.id, {
    diceTotal: ctx.diceTotal ?? 0,
    multiplier: ctx.rentMultiplier ?? 1,
    utilityFactor: ctx.utilityFactor,
  });
  if (rent <= 0) return;

  log(state, 'rent', say(state, 'rentDue', { name: player.name, amount: amountText(state, rent), owner: owner.name, space: space.name }), {
    playerId: player.id,
    creditorId: owner.id,
    spaceId: space.id,
    amount: rent,
  });
  // Un loyer se règle, se négocie, ou mène à la faillite : jamais un prélèvement d'office.
  charge(state, player.id, rent, say(state, 'reasonRent', { space: space.name }), owner.id, { negotiable: true });
}
