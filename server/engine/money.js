/**
 * Mouvements d'argent, dettes et faillite.
 *
 * Règle centrale : on ne descend jamais en dessous de 0 €. Si une joueuse ne peut
 * pas payer, la somme manquante devient une `debt` explicite dans l'état, et le
 * jeu se met en attente (`pending.kind === 'pay_debt'`) : elle doit hypothéquer,
 * revendre, échanger — ou déclarer faillite.
 */
import { getSpace, cardsOf, rulesOf, ownableSpaces } from '../../shared/index.js';
import { log, say, amountText } from './log.js';
import { playerById, propertiesOf, maxRaisable, activePlayers, netWorth, rentFor } from './queries.js';

/** Crédite une joueuse. */
export function credit(state, playerId, amount, reason) {
  if (amount <= 0) return;
  const player = playerById(state, playerId);
  player.cash += amount;
  log(state, 'credit', say(state, 'credited', { name: player.name, amount: amountText(state, amount), reason }), {
    playerId,
    amount,
    reason,
  });
}

/**
 * Fait payer une joueuse.
 *
 * Par défaut, si les fonds sont là, la somme part tout de suite : une taxe, une
 * caution ou les 10 € d'un anniversaire ne se négocient pas, et un clic de plus
 * n'apporterait rien.
 *
 * `negotiable` change ce régime, et c'est le cas d'un **loyer** : la somme n'est
 * jamais prélevée d'office. Elle devient une dette à régler, ce qui laisse le
 * choix de payer, de proposer un arrangement au propriétaire, ou de vendre
 * quelque chose d'abord. C'est le moment où l'on discute autour de la table.
 *
 * @param {string|null} creditorId - null = la banque
 * @param {{ negotiable?: boolean }} [options]
 * @returns {{ paid: boolean, shortfall: number }}
 */
export function charge(state, playerId, amount, reason, creditorId = null, options = {}) {
  if (amount <= 0) return { paid: true, shortfall: 0 };
  const player = playerById(state, playerId);

  if (!options.negotiable && player.cash >= amount) {
    player.cash -= amount;
    if (creditorId) {
      playerById(state, creditorId).cash += amount;
      log(
        state,
        'payment',
        say(state, 'paysPlayer', { name: player.name, amount: amountText(state, amount), creditor: playerById(state, creditorId).name, reason }),
        { playerId, creditorId, amount, reason },
      );
    } else {
      if (state.settings.freeParkingPot && isTaxLike(reason)) state.freeParkingPot += amount;
      log(state, 'payment', say(state, 'paysBank', { name: player.name, amount: amountText(state, amount), reason }), {
        playerId,
        creditorId: null,
        amount,
        reason,
      });
    }
    return { paid: true, shortfall: 0 };
  }

  // Éditions sans faillite (les points de maison) : on ne peut pas devoir plus
  // qu'on n'a. On verse ce qu'on peut, et l'affaire est close — il n'y a ni
  // dette qui traîne, ni joueuse éliminée.
  if (!rulesOf(state).mechanics.bankruptcyEliminates) {
    const paid = Math.min(player.cash, amount);
    player.cash -= paid;
    if (creditorId) playerById(state, creditorId).cash += paid;
    log(
      state,
      'payment',
      paid < amount
        ? say(state, 'partialPay', {
            name: player.name,
            paid: amountText(state, paid),
            amount: amountText(state, amount),
            reason,
          })
        : say(state, 'hands', {
            name: player.name,
            paid: amountText(state, paid),
            creditor: creditorId ? playerById(state, creditorId).name : null,
            reason,
          }),
      { playerId, creditorId, amount: paid, reason },
    );
    return { paid: true, shortfall: amount - paid };
  }

  // Somme due : on ouvre une dette, qui prend la priorité sur tout le reste
  // jusqu'à son règlement, son arrangement, ou la faillite.
  state.debt = { debtorId: playerId, creditorId, amount, reason };
  state.pending = {
    kind: 'pay_debt',
    playerIds: [playerId],
    payload: {
      amount,
      creditorId,
      reason,
      canPay: maxRaisable(state, playerId) >= amount,
    },
  };
  log(
    state,
    'debt',
    say(state, 'owes', { name: player.name, amount: amountText(state, amount), creditor: creditorId ? playerById(state, creditorId).name : null, reason }),
    { playerId, creditorId, amount, reason },
  );
  return { paid: false, shortfall: Math.max(0, amount - player.cash) };
}

function isTaxLike(reason = '') {
  return /imp[oô]t|taxe/i.test(reason);
}

