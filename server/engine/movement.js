/**
 * Déplacements et résolution de la case d'arrivée.
 *
 * `resolveLanding` est le point d'entrée unique : quel que soit le chemin
 * emprunté (dés, carte, sortie de prison), on retombe toujours ici, donc une
 * règle de case n'est écrite qu'une seule fois.
 */
import { getSpace, boardOf } from '../../shared/index.js';
import { log, euros } from './log.js';
import { playerById, rentFor, config } from './queries.js';
import { credit, charge } from './money.js';

/** Avance de `steps` cases, en encaissant le salaire si on passe par Départ. */
export function advance(state, playerId, steps) {
  const player = playerById(state, playerId);
  const size = boardOf(state).length;
  const raw = player.position + steps;
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
  player.position = target;
  if (passes && collectGoSalary) collectSalary(state, playerId);
  return target;
}

function collectSalary(state, playerId) {
  credit(state, playerId, config(state).currency.goBonus, 'passage par la case Départ');
}

/** Envoie en prison : pas de salaire, pas de tour supplémentaire. */
export function sendToJail(state, playerId) {
  const player = playerById(state, playerId);
  player.position = config(state).jail.space;
  player.inJail = true;
  player.jailTurns = 0;
  state.dice.extraRoll = false;
  state.dice.doublesCount = 0;
  log(state, 'jail', `${player.name} va en prison.`, { playerId });
}

/**
 * Applique l'effet de la case sur laquelle la joueuse vient d'arriver.
 * @param {{ diceTotal?: number, rentMultiplier?: number, utilityFactor?: number }} [ctx]
 */
export function resolveLanding(state, playerId, ctx = {}) {
  const player = playerById(state, playerId);
  const space = getSpace(state, player.position);
  log(state, 'land', `${player.name} arrive sur ${space.name}.`, { playerId, spaceId: space.id });

  switch (space.type) {
    case 'property':
    case 'railroad':
    case 'utility':
      return resolveOwnable(state, player, space, ctx);

    case 'tax':
      charge(state, playerId, space.amount, space.name.toLowerCase());
      return;

    case 'go_to_jail':
      sendToJail(state, playerId);
      return;

    case 'chance':
    case 'community_chest':
      // On ne pioche pas à la place de la joueuse : elle doit tirer la carte
      // elle-même, comme on prend une carte sur le tas.
      state.pending = {
        kind: 'draw_card',
        playerIds: [playerId],
        payload: { deck: space.type, diceTotal: ctx.diceTotal ?? 0 },
      };
      return;

    case 'free_parking':
      if (state.settings.freeParkingPot && state.freeParkingPot > 0) {
        const pot = state.freeParkingPot;
        state.freeParkingPot = 0;
        credit(state, playerId, pot, 'cagnotte du Parc Gratuit');
      }
      return;

    case 'go':
    case 'jail':
    default:
      return; // Départ (salaire déjà versé) et simple visite : rien à faire.
  }
}

function resolveOwnable(state, player, space, ctx) {
  const prop = state.properties[space.id];

  // Libre : achat ou enchère.
  if (!prop.ownerId) {
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
  if (prop.mortgaged) {
    log(state, 'rent', `${space.name} est hypothéquée : aucun loyer n'est dû.`, {
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

  log(state, 'rent', `${player.name} doit ${euros(rent)} de loyer à ${owner.name} pour ${space.name}.`, {
    playerId: player.id,
    creditorId: owner.id,
    spaceId: space.id,
    amount: rent,
  });
  // Un loyer se règle, se négocie, ou mène à la faillite : jamais un prélèvement d'office.
  charge(state, player.id, rent, `loyer de ${space.name}`, owner.id, { negotiable: true });
}
