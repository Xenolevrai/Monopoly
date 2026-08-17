/**
 * Mouvements d'argent, dettes et faillite.
 *
 * Règle centrale : on ne descend jamais en dessous de 0 €. Si une joueuse ne peut
 * pas payer, la somme manquante devient une `debt` explicite dans l'état, et le
 * jeu se met en attente (`pending.kind === 'pay_debt'`) : elle doit hypothéquer,
 * revendre, échanger — ou déclarer faillite.
 */
import { getSpace, cards } from '../../shared/index.js';
import { log, euros } from './log.js';
import { playerById, propertiesOf, maxRaisable, activePlayers } from './queries.js';

/** Crédite une joueuse. */
export function credit(state, playerId, amount, reason) {
  if (amount <= 0) return;
  const player = playerById(state, playerId);
  player.cash += amount;
  log(state, 'credit', `${player.name} reçoit ${euros(amount)}${reason ? ` (${reason})` : ''}.`, {
    playerId,
    amount,
    reason,
  });
}

/**
 * Fait payer une joueuse. Si elle n'a pas assez de liquide, la dette est
 * enregistrée et le jeu se met en attente de règlement.
 * @param {string|null} creditorId - null = la banque
 * @returns {{ paid: boolean, shortfall: number }}
 */
export function charge(state, playerId, amount, reason, creditorId = null) {
  if (amount <= 0) return { paid: true, shortfall: 0 };
  const player = playerById(state, playerId);

  if (player.cash >= amount) {
    player.cash -= amount;
    if (creditorId) {
      playerById(state, creditorId).cash += amount;
      log(state, 'payment', `${player.name} paie ${euros(amount)} à ${playerById(state, creditorId).name} (${reason}).`, {
        playerId,
        creditorId,
        amount,
        reason,
      });
    } else {
      if (state.settings.freeParkingPot && isTaxLike(reason)) state.freeParkingPot += amount;
      log(state, 'payment', `${player.name} paie ${euros(amount)} à la banque (${reason}).`, {
        playerId,
        creditorId: null,
        amount,
        reason,
      });
    }
    return { paid: true, shortfall: 0 };
  }

  // Paiement impossible en l'état : on ouvre une dette, qui prend la priorité sur
  // tout le reste jusqu'à son règlement ou la faillite.
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
    `${player.name} doit ${euros(amount)}${creditorId ? ` à ${playerById(state, creditorId).name}` : ' à la banque'} et ne peut pas payer immédiatement (${reason}).`,
    { playerId, creditorId, amount, reason },
  );
  return { paid: false, shortfall: amount - player.cash };
}

function isTaxLike(reason = '') {
  return /imp[oô]t|taxe/i.test(reason);
}

/**
 * Tente de régler la dette courante si la joueuse a désormais assez de liquide.
 * Appelée après chaque hypothèque, revente ou échange.
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
    `${debtor.name} règle sa dette de ${euros(debt.amount)}${debt.creditorId ? ` envers ${playerById(state, debt.creditorId).name}` : ' envers la banque'}.`,
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
      `${player.name} fait faillite. ${creditor.name} récupère ${euros(player.cash)} et ${owned.length} propriété(s).`,
      { playerId, creditorId, amount: player.cash, spaceIds: owned.map((p) => p.spaceId) },
    );
  } else {
    for (const prop of owned) {
      returnBuildingsToBank(state, prop);
      prop.ownerId = null;
      prop.mortgaged = false;
    }
    returnJailCardsToDecks(state, player.getOutOfJailCards);
    log(state, 'bankruptcy', `${player.name} fait faillite. Ses biens retournent à la banque.`, {
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
  for (const [deck, list] of Object.entries(cards)) {
    const cardId = list.find((c) => c.keepable)?.id;
    if (cardId && !state.decks[deck].includes(cardId)) {
      state.decks[deck].push(cardId);
      if (--count === 0) return;
    }
  }
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
 * Vérifie s'il ne reste qu'une joueuse : elle gagne.
 * @returns {boolean} true si la partie est terminée
 */
export function checkGameOver(state) {
  const alive = activePlayers(state);
  if (alive.length > 1) return false;
  state.phase = 'finished';
  state.winnerId = alive[0]?.id ?? null;
  state.pending = { kind: null, playerIds: [] };
  if (alive[0]) log(state, 'victory', `${alive[0].name} remporte la partie !`, { playerId: alive[0].id });
  return true;
}

/** Montant total des loyers dus sur une case donnée — utilitaire de debug. */
export function describeProperty(state, spaceId) {
  const space = getSpace(spaceId);
  const prop = state.properties[spaceId];
  return `${space.name} — ${prop.ownerId ? playerById(state, prop.ownerId).name : 'banque'}${prop.mortgaged ? ' (hypothéquée)' : ''}`;
}