/**
 * Règle la dette courante en liquide. C'est une décision : le moteur ne prélève
 * jamais tout seul l'argent d'une joueuse pour un loyer.
 * @returns {boolean} true si la dette a été soldée
 */
export function settleDebt(state) {
  const debt = state.debt;
  if (!debt) return false;
  const debtor = playerById(state, debt.debtorId);
  if (debtor.cash < debt.amount) return false;

  debtor.cash -= debt.amount;
  if (debt.creditorId) {
    playerById(state, debt.creditorId).cash += debt.amount;
  } else if (state.settings.freeParkingPot && isTaxLike(debt.reason)) {
    state.freeParkingPot += debt.amount;
  }
  log(
    state,
    'payment',
    say(state, 'settles', { name: debtor.name, amount: amountText(state, debt.amount), creditor: debt.creditorId ? playerById(state, debt.creditorId).name : null }),
    { playerId: debt.debtorId, creditorId: debt.creditorId, amount: debt.amount },
  );
  state.debt = null;
  // On repart d'une ardoise vide : `advanceFlow` recalcule la suite (collecte en
  // cours, enchère en file, ou fin de tour).
  state.pending = { kind: null, playerIds: [] };
  return true;
}

/**
 * Déclare la faillite de la débitrice courante.
 * - dette envers une joueuse : tout lui revient (liquide, propriétés, cartes)
 * - dette envers la banque : les propriétés retournent à la banque, puis sont
 *   remises aux enchères une par une si la règle est active
 */
export function declareBankruptcy(state, playerId) {
  const player = playerById(state, playerId);
  const debt = state.debt;
  const creditorId = debt?.creditorId ?? null;
  const owned = propertiesOf(state, playerId);

  if (creditorId) {
    const creditor = playerById(state, creditorId);
    creditor.cash += player.cash;
    creditor.getOutOfJailCards += player.getOutOfJailCards;
    for (const prop of owned) {
      // Les constructions sont revendues à la banque : seuls les terrains changent de main.
      returnBuildingsToBank(state, prop);
      prop.ownerId = creditorId;
    }
    log(
      state,
      'bankruptcy',
      say(state, 'bankruptTo', { name: player.name, creditor: creditor.name, amount: amountText(state, player.cash), count: owned.length }),
      { playerId, creditorId, amount: player.cash, spaceIds: owned.map((p) => p.spaceId) },
    );
  } else {
    for (const prop of owned) {
      returnBuildingsToBank(state, prop);
      prop.ownerId = null;
      prop.mortgaged = false;
    }
    returnJailCardsToDecks(state, player.getOutOfJailCards);
    log(state, 'bankruptcy', say(state, 'bankruptBank', { name: player.name }), {
      playerId,
      spaceIds: owned.map((p) => p.spaceId),
    });
    if (state.settings.auctionBankruptcyAssets && owned.length) {
      state.auctionQueue = [...(state.auctionQueue ?? []), ...owned.map((p) => p.spaceId)];
    }
  }

  player.cash = 0;
  player.getOutOfJailCards = 0;
  player.bankrupt = true;
  player.inJail = false;
  state.debt = null;
  return { creditorId, releasedSpaces: owned.map((p) => p.spaceId) };
}

/**
 * Renvoie sous leur pile les cartes « libérée de prison » d'une joueuse en
 * faillite envers la banque : elles doivent pouvoir être repiochées.
 */
function returnJailCardsToDecks(state, count) {
  if (count <= 0) return;
  for (const [deck, list] of Object.entries(cardsOf(state))) {
    const cardId = list.find((c) => c.keepable)?.id;
    if (cardId && !state.decks[deck].includes(cardId)) {
      state.decks[deck].push(cardId);
      if (--count === 0) return;
    }
  }
}

/**
 * Remet à jour ce qui est affiché pendant une dette (montant réunissable),
 * après une hypothèque, une revente ou un échange.
 */
export function refreshDebtPending(state) {
  const debt = state.debt;
  if (!debt || state.pending.kind !== 'pay_debt') return;
  const debtor = playerById(state, debt.debtorId);
  state.pending = {
    ...state.pending,
    payload: {
      ...state.pending.payload,
      canPay: maxRaisable(state, debt.debtorId) >= debt.amount,
      hasCash: debtor.cash >= debt.amount,
    },
  };
}

/**
 * Le récapitulatif de fin de partie.
 *
 * Toutes les joueuses y figurent — celles qui ont fait faillite comprises, en bas
 * du tableau : une partie se raconte en entier. Le classement se fait au
 * patrimoine (liquide + propriétés + constructions), avec le détail de chaque
 * poste pour que le résultat se lise sans discussion.
 */
