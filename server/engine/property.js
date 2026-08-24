/** Achat, hypothèque, construction et revente. */
import { getSpace, rulesOf } from '../../shared/index.js';
import { log, say, amountText } from './log.js';
import { broadcastAction } from './cards.js';
import {
  playerById,
  canBuild,
  canSellBuilding,
  canMortgage,
  unmortgageCost,
} from './queries.js';
import { credit, refreshDebtPending } from './money.js';

/** Les libellés de construction de l'édition : maisons, chaumières, blasons… */
function labels(state) {
  return (
    {
      house: 'Maison', houses: 'Maisons', hotel: 'Hôtel', hotels: 'Hôtels',
      skyscraper: 'Gratte-ciel', skyscrapers: 'Gratte-ciels', depot: 'Dépôt', depots: 'Dépôts',
      ...(rulesOf(state).buildingLabels ?? {}),
    }
  );
}

/** Achat à la banque au prix affiché. */
export function buyProperty(state, playerId, spaceId, price = null) {
  const space = getSpace(state, spaceId);
  const prop = state.properties[spaceId];
  const player = playerById(state, playerId);
  const cost = price ?? space.price;

  if (!prop) return { ok: false, error: 'Cette case ne s\'achète pas.' };
  if (prop.ownerId) return { ok: false, error: 'Cette propriété a déjà un propriétaire.' };
  if (player.cash < cost) return { ok: false, error: 'Fonds insuffisants.' };

  player.cash -= cost;
  prop.ownerId = playerId;
  log(state, 'buy', say(state, rulesOf(state).mechanics.explorationMode ? 'explores' : 'buys', { name: player.name, space: space.name, amount: amountText(state, cost) }), {
    playerId,
    spaceId,
    amount: cost,
  });

  broadcastAction(state, {
    type: 'property_bought',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    spaceId: space.id,
    spaceName: space.name,
    group: space.group,
    price: cost,
    isSpecial: space.type === 'landmark' || space.group === 'corners' || space.group === 'special_taxes',
  });

  return { ok: true };
}

/** Hypothèque : encaisse la valeur, la propriété ne rapporte plus de loyer. */
export function mortgage(state, playerId, spaceId) {
  const check = canMortgage(state, playerId, spaceId);
  if (!check.ok) return { ok: false, error: check.reason };
  const space = getSpace(state, spaceId);
  const prop = state.properties[spaceId];

  prop.mortgaged = true;
  credit(state, playerId, space.mortgage, `hypothèque de ${space.name}`);
  refreshDebtPending(state);
  return { ok: true, amount: space.mortgage };
}

/** Levée d'hypothèque : montant + 10 % d'intérêt. */
export function unmortgage(state, playerId, spaceId) {
  if (!rulesOf(state).mechanics.mortgage)
    return { ok: false, error: "Cette édition ne connaît pas l'hypothèque." };
  const space = getSpace(state, spaceId);
  const prop = state.properties[spaceId];
  const player = playerById(state, playerId);
  if (!prop || prop.ownerId !== playerId) return { ok: false, error: "Cette propriété n'est pas à vous." };
  if (!prop.mortgaged) return { ok: false, error: "Cette propriété n'est pas hypothéquée." };

  const cost = unmortgageCost(state, spaceId);
  if (player.cash < cost) return { ok: false, error: 'Fonds insuffisants.' };

  player.cash -= cost;
  prop.mortgaged = false;
  log(state, 'unmortgage', say(state, 'unmortgages', { name: player.name, space: space.name, amount: amountText(state, cost) }), {
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

  const space = getSpace(state, spaceId);
  const prop = state.properties[spaceId];
  const player = playerById(state, playerId);
  player.cash -= check.cost;

  if (check.isDepot) {
    prop.depot = true;
    log(state, 'build', say(state, 'buildsDepot', { name: player.name, space: space.name, amount: amountText(state, check.cost) }), {
      playerId,
      spaceId,
      amount: check.cost,
    });
  } else if (check.isSkyscraper) {
    // Le gratte-ciel prend la place de l'hôtel, qui retourne au stock.
    prop.hotel = false;
    prop.skyscraper = true;
    state.bank.hotels += 1;
    state.bank.skyscrapers = (state.bank.skyscrapers ?? 0) - 1;
    log(state, 'build', say(state, 'buildsTop', { name: player.name, label: labels(state).skyscraper.toLowerCase(), space: space.name, amount: amountText(state, check.cost) }), {
      playerId,
      spaceId,
      amount: check.cost,
    });
  } else if (check.isHotel) {
    prop.houses = 0;
    prop.hotel = true;
    state.bank.hotels -= 1;
    state.bank.houses += 4; // les 4 maisons retournent au stock
    log(state, 'build', say(state, 'buildsTop', { name: player.name, label: labels(state).hotel.toLowerCase(), space: space.name, amount: amountText(state, check.cost) }), {
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
      say(state, 'builds', { name: player.name, label: labels(state).house.toLowerCase(), space: space.name, amount: amountText(state, check.cost), count: prop.houses }),
      { playerId, spaceId, amount: check.cost, houses: prop.houses },
    );
  }
  return { ok: true };
}

/** Revend une construction à la banque, à la moitié du prix d'achat. */
export function sellBuilding(state, playerId, spaceId) {
  const check = canSellBuilding(state, playerId, spaceId);
  if (!check.ok) return { ok: false, error: check.reason };

  const space = getSpace(state, spaceId);
  const prop = state.properties[spaceId];

  if (check.fromDepot) {
    prop.depot = false;
    log(state, 'sell', say(state, 'sellsDepot', { name: player(state, playerId), space: space.name, amount: amountText(state, check.refund) }), {
      playerId,
      spaceId,
      amount: check.refund,
    });
  } else if (check.fromSkyscraper) {
    // Le gratte-ciel redescend au palier d'en dessous : l'hôtel qu'il coiffait.
    // Si la banque n'en a plus, la propriété retombe à quatre maisons.
    prop.skyscraper = false;
    state.bank.skyscrapers = (state.bank.skyscrapers ?? 0) + 1;
    if (state.bank.hotels > 0) {
      prop.hotel = true;
      state.bank.hotels -= 1;
    } else if (state.bank.houses >= 4) {
      prop.houses = 4;
      state.bank.houses -= 4;
    }
    log(state, 'sell', say(state, 'sellsTop', { name: player(state, playerId), label: labels(state).skyscraper.toLowerCase(), space: space.name, amount: amountText(state, check.refund) }), {
      playerId,
      spaceId,
      amount: check.refund,
    });
  } else if (check.fromHotel) {
    prop.hotel = false;
    state.bank.hotels += 1;
    if (check.razeHotel) {
      prop.houses = 0;
      log(
        state,
        'sell',
        say(state, 'sellsTopRazed', { name: player(state, playerId), label: labels(state).hotel.toLowerCase(), space: space.name, amount: amountText(state, check.refund) }),
        { playerId, spaceId, amount: check.refund },
      );
    } else {
      prop.houses = 4;
      state.bank.houses -= 4;
      log(state, 'sell', say(state, 'sellsTop', { name: player(state, playerId), label: labels(state).hotel.toLowerCase(), space: space.name, amount: amountText(state, check.refund) }), {
        playerId,
        spaceId,
        amount: check.refund,
      });
    }
  } else {
    prop.houses -= 1;
    state.bank.houses += 1;
    log(state, 'sell', say(state, 'sells', { name: player(state, playerId), space: space.name, amount: amountText(state, check.refund) }), {
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
