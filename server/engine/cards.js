/**
 * Piles Chance et Caisse de Communauté.
 *
 * Une pile est une file d'identifiants : on pioche en tête, on remet en queue —
 * c'est littéralement la règle « remettre la carte sous la pile ». Les deux
 * cartes « libérée de prison » quittent la file tant qu'une joueuse les détient.
 */
import { cardsOf, editionOf, boardOf, isOwnable, getSpace } from '../../shared/index.js';
import { log, say, amountText } from './log.js';
import { playerById, buildingsOf, activePlayers, propertiesOf, config } from './queries.js';
import { credit, charge, finishGame } from './money.js';
import { advance, moveTo, sendToJail, resolveLanding } from './movement.js';
import { dropHazard, clearHazards, nearestVulnerable, advanceHazardPawn } from './hazard.js';
import { rollDice } from './rng.js';

/**
 * Les paquets ne sont plus figés à Chance/Caisse de communauté : une extension
 * peut les retirer et en ajouter d'autres (Spin, Corruption, Bonus…). On lit
 * donc la liste des paquets sur l'édition déjà fusionnée, jamais un nom en dur —
 * c'est ce qui permet au moteur de rester ignorant des extensions.
 */
function decksOf(state) {
  return Object.keys(cardsOf(state));
}

/** Index des cartes par identifiant, calculé une fois par édition (+ extensions actives). */
const INDEX_CACHE = new Map();

function cardIndex(state) {
  // La clé porte la langue et les extensions actives : le texte et les paquets en dépendent.
  const editionId = `${state.editionId ?? 'classic-fr'}:${state.locale ?? 'fr'}:${(state.extensionIds ?? []).join(',')}`;
  if (!INDEX_CACHE.has(editionId)) {
    const decks = cardsOf(state);
    INDEX_CACHE.set(
      editionId,
      Object.fromEntries(
        decksOf(state).flatMap((deck) => (decks[deck] ?? []).map((card) => [card.id, { ...card, deck }])),
      ),
    );
  }
  return INDEX_CACHE.get(editionId);
}

/** Le nom que cette édition donne à chaque pile. */
function deckLabel(state, deck) {
  return editionOf(state).theming?.decks?.[deck]?.label ?? deck;
}

export function getCard(state, cardId) {
  return cardIndex(state)[cardId];
}

/** Mélange les piles au début de la partie. */
export function buildDecks(state, rng) {
  const decks = cardsOf(state);
  for (const deck of decksOf(state)) {
    state.decks[deck] = rng.shuffle((decks[deck] ?? []).map((c) => c.id));
  }
  refillVault(state);
}

// — Coffre de cartes visibles ————————————————————————————————
// Une édition (ou une extension) qui déclare `mechanics.saleVault` garde en
// permanence quelques cartes retournées, prises dans un paquet ordinaire. Le
// moteur ne sait pas laquelle des extensions le pose : il lit la mécanique.

/** La configuration du coffre, ou null si l'édition n'en déclare pas. */
export function vaultConfig(state) {
  return config(state).mechanics?.saleVault ?? null;
}

/** Complète le présentoir jusqu'au nombre de cartes visibles annoncé. */
export function refillVault(state) {
  const cfg = vaultConfig(state);
  if (!cfg || !state.saleVault) return;
  const queue = state.decks[cfg.deck] ?? [];
  while (state.saleVault.visible.length < cfg.visible && queue.length) {
    state.saleVault.visible.push(queue.shift());
  }
}

/** Fait passer une carte visible du coffre dans la main d'une joueuse. */
export function takeVaultCard(state, playerId, cardId) {
  const cfg = vaultConfig(state);
  if (!cfg || !state.saleVault) return { ok: false, error: "Aucun coffre dans cette partie." };
  const index = state.saleVault.visible.indexOf(cardId);
  if (index < 0) return { ok: false, error: "Cette carte n'est plus dans le coffre." };
  state.saleVault.visible.splice(index, 1);
  const player = playerById(state, playerId);
  player.saleCards.push(cardId);
  const card = getCard(state, cardId);
  log(state, 'card', say(state, 'vaultTakes', { name: player.name, text: card?.text ?? cardId }), {
    playerId,
    cardId,
  });
  refillVault(state);
  return { ok: true };
}

