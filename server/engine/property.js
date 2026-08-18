/** Achat, hypothèque, construction et revente. */
import { getSpace } from '../../shared/index.js';
import { log, euros } from './log.js';
import {
  playerById,
  canBuild,
  canSellBuilding,
  unmortgageCost,
  buildingLevel,
} from './queries.js';
import { credit, refreshDebtPending } from './money.js';

/** Achat à la banque au prix affiché. */
export function buyProperty(state, playerId, spaceId, price = null) {
  const space = getSpace(spaceId);
  const prop = state.properties[spaceId];
  const player = playerById(state, playerId);
  const cost = price ?? space.price;

  if (!prop) return { ok: false, error: 'Cette case ne s\'achète pas.' };
  if (prop.ownerId) return { ok: false, error: 'Cette propriété a déjà un propriétaire.' };
  if (player.cash < cost) return { ok: false, error: 'Fonds insuffisants.' };

  player.cash -= cost;
  prop.ownerId = playerId;
  log(state, 'buy', `${player.name} achète ${space.name} pour ${euros(cost)}.`, {
    playerId,
    spaceId,
    amount: cost,
  });
  return { ok: true };
}

/** Hypothèque : encaisse la valeur, la propriété ne rapporte plus de loyer. */
export function mortgage(state, playerId, spaceId) {
  const space = getSpace(spaceId);
  const prop = state.properties[spaceId];
  if (!prop || prop.ownerId !== playerId) return { ok: false, error: "Cette propriété n'est pas à vous." };
  if (prop.mortgaged) return { ok: false, error: 'Déjà hypothéquée.' };
  if (buildingLevel(prop) > 0)
    return { ok: false, error: 'Revendez d\'abord les constructions de ce terrain.' };

  prop.mortgaged = true;
  credit(state, playerId, space.mortgage, `hypothèque de ${space.name}`);
  refreshDebtPending(state);
  return { ok: true, amount: space.mortgage };
}

/** Levée d'hypothèque : montant + 10 % d'intérêt. */
export function unmortgage(state, playerId, spaceId) {
  const space = getSpace(spaceId);
  const prop = state.properties[spaceId];
  const player = playerById(state, playerId);
  if (!prop || prop.ownerId !== playerId) return { ok: false, error: "Cette propriété n'est pas à vous." };
  if (!prop.mortgaged) return { ok: false, error: "Cette propriété n'est pas hypothéquée." };

  const cost = unmortgageCost(state, spaceId);
  if (player.cash < cost) return { ok: false, error: 'Fonds insuffisants.' };

  player.cash -= cost;
  prop.mortgaged = false;
  log(state, 'unmortgage', `${player.name} lève l'hypothèque de ${space.name} pour ${euros(cost)}.`, {
    playerId,
    spaceId,
    amount: cost,
  });
  return { ok: true, amount: cost };
}

/** Construit une maison, ou un hôtel si le terrain en a déjà quatre. */
export function buildHouse(state, playerId, spaceId) {
  const check = canBuild(state, playerId, spaceId);
  if (!check.ok) return { ok: false, error: check.reason };

  const space = getSpace(spaceId);
  const prop = state.properties[spaceId];
  const player = playerById(state, playerId);
  player.cash -= check.cost;

  if (check.isHotel) {
    prop.houses = 0;
    prop.hotel = true;
    state.bank.hotels -= 1;
    state.bank.houses += 4; // les 4 maisons retournent au stock
    log(state, 'build', `${player.name} construit un hôtel sur ${space.name} (${euros(check.cost)}).`, {
      playerId,
      spaceId,
      amount: check.cost,
    });
  } else {
    prop.houses += 1;
    state.bank.houses -= 1;
    log(
      state,
      'build',
      `${player.name} construit une maison sur ${space.name} (${euros(check.cost)}) — ${prop.houses} au total.`,
      { playerId, spaceId, amount: check.cost, houses: prop.houses },
    );
  }
  return { ok: true };
}

/** Revend une construction à la banque, à la moitié du prix d'achat. */
export function sellBuilding(state, playerId, spaceId) {
  const check = canSellBuilding(state, playerId, spaceId);
  if (!check.ok) return { ok: false, error: check.reason };

  const space = getSpace(spaceId);
  const prop = state.properties[spaceId];

  if (check.fromHotel) {
    prop.hotel = false;
    state.bank.hotels += 1;
    if (check.razeHotel) {
      prop.houses = 0;
      log(
        state,
        'sell',
        `${player(state, playerId)} revend l'hôtel de ${space.name} pour ${euros(check.refund)} (la banque n'a plus de maisons).`,
        { playerId, spaceId, amount: check.refund },
      );
    } else {
      prop.houses = 4;
      state.bank.houses -= 4;
      log(state, 'sell', `${player(state, playerId)} revend l'hôtel de ${space.name} pour ${euros(check.refund)} — 4 maisons restent.`, {
        playerId,
        spaceId,
        amount: check.refund,
      });
    }
  } else {
    prop.houses -= 1;
    state.bank.houses += 1;
    log(state, 'sell', `${player(state, playerId)} revend une maison de ${space.name} pour ${euros(check.refund)}.`, {
      playerId,
      spaceId,
      amount: check.refund,
    });
  }

  playerById(state, playerId).cash += check.refund;
  refreshDebtPending(state);
  return { ok: true, refund: check.refund };
}

function player(state, playerId) {
  return playerById(state, playerId).name;
}