export function finishGame(state, reason = 'la partie est arrêtée') {
  const edition = rulesOf(state);
  // À l'édition à points, la banque verse en fin de partie un bonus égal au
  // loyer courant de chaque lieu exploré : ce sont les lieux qui font le score,
  // pas le patrimoine immobilier.
  const byExploration = edition.winCondition === 'allLocationsExplored';

  const standings = state.players
    .map((player) => {
      const owned = propertiesOf(state, player.id);
      const bonus = byExploration
        ? owned.reduce((sum, prop) => sum + rentFor(state, prop.spaceId, { diceTotal: 7 }), 0)
        : 0;
      return {
        playerId: player.id,
        name: player.name,
        bankrupt: player.bankrupt,
        cash: player.cash,
        properties: owned.length,
        buildings: owned.reduce((n, prop) => n + (prop.hotel ? 5 : prop.houses), 0),
        bonus,
        worth: byExploration
          ? player.cash + bonus
          : player.bankrupt
            ? 0
            : netWorth(state, player.id),
      };
    })
    // Une joueuse éliminée passe en bas du tableau — sauf à l'édition à points,
    // où personne n'est éliminée et où seul le total compte.
    .sort((a, b) =>
      byExploration ? b.worth - a.worth : Number(a.bankrupt) - Number(b.bankrupt) || b.worth - a.worth,
    );

  state.phase = 'finished';
  state.standings = standings;
  state.winnerId = standings[0]?.playerId ?? null;
  state.pending = { kind: null, playerIds: [] };
  state.debt = null;

  log(state, 'victory', say(state, 'gameOver', { reason }), { standings });
  standings.forEach((entry, index) => {
    log(
      state,
      'victory',
      entry.bankrupt && !byExploration
        ? say(state, 'standingBankrupt', { name: entry.name })
        : byExploration
          ? say(state, 'standingPoints', {
              rank: index + 1,
              name: entry.name,
              worth: entry.worth,
              bonus: entry.bonus,
            })
          : say(state, 'standingWorth', {
              rank: index + 1,
              name: entry.name,
              worth: amountText(state, entry.worth),
            }),
      entry,
    );
  });
  return { ok: true, standings };
}

/** Rend les maisons/hôtels d'une propriété au stock de la banque. */
export function returnBuildingsToBank(state, prop) {
  if (prop.hotel) {
    state.bank.hotels += 1;
    prop.hotel = false;
  }
  state.bank.houses += prop.houses;
  prop.houses = 0;
}

/**
 * Vérifie si la partie est finie, selon la condition de victoire de l'édition.
 *
 * `lastPlayerStanding` — le Monopoly qu'on connaît : on joue jusqu'à ce qu'il ne
 * reste qu'une joueuse solvable.
 *
 * `allLocationsExplored` — l'édition à points : personne n'est éliminée, la
 * partie s'arrête net dès que le dernier lieu du plateau a été exploré, et c'est
 * le total de points qui départage.
 *
 * @returns {boolean} true si la partie est terminée
 */
export function checkGameOver(state) {
  const edition = rulesOf(state);

  // Deux fins possibles, la première atteinte l'emporte : tout le plateau
  // capturé, ou une seule joueuse encore debout. Le classement se fait au
  // patrimoine, comme une partie classique arrêtée d'un commun accord.
  if (edition.winCondition === 'allOwnedOrLastStanding') {
    const remaining = ownableSpaces(state).filter((space) => !state.properties[space.id].ownerId);
    if (remaining.length === 0) {
      finishGame(state, say(state, 'allCaptured'));
      return true;
    }
    const standing = activePlayers(state);
    if (standing.length > 1) return false;
    finishGame(state, standing[0] ? say(state, 'lastStanding', { name: standing[0].name }) : say(state, 'noneLeft'));
    return true;
  }

  if (edition.winCondition === 'allLocationsExplored') {
    const remaining = ownableSpaces(state).filter((space) => !state.properties[space.id].ownerId);
    if (remaining.length > 0) return false;
    finishGame(state, say(state, 'allExplored'));
    return true;
  }

  const alive = activePlayers(state);
  if (alive.length > 1) return false;
  finishGame(state, alive[0] ? say(state, 'lastStanding', { name: alive[0].name }) : say(state, 'noneLeft'));
  return true;
}

/** Montant total des loyers dus sur une case donnée — utilitaire de debug. */
export function describeProperty(state, spaceId) {
  const space = getSpace(state, spaceId);
  const prop = state.properties[spaceId];
  return `${space.name} — ${prop.ownerId ? playerById(state, prop.ownerId).name : 'banque'}${prop.mortgaged ? ' (hypothéquée)' : ''}`;
}