/** Retire une carte à une joueuse et la remet sous le paquet du coffre. */
export function loseVaultCard(state, playerId) {
  const cfg = vaultConfig(state);
  const player = playerById(state, playerId);
  if (!cfg || !player?.saleCards?.length) return false;
  const cardId = player.saleCards.shift();
  (state.decks[cfg.deck] ??= []).push(cardId);
  log(state, 'card', say(state, 'vaultLoses', { name: player.name }), { playerId, cardId });
  return true;
}

/**
 * Une carte du coffre porte-t-elle une condition de victoire déjà remplie ?
 * Les conditions sont déclaratives (`{ type, amount }`) et lues ici de façon
 * générique : ajouter un type de condition ne demande pas de toucher au flux.
 */
function victoryMet(state, player, condition) {
  switch (condition.type) {
    case 'cash_at_least':
      return player.cash >= condition.amount;
    case 'own_at_least':
      return propertiesOf(state, player.id).length >= condition.count;
    case 'buildings_at_least': {
      const { houses, hotels } = buildingsOf(state, player.id);
      return houses + hotels >= condition.count;
    }
    default:
      return false;
  }
}

/**
 * Victoire immédiate par carte du coffre (`mechanics.saleVictory`).
 * @returns {boolean} true si la partie vient de se terminer
 */
export function checkSaleVictory(state) {
  if (!config(state).mechanics?.saleVictory) return false;
  for (const player of activePlayers(state)) {
    for (const cardId of player.saleCards ?? []) {
      const card = getCard(state, cardId);
      if (card?.victory && victoryMet(state, player, card.victory)) {
        finishGame(state, say(state, 'saleVictory', { name: player.name, text: card.text }));
        return true;
      }
    }
  }
  return false;
}

/**
 * Retourne la carte du dessus du tas et la montre — sans appliquer son effet.
 *
 * Le jeu se met alors en attente : on lit la carte, puis on la valide. C'est le
 * geste du plateau, où l'on tire la carte, on la lit à voix haute, et seulement
 * ensuite on fait ce qu'elle dit.
 *
 * @param {'chance'|'community_chest'} deck
 */
export function drawCard(state, playerId, deck, ctx = {}) {
  const queue = state.decks[deck];
  if (!queue.length) return null;

  const cardId = queue[0];
  const card = cardIndex(state)[cardId];
  const player = playerById(state, playerId);
  state.drawnCardId = cardId;
  log(state, 'card', say(state, 'draws', { name: player.name, deck: deckLabel(state, deck), text: card.text }), {
    playerId,
    deck,
    cardId,
  });

  state.pending = {
    kind: 'card_reveal',
    playerIds: [playerId],
    payload: { cardId, deck, text: card.text, diceTotal: ctx.diceTotal ?? 0 },
  };
  return card;
}

/**
 * Applique la carte qui vient d'être retournée, et la remet sous la pile.
 * Les cartes « libérée de prison » restent en main jusqu'à leur usage.
 */
export function applyRevealedCard(state, playerId, rng = null) {
  const payload = state.pending?.payload;
  const card = payload && cardIndex(state)[payload.cardId];
  if (!card) return { ok: false, error: 'Aucune carte à appliquer.' };

  const queue = state.decks[payload.deck];
  if (queue[0] === card.id) queue.shift();

  if (card.keepable) {
    playerById(state, playerId).getOutOfJailCards += 1;
  } else {
    queue.push(card.id); // remise sous la pile
  }

  state.pending = { kind: null, playerIds: [] };
  applyCardAction(state, playerId, card.action, { diceTotal: payload.diceTotal ?? 0, rng });
  return { ok: true, card };
}

/** Remet une carte « libérée de prison » sous sa pile après usage. */
export function returnJailCard(state, playerId) {
  const player = playerById(state, playerId);
  if (player.getOutOfJailCards <= 0) return false;
  player.getOutOfJailCards -= 1;
  const decks = cardsOf(state);
  for (const deck of decksOf(state)) {
    const cardId = (decks[deck] ?? []).find((c) => c.keepable)?.id;
    if (cardId && !state.decks[deck].includes(cardId)) {
      state.decks[deck].push(cardId);
      return true;
    }
  }
  return true;
}

/**
 * Applique un effet de carte. Neuf types couvrent les 32 cartes.
 */
export function applyCardAction(state, playerId, action, ctx = {}) {
  const player = playerById(state, playerId);

  switch (action.type) {
    case 'collect':
      credit(state, playerId, action.amount, say(state, 'reasonCard'));
      return;

    case 'pay':
      charge(state, playerId, action.amount, say(state, 'reasonCard'));
      return;

    case 'move_to': {
      const collect = action.collectGoSalary !== false;
      moveTo(state, playerId, action.target, collect);
      resolveLanding(state, playerId, {
        diceTotal: ctx.diceTotal ?? 0,
        rentMultiplier: action.rentMultiplier ?? 1,
      });
      return;
    }

    case 'move_relative': {
      // Un recul ne fait jamais toucher le salaire de la case Départ.
      advance(state, playerId, action.offset);
      resolveLanding(state, playerId, { diceTotal: ctx.diceTotal ?? 0 });
      return;
    }

    // « Avancez jusqu'à la gare la plus proche » / « au service le plus proche ».
    // On cherche vers l'avant à partir de la case courante, donc on peut repasser
    // par Départ et toucher le salaire, comme sur le plateau.
    case 'nearest': {
      const target = nearestSpaceOfType(state, player.position, action.spaceType);
      if (target == null) {
        log(state, 'card', say(state, 'noSuchSpace'), { playerId });
        return;
      }
      moveTo(state, playerId, target, true);
      // Une gare atteinte par carte se paie au double du tarif ; un service se
      // paie au multiple imposé par la carte, relancé sur un nouveau jet.
      const reroll = action.rerollDice && ctx.rng ? rollTotal(ctx.rng, state) : (ctx.diceTotal ?? 0);
      resolveLanding(state, playerId, {
        diceTotal: reroll,
        rentMultiplier: action.rentMultiplier ?? 1,
        utilityFactor: action.utilityFactor,
      });
      return;
    }

    case 'go_to_jail':
      sendToJail(state, playerId);
      return;

    case 'pay_per_building': {
      const { houses, hotels } = buildingsOf(state, playerId);
      const total = houses * action.perHouse + hotels * action.perHotel;
      if (total === 0) {
        log(state, 'card', say(state, 'nothingToRepair', { name: player.name }), { playerId });
        return;
      }
      charge(state, playerId, total, say(state, 'reasonRepairs', { houses, hotels }));
      return;
    }

    // « Vous êtes élue présidente du conseil : versez 50 à chaque joueuse. »
    // On paie une par une, chacune étant créditée : si la somme totale dépasse
    // le solde, `charge` ouvre une dette comme n'importe quel autre paiement.
    case 'pay_to_each': {
      for (const other of activePlayers(state)) {
        if (other.id === playerId) continue;
        charge(state, playerId, action.amount, say(state, 'reasonPayTo', { name: other.name }), other.id);
        if (state.debt) return;
      }
      return;
    }

    case 'collect_from_each': {
      const others = activePlayers(state)
        .filter((p) => p.id !== playerId)
        .map((p) => p.id);
      collectFromEach(state, playerId, action.amount, others);
      return;
    }

    case 'get_out_of_jail_free':
      log(state, 'card', say(state, 'keepsJailCard', { name: player.name }), { playerId });
      return;

    // Paie la caution courante (celle de la geôle où se trouve la joueuse — la
    // sévère si `jailTier === 'super'`) et la libère. Générique : lu sur
    // `edition.jail`, jamais sur un nom d'extension.
    case 'pay_bail': {
      const jail = editionOf(state).jail;
      const amount = player.jailTier === 'super' ? (jail.superBail ?? jail.bail) : jail.bail;
      charge(state, playerId, amount, say(state, 'reasonBail'));
      player.inJail = false;
      player.jailTurns = 0;
      return;
    }

    // Cagnotte commune (Parc Gratuit Jackpot, ou toute édition qui l'active) :
    // au lieu d'aller à la banque, au lieu d'en venir.
    case 'pay_to_pot': {
      // Ne grossit la cagnotte que si la somme a bien quitté la joueuse tout de
      // suite : en cas de dette ouverte, l'argent n'a pas encore bougé.
      const result = charge(state, playerId, action.amount, say(state, 'reasonCard'));
      if (result.paid) state.freeParkingPot += action.amount;
      return;
    }

    case 'collect_from_pot': {
      const pot = state.freeParkingPot;
      state.freeParkingPot = 0;
      credit(state, playerId, pot, say(state, 'reasonParking'));
      return;
    }

    // Le secteur « Jackpot ! » de la roulette : toute la cagnotte, plus un bonus
    // fixe porté par la carte (représente l'achat gratuit d'une propriété libre,
    // simplifié en espèces — voir la note dans buy-everything.notes si le rendu
    // exact d'un achat gratuit devient nécessaire plus tard).
    case 'jackpot': {
      const pot = state.freeParkingPot;
      state.freeParkingPot = 0;
      if (pot > 0) credit(state, playerId, pot, say(state, 'reasonParking'));
      if (action.bonus) credit(state, playerId, action.bonus, say(state, 'reasonCard'));
      return;
    }

    case 'draw_card':
      drawCard(state, playerId, action.deck, ctx);
      return;

    // Plusieurs effets d'affilée sur une même carte. Générique : on réapplique
    // simplement chaque action, dans l'ordre annoncé.
    case 'sequence':
      for (const step of action.actions ?? []) {
        applyCardAction(state, playerId, step, ctx);
        if (state.debt || state.pending.kind) return; // un effet a suspendu la partie
      }
      return;

    // — Pion hostile autonome (`mechanics.hazardPawn`) ————————
    case 'place_hazard': {
      const target = nearestVulnerable(state, player.position);
      if (target != null) dropHazard(state, target);
      return;
    }

    case 'clear_hazard': {
      const cleared = clearHazards(state, player.position, action.count ?? 1);
      if (cleared === 0) log(state, 'card', say(state, 'noHazard'), { playerId });
      return;
    }

    case 'move_hazard':
      advanceHazardPawn(state, action.steps ?? 1);
      return;

    // Un loyer annulé d'avance, gardé jusqu'à ce qu'on en ait besoin.
    case 'grant_rent_waiver':
      player.rentWaivers = (player.rentWaivers ?? 0) + (action.count ?? 1);
      log(state, 'card', say(state, 'rentWaiverGranted', { name: player.name }), { playerId });
      return;

    // « Avancez jusqu'au prochain bien encore libre. »
    case 'nearest_unowned': {
      const board = boardOf(state);
      let target = null;
      for (let step = 1; step <= board.length; step++) {
        const id = (player.position + step) % board.length;
        if (isOwnable(state, id) && !state.properties[id]?.ownerId) { target = id; break; }
      }
      if (target == null) {
        log(state, 'card', say(state, 'noSuchSpace'), { playerId });
        return;
      }
      moveTo(state, playerId, target, true);
      resolveLanding(state, playerId, { diceTotal: ctx.diceTotal ?? 0 });
      return;
    }

    // Dérobe une somme à la joueuse qui a le plus de liquide.
    case 'steal_from_richest': {
      const victim = activePlayers(state)
        .filter((p) => p.id !== playerId)
        .sort((a, b) => b.cash - a.cash)[0];
      if (!victim) return;
      charge(state, victim.id, action.amount, say(state, 'reasonTheft'), playerId);
      return;
    }

    // Fait reculer la joueuse la plus riche — sans la faire résoudre sa case :
    // le recul est une gêne, pas un événement.
    case 'rival_move_relative': {
      const rival = activePlayers(state)
        .filter((p) => p.id !== playerId)
        .sort((a, b) => b.cash - a.cash)[0];
      if (!rival) return;
      advance(state, rival.id, action.offset);
      log(state, 'card', say(state, 'rivalPushed', { name: rival.name, space: getSpace(state, rival.position).name }), {
        playerId: rival.id,
      });
      return;
    }

    // Une construction offerte : on la pose sur le bien le moins bâti qu'on
    // possède et qui l'accepte, sans rien débourser.
    case 'free_building': {
      const target = propertiesOf(state, playerId)
        .filter((prop) => getSpace(state, prop.spaceId).type === 'property' && !prop.mortgaged)
        .sort((a, b) => a.houses - b.houses)[0];
      if (!target || state.bank.houses < 1) {
        log(state, 'card', say(state, 'noFreeBuilding', { name: player.name }), { playerId });
        return;
      }
      target.houses += 1;
      state.bank.houses -= 1;
      log(state, 'build', say(state, 'freeBuilding', {
        name: player.name,
        space: getSpace(state, target.spaceId).name,
      }), { playerId, spaceId: target.spaceId });
      return;
    }

    // Se balancer d'un raccourci à l'autre, contre le prix annoncé.
    case 'warp': {
      if (action.cost > 0) charge(state, playerId, action.cost, say(state, 'reasonWarp'));
      moveTo(state, playerId, action.target, false);
      log(state, 'land', say(state, 'warped', {
        name: player.name,
        space: getSpace(state, action.target).name,
      }), { playerId, spaceId: action.target });
      return;
    }

    // Choisir une carte parmi celles retournées dans le coffre.
    case 'take_sale_card':
      takeVaultCard(state, playerId, action.cardId);
      return;

    // Le dé d'Achat a fait perdre une carte à une adversaire.
    case 'lose_sale_card':
      loseVaultCard(state, action.targetId ?? playerId);
      return;

    case 'choice':
      state.pending = {
        kind: 'card_choice',
        playerIds: [playerId],
        payload: {
          options: action.options.map((o, index) => ({ index, label: o.label })),
          actions: action.options.map((o) => o.action),
        },
      };
      return;

    default:
      log(state, 'error', say(state, 'unknownCard', { type: action.type }), { action });
  }
}

/** La prochaine case d'un type donné en avançant, ou null si le plateau n'en a pas. */
function nearestSpaceOfType(state, from, spaceType) {
  const board = boardOf(state);
  for (let step = 1; step <= board.length; step++) {
    const id = (from + step) % board.length;
    if (board[id].type === spaceType) return id;
  }
  return null;
}

/** Un nouveau jet, pour les cartes qui l'exigent avant de calculer un loyer. */
function rollTotal(rng, state) {
  const { count, sides } = editionOf(state).dice;
  return rollDice(rng, count, sides).reduce((a, b) => a + b, 0);
}

/**
 * Fait payer une somme par chaque joueuse listée (carte « anniversaire »).
 * Si l'une d'elles ne peut pas payer, on s'arrête sur sa dette : le reste de la
 * collecte est mis en attente et reprendra une fois la dette réglée ou la
 * faillite prononcée (cf. `resumeCollection`).
 */
function collectFromEach(state, collectorId, amount, payerIds) {
  const remaining = [...payerIds];
  while (remaining.length) {
    const payerId = remaining.shift();
    const payer = playerById(state, payerId);
    if (!payer || payer.bankrupt) continue;
    charge(state, payerId, amount, say(state, 'reasonBirthday'), collectorId);
    if (state.debt) {
      state.pendingCollection = { collectorId, amount, remaining };
      return;
    }
  }
  state.pendingCollection = null;
}

/**
 * Reprend une collecte interrompue par une dette.
 * @returns {boolean} true si la partie doit rester en attente (nouvelle dette)
 */
export function resumeCollection(state) {
  const pendingCollection = state.pendingCollection;
  if (!pendingCollection) return false;
  state.pendingCollection = null;
  collectFromEach(state, pendingCollection.collectorId, pendingCollection.amount, pendingCollection.remaining);
  return Boolean(state.debt);
}

/** Résout le choix laissé par une carte à options. */
export function resolveCardChoice(state, playerId, optionIndex, ctx = {}) {
  const payload = state.pending.payload;
  const action = payload.actions[optionIndex];
  if (!action) return { ok: false, error: 'Option invalide.' };
  const label = payload.options[optionIndex].label;
  log(state, 'card', say(state, 'cardChoice', { name: playerById(state, playerId).name, label }), { playerId, optionIndex });
  state.pending = { kind: null, playerIds: [] };
  applyCardAction(state, playerId, action, ctx);
  return { ok: true };
}

export { amountText };
