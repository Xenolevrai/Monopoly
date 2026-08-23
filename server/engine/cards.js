/**
 * Piles Chance et Caisse de Communauté.
 *
 * Une pile est une file d'identifiants : on pioche en tête, on remet en queue —
 * c'est littéralement la règle « remettre la carte sous la pile ». Les deux
 * cartes « libérée de prison » quittent la file tant qu'une joueuse les détient.
 */
import { cardsOf, editionOf, boardOf, isOwnable, getSpace, ownableSpaces, getGroup } from '../../shared/index.js';
import { FREE_PARKING_SPINNER_SECTORS, ESCAPE_DIE_FACES, HEIST_DIE_FACES, BUY_DIE_FACES } from '../../shared/extensions.js';
import { log, say, amountText } from './log.js';
import { playerById, buildingsOf, activePlayers, propertiesOf, ownsFullGroup, config } from './queries.js';
import { credit, charge, finishGame, potCollects } from './money.js';
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

/**
 * Retrouve une carte par son identifiant unique.
 * @returns {(import('../../shared/index.js').Card & { deck: string })|undefined}
 */
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

  const startBonus = config(state).mechanics?.startBonusCards;
  const bonusDeck = config(state).mechanics?.bonusCardsDeck ?? 'free_parking_bonus';
  if (startBonus && state.decks[bonusDeck]?.length) {
    for (const player of state.players) {
      player.bonusCards = [];
      for (let i = 0; i < startBonus; i++) {
        if (state.decks[bonusDeck].length) {
          player.bonusCards.push(state.decks[bonusDeck].shift());
        }
      }
    }
  }

  const startCorruption = config(state).mechanics?.startCorruptionCards;
  if (startCorruption && state.decks.corruption?.length) {
    for (const player of state.players) {
      player.corruptionCards = [];
      for (let i = 0; i < startCorruption; i++) {
        if (state.decks.corruption.length) {
          const cardId = state.decks.corruption.shift();
          player.corruptionCards.push(cardId);
          player.cardsDrawnTurn[cardId] = 0;
        }
      }
    }
  }
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
    case 'own_all_railroads': {
      const railroads = propertiesOf(state, player.id).filter((p) => getSpace(state, p.spaceId)?.type === 'railroad');
      return railroads.length >= 4;
    }
    case 'own_corners_at_least': {
      const cornersOwned = [0, 10, 20, 30].filter((id) => state.properties[id]?.ownerId === player.id).length;
      return cornersOwned >= (condition.count ?? 3);
    }
    case 'hotel_on_space':
      return Boolean(state.properties[condition.spaceId]?.hotel && state.properties[condition.spaceId]?.ownerId === player.id);
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

/** Pioche 1 carte Bonus Parc Gratuit et l'ajoute à la main de la joueuse. */
export function drawBonusCard(state, playerId) {
  const bonusDeck = config(state).mechanics?.bonusCardsDeck ?? 'free_parking_bonus';
  const queue = state.decks[bonusDeck];
  if (!queue || !queue.length) return null;
  const cardId = queue.shift();
  const player = playerById(state, playerId);
  if (!player) return null;
  player.bonusCards = player.bonusCards ?? [];
  player.bonusCards.push(cardId);
  const card = getCard(state, cardId);
  const title = card?.title ?? card?.text ?? cardId;
  log(state, 'card', say(state, 'drawsBonusCard', { name: player.name, title }), { playerId, cardId });
  return cardId;
}

/** Applique l'effet d'un secteur de la roulette Parc Gratuit. */
export function applySpinnerSector(state, playerId, sector, _rng = null) {
  const player = playerById(state, playerId);
  if (!player) return;

  switch (sector.type) {
    case 'pay_to_pot': {
      const res = charge(state, playerId, sector.amount, say(state, 'reasonParking'));
      if (res.paid) state.freeParkingPot += sector.amount;
      break;
    }
    case 'free_house': {
      const owned = propertiesOf(state, playerId).filter((p) => {
        const sp = getSpace(state, p.spaceId);
        return sp.type === 'property' && !p.mortgaged && p.houses < 4 && !p.hotel;
      });
      if (owned.length && state.bank.houses > 0) {
        owned.sort((a, b) => a.houses - b.houses);
        const target = owned[0];
        target.houses += 1;
        state.bank.houses -= 1;
        log(state, 'build', say(state, 'bonusFreeHouse', { name: player.name, space: getSpace(state, target.spaceId).name }), {
          playerId,
          spaceId: target.spaceId,
        });
      }
      break;
    }
    case 'jackpot': {
      const pot = state.freeParkingPot;
      state.freeParkingPot = 0;
      if (pot > 0) {
        credit(state, playerId, pot, say(state, 'reasonParking'));
      }
      break;
    }
    case 'deal_mobile': {
      state.dealMobileOwnerId = playerId;
      log(state, 'card', say(state, 'takesDealMobile', { name: player.name }), { playerId });
      break;
    }
    case 'buy_any_1': {
      const unowned = ownableSpaces(state).filter((s) => !state.properties[s.id]?.ownerId);
      if (unowned.length) {
        const affordable = unowned.filter((s) => player.cash >= s.price);
        const chosen = affordable.length ? affordable[affordable.length - 1] : unowned[0];
        if (player.cash >= chosen.price) {
          player.cash -= chosen.price;
          if (potCollects(state)) state.freeParkingPot += chosen.price;
          state.properties[chosen.id].ownerId = playerId;
          log(state, 'buy', say(state, 'buys', { name: player.name, space: chosen.name, amount: amountText(state, chosen.price) }), {
            playerId,
            spaceId: chosen.id,
            price: chosen.price,
          });
        }
      }
      break;
    }
  }
}

export function broadcastAction(state, event) {
  state.lastEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    ...event,
  };
}

/** Tourne la roulette du Parc Gratuit et pioche 1 carte Bonus. */
export function spinFreeParking(state, playerId, rng = null, opts = {}) {
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };

  const sectors = config(state).mechanics?.spinnerSectors ?? FREE_PARKING_SPINNER_SECTORS;
  let sectorIndex = opts.sectorIndex ?? (rng ? Math.floor(rng.next() * sectors.length) : Math.floor(Math.random() * sectors.length));
  if (sectorIndex < 0 || sectorIndex >= sectors.length) sectorIndex = 0;

  const sector = sectors[sectorIndex];
  state.freeParkingSpinner = { playerId, sectorIndex, sector };

  // Pioche obligatoire d'1 carte Bonus à chaque spin (règles officielles)
  const drawnBonus = drawBonusCard(state, playerId);

  const label = state.locale === 'en' ? (sector.labelEn ?? sector.labelFr) : (sector.labelFr ?? sector.labelEn);
  log(state, 'spin', say(state, 'spinsFreeParking', { name: player.name, label }), {
    playerId,
    sectorIndex,
    sectorId: sector.id,
    drawnBonus,
  });

  broadcastAction(state, {
    type: 'spinner_spun',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    sectorIndex,
    sector,
    drawnBonusTitle: drawnBonus ? (getCard(state, drawnBonus)?.title ?? drawnBonus) : null,
    drawnBonusText: drawnBonus ? getCard(state, drawnBonus)?.text : null,
  });

  applySpinnerSector(state, playerId, sector, rng);
  return { ok: true, sectorIndex, sector, drawnBonus };
}

/** Joue une carte Bonus Parc Gratuit depuis sa main. */
export function playBonusCard(state, playerId, cardId, payload = {}, rng = null) {
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };
  if (!player.bonusCards?.includes(cardId)) return { ok: false, error: 'Vous ne possédez pas cette carte Bonus.' };

  const card = getCard(state, cardId);
  if (!card) return { ok: false, error: 'Carte inconnue.' };

  player.bonusCards = player.bonusCards.filter((id) => id !== cardId);
  const bonusDeck = config(state).mechanics?.bonusCardsDeck ?? 'free_parking_bonus';
  (state.decks[bonusDeck] ??= []).push(cardId);

  const title = card.title ?? card.text ?? cardId;
  log(state, 'card', say(state, 'playsBonusCard', { name: player.name, title }), { playerId, cardId });

  broadcastAction(state, {
    type: 'card_played',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    cardId: card.id,
    title: card.title ?? card.text ?? card.id,
    text: card.text,
    cardType: 'bonus',
    category: 'bonus',
    actionType: card.action?.type,
  });

  switch (card.action?.type) {
    case 'deal_mobile':
      state.dealMobileOwnerId = playerId;
      log(state, 'card', say(state, 'takesDealMobile', { name: player.name }), { playerId });
      break;

    case 'shortcut': {
      let target = payload.targetSpaceId;
      if (target == null) {
        const unowned = ownableSpaces(state).filter((s) => !state.properties[s.id]?.ownerId);
        target = unowned.length ? unowned[0].id : (player.position + 10) % boardOf(state).length;
      }
      log(state, 'movement', say(state, 'bonusShortcut', { name: player.name, space: getSpace(state, target).name }), { playerId, targetSpaceId: target });
      moveTo(state, playerId, target, true);
      resolveLanding(state, playerId, {});
      break;
    }

    case 'cancel_bonus':
      break;

    case 'modify_roll': {
      const offset = card.action.offset ?? 1;
      advance(state, playerId, offset);
      resolveLanding(state, playerId, {});
      break;
    }

    case 'green_light': {
      if (state.freeParkingSpinner && state.freeParkingSpinner.sector?.color === 'red') {
        const sectors = config(state).mechanics?.spinnerSectors ?? FREE_PARKING_SPINNER_SECTORS;
        const currentIdx = state.freeParkingSpinner.sectorIndex;
        const nextGreenIdx = (currentIdx + 1) % sectors.length;
        const targetSector = sectors[nextGreenIdx];
        state.freeParkingSpinner = { playerId, sectorIndex: nextGreenIdx, sector: targetSector };
        applySpinnerSector(state, playerId, targetSector, rng);
      }
      break;
    }

    case 'take_two': {
      const unowned = ownableSpaces(state).filter((s) => !state.properties[s.id]?.ownerId);
      if (unowned.length) {
        const target = unowned[0];
        if (player.cash >= target.price) {
          player.cash -= target.price;
          if (potCollects(state)) state.freeParkingPot += target.price;
          state.properties[target.id].ownerId = playerId;
          log(state, 'buy', say(state, 'bonusTakeTwo', { name: player.name, space: target.name }), { playerId, spaceId: target.id });
        }
      }
      break;
    }

    case 'spin_it':
      spinFreeParking(state, playerId, rng);
      break;

    case 'collect_jackpot': {
      const pot = state.freeParkingPot;
      state.freeParkingPot = 0;
      if (pot > 0) credit(state, playerId, pot, say(state, 'reasonParking'));
      break;
    }

    case 'free_house': {
      const owned = propertiesOf(state, playerId).filter((p) => {
        const sp = getSpace(state, p.spaceId);
        return sp.type === 'property' && !p.mortgaged && p.houses < 4 && !p.hotel;
      });
      if (owned.length && state.bank.houses > 0) {
        owned.sort((a, b) => a.houses - b.houses);
        const target = payload.spaceId != null ? state.properties[payload.spaceId] : owned[0];
        if (target && target.houses < 4 && !target.hotel && state.bank.houses > 0) {
          target.houses += 1;
          state.bank.houses -= 1;
          log(state, 'build', say(state, 'bonusFreeHouse', { name: player.name, space: getSpace(state, target.spaceId).name }), {
            playerId,
            spaceId: target.spaceId,
          });
        }
      }
      break;
    }

    case 'free_property': {
      const unowned = ownableSpaces(state).filter((s) => !state.properties[s.id]?.ownerId);
      if (unowned.length) {
        const target = payload.spaceId != null ? getSpace(state, payload.spaceId) : unowned[0];
        if (target && !state.properties[target.id]?.ownerId) {
          state.properties[target.id].ownerId = playerId;
          log(state, 'buy', say(state, 'bonusFreeProperty', { name: player.name, space: target.name }), {
            playerId,
            spaceId: target.id,
          });
        }
      }
      break;
    }

    case 'go_green': {
      const sectors = config(state).mechanics?.spinnerSectors ?? FREE_PARKING_SPINNER_SECTORS;
      const greenSectors = sectors.filter((s) => s.color === 'green');
      const chosen = greenSectors.find((s) => s.id === payload.sectorId) ?? greenSectors[0];
      if (chosen) {
        const idx = sectors.findIndex((s) => s.id === chosen.id);
        state.freeParkingSpinner = { playerId, sectorIndex: idx, sector: chosen };
        applySpinnerSector(state, playerId, chosen, rng);
      }
      break;
    }

    case 'do_over':
      spinFreeParking(state, playerId, rng);
      break;

    case 'trade_in': {
      const owned = propertiesOf(state, playerId).filter((p) => p.houses === 0 && !p.hotel && !p.mortgaged);
      const unowned = ownableSpaces(state).filter((s) => !state.properties[s.id]?.ownerId);
      if (owned.length && unowned.length) {
        const give = payload.giveSpaceId != null ? state.properties[payload.giveSpaceId] : owned[0];
        const take = payload.takeSpaceId != null ? getSpace(state, payload.takeSpaceId) : unowned[0];
        if (give && take && give.ownerId === playerId && !state.properties[take.id]?.ownerId) {
          give.ownerId = null;
          state.properties[take.id].ownerId = playerId;
          log(state, 'trade', say(state, 'bonusTradeIn', { name: player.name, given: getSpace(state, give.spaceId).name, received: take.name }), {
            playerId,
            givenSpaceId: give.spaceId,
            receivedSpaceId: take.id,
          });
        }
      }
      break;
    }
  }

  return { ok: true };
}

function isPartOfCompleteSet(state, spaceId) {
  const space = getSpace(state, spaceId);
  if (!space?.group) return false;
  const prop = state.properties[spaceId];
  if (!prop?.ownerId) return false;
  return ownsFullGroup(state, prop.ownerId, space.group);
}

/** Pioche 1 carte Corruption. */
export function drawCorruptionCard(state, playerId) {
  const queue = state.decks.corruption;
  if (!queue || !queue.length) return null;
  const cardId = queue.shift();
  const player = playerById(state, playerId);
  if (!player) return null;
  player.corruptionCards = player.corruptionCards ?? [];
  player.corruptionCards.push(cardId);
  player.cardsDrawnTurn = player.cardsDrawnTurn ?? {};
  player.cardsDrawnTurn[cardId] = state.turnCount;
  const card = getCard(state, cardId);
  const title = card?.title ?? card?.text ?? cardId;
  log(state, 'card', say(state, 'drawsCorruptionCard', { name: player.name, title }), { playerId, cardId });
  return cardId;
}

/** Pioche 1 carte Super Corruption. */
export function drawSuperCorruptionCard(state, playerId) {
  const queue = state.decks.super_corruption;
  if (!queue || !queue.length) return null;
  const cardId = queue.shift();
  const player = playerById(state, playerId);
  if (!player) return null;
  player.superCorruptionCards = player.superCorruptionCards ?? [];
  player.superCorruptionCards.push(cardId);
  player.superJailCollectedCards = player.superJailCollectedCards ?? [];
  player.superJailCollectedCards.push(cardId);
  player.cardsDrawnTurn = player.cardsDrawnTurn ?? {};
  player.cardsDrawnTurn[cardId] = state.turnCount;
  const card = getCard(state, cardId);
  const title = card?.title ?? card?.text ?? cardId;
  log(state, 'card', say(state, 'drawsSuperCorruptionCard', { name: player.name, title }), { playerId, cardId });
  return cardId;
}

/** Lance le dé Évasion (cases Chance). */
export function rollEscapeDie(state, playerId, rng = null) {
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };

  const faces = ESCAPE_DIE_FACES;
  const faceIndex = rng ? Math.floor(rng.next() * faces.length) : Math.floor(Math.random() * faces.length);
  const face = faces[faceIndex];
  state.escapeDie = { playerId, faceIndex, face, at: Date.now() };

  broadcastAction(state, {
    type: 'escape_die_rolled',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    faceIndex,
    face,
  });

  if (face.isGreen) {
    for (let i = 0; i < face.count; i++) {
      drawCorruptionCard(state, playerId);
    }
    log(state, 'card', say(state, 'rollsEscapeSuccess', { name: player.name, count: face.count }), { playerId, count: face.count });
  } else if (face.isPolice) {
    sendToJail(state, playerId, 'normal');
    log(state, 'jail', say(state, 'rollsEscapeBusted', { name: player.name }), { playerId });
  }

  state.pending = { kind: null, playerIds: [] };
  return { ok: true, faceIndex, face };
}

/** Lance le dé Casse (cases Caisse de communauté). */
export function rollHeistDie(state, playerId, rng = null) {
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };

  const faces = HEIST_DIE_FACES;
  const faceIndex = rng ? Math.floor(rng.next() * faces.length) : Math.floor(Math.random() * faces.length);
  const face = faces[faceIndex];
  state.heistDie = { playerId, faceIndex, face, at: Date.now() };

  broadcastAction(state, {
    type: 'heist_die_rolled',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    faceIndex,
    face,
  });

  if (face.isCash) {
    credit(state, playerId, face.amount, say(state, 'reasonTheft'));
    log(state, 'money', say(state, 'rollsHeistSuccess', { name: player.name, amount: amountText(state, face.amount) }), { playerId, amount: face.amount });
  } else if (face.isPolice) {
    sendToJail(state, playerId, 'normal');
    log(state, 'jail', say(state, 'rollsHeistBusted', { name: player.name }), { playerId });
  }

  state.pending = { kind: null, playerIds: [] };
  return { ok: true, faceIndex, face };
}

/** Joue une carte Corruption depuis sa main. */
export function playCorruptionCard(state, playerId, cardId, payload = {}, rng = null) {
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };
  if (!player.corruptionCards?.includes(cardId)) return { ok: false, error: 'Vous ne possédez pas cette carte Corruption.' };

  const card = getCard(state, cardId);
  if (!card) return { ok: false, error: 'Carte inconnue.' };

  if (player.cardsDrawnTurn?.[cardId] === state.turnCount && !card.reaction) {
    return { ok: false, error: 'Une carte Corruption ne peut pas être jouée le tour où elle est piochée.' };
  }

  player.corruptionCards = player.corruptionCards.filter((id) => id !== cardId);
  (state.decks.corruption ??= []).push(cardId);

  const title = card.title ?? card.text ?? cardId;
  log(state, 'card', say(state, 'corruptionPlay', { name: player.name, title }), { playerId, cardId });

  broadcastAction(state, {
    type: 'card_played',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    cardId: card.id,
    title: card.title ?? card.text ?? card.id,
    text: card.text,
    cardType: 'corruption',
    category: 'corruption',
    actionType: card.action?.type,
  });

  switch (card.action?.type) {
    case 'trespass': {
      const board = boardOf(state);
      let target = null;
      for (let step = 1; step <= board.length; step++) {
        const id = (player.position + step) % board.length;
        if (isOwnable(state, id) && !state.properties[id]?.ownerId) {
          target = id;
          break;
        }
      }
      if (target != null) {
        moveTo(state, playerId, target, true);
        resolveLanding(state, playerId, {});
      }
      break;
    }

    case 'framed': {
      if (payload.targetPlayerId) {
        sendToJail(state, payload.targetPlayerId, player.superJail ? 'super' : 'normal', playerId);
      }
      break;
    }

    case 'loan_shark': {
      const targetId = payload.targetPlayerId;
      if (targetId) {
        charge(state, targetId, 150, say(state, 'reasonTheft'), playerId);
      }
      break;
    }

    case 'pickpocket': {
      const opponents = activePlayers(state).filter((p) => p.id !== playerId);
      for (const opp of opponents) {
        const stolen = Math.min(opp.cash, 50);
        if (stolen > 0) {
          opp.cash -= stolen;
          player.cash += stolen;
        }
      }
      break;
    }

    case 'petty_theft': {
      const targetSpaceId = payload.targetSpaceId;
      if (targetSpaceId != null && state.properties[targetSpaceId]) {
        state.properties[targetSpaceId].ownerId = playerId;
      }
      break;
    }

    case 'bank_fraud': {
      const targetSpaceId = payload.targetSpaceId;
      const prop = state.properties[targetSpaceId];
      if (prop && prop.ownerId && prop.ownerId !== playerId && !isPartOfCompleteSet(state, targetSpaceId)) {
        const space = getSpace(state, targetSpaceId);
        const cost = Math.floor(space.price / 2);
        if (player.cash >= cost) {
          player.cash -= cost;
          credit(state, prop.ownerId, cost, say(state, 'reasonTheft'));
          prop.ownerId = playerId;
        }
      }
      break;
    }

    case 'creative_zoning': {
      const owned = propertiesOf(state, playerId).filter((p) => {
        const sp = getSpace(state, p.spaceId);
        return sp.type === 'property' && !p.mortgaged && p.houses < 4 && !p.hotel;
      });
      if (owned.length && state.bank.houses > 0) {
        const target = payload.spaceId != null ? state.properties[payload.spaceId] : owned[0];
        if (target && target.ownerId === playerId && target.houses < 4 && !target.hotel) {
          const count = Math.min(2, 4 - target.houses, state.bank.houses);
          target.houses += count;
          state.bank.houses -= count;
          log(state, 'build', say(state, 'bonusFreeHouse', { name: player.name, space: getSpace(state, target.spaceId).name }), {
            playerId,
            spaceId: target.spaceId,
          });
        }
      }
      break;
    }

    case 'money_laundering': {
      const unowned = ownableSpaces(state).filter((s) => !state.properties[s.id]?.ownerId);
      if (unowned.length && player.cash >= 50) {
        const chosen = payload.targetSpaceId != null ? getSpace(state, payload.targetSpaceId) : unowned[0];
        if (chosen && !state.properties[chosen.id]?.ownerId) {
          player.cash -= 50;
          if (potCollects(state)) state.freeParkingPot += 50;
          state.properties[chosen.id].ownerId = playerId;
        }
      }
      break;
    }

    case 'on_the_lam': {
      const target = payload.targetSpaceId ?? ((player.position + 10) % boardOf(state).length);
      moveTo(state, playerId, target, true);
      resolveLanding(state, playerId, {});
      break;
    }

    case 'bribe': {
      const propsCount = propertiesOf(state, playerId).length;
      const amountPerPlayer = propsCount * 10;
      if (amountPerPlayer > 0) {
        for (const opp of activePlayers(state).filter((p) => p.id !== playerId)) {
          charge(state, opp.id, amountPerPlayer, say(state, 'reasonTheft'), playerId);
        }
      }
      break;
    }

    case 'citizens_arrest': {
      const targetOpponentId = payload.targetPlayerId;
      if (targetOpponentId) {
        sendToJail(state, targetOpponentId, 'super', playerId);
      }
      break;
    }

    case 'evict_that': {
      const landlordId = payload.targetPlayerId;
      if (landlordId) {
        sendToJail(state, landlordId, 'super', playerId);
      }
      break;
    }

    case 'bait_switch': {
      const give = state.properties[payload.giveSpaceId];
      const take = state.properties[payload.takeSpaceId];
      if (give && take && give.ownerId === playerId && take.ownerId && take.ownerId !== playerId && !isPartOfCompleteSet(state, payload.takeSpaceId)) {
        const oppId = take.ownerId;
        give.ownerId = oppId;
        take.ownerId = playerId;
      }
      break;
    }

    case 'rent_hike':
      break;

    case 'swindle': {
      const give = state.properties[payload.giveSpaceId];
      const take = state.properties[payload.takeSpaceId];
      if (give && take && give.ownerId === playerId && !take.ownerId) {
        give.ownerId = null;
        take.ownerId = playerId;
      }
      break;
    }

    case 'insider_trading': {
      const gives = payload.giveSpaceIds ?? [];
      const takes = payload.takeSpaceIds ?? [];
      if (gives.length === 2 && takes.length === 2) {
        const pGive1 = state.properties[gives[0]];
        const pGive2 = state.properties[gives[1]];
        const pTake1 = state.properties[takes[0]];
        const pTake2 = state.properties[takes[1]];
        if (pGive1?.ownerId === playerId && pGive2?.ownerId === playerId &&
            pTake1?.ownerId && pTake2?.ownerId && pTake1.ownerId === pTake2.ownerId && pTake1.ownerId !== playerId &&
            !isPartOfCompleteSet(state, takes[0]) && !isPartOfCompleteSet(state, takes[1])) {
          const oppId = pTake1.ownerId;
          pGive1.ownerId = oppId;
          pGive2.ownerId = oppId;
          pTake1.ownerId = playerId;
          pTake2.ownerId = playerId;
        }
      }
      break;
    }

    case 'train_heist': {
      const target = nextSpaceOfType(state, player.position, 'railroad');
      if (target != null) {
        moveTo(state, playerId, target, true);
        const prop = state.properties[target];
        if (!prop.ownerId) {
          prop.ownerId = playerId;
        } else if (prop.ownerId !== playerId) {
          const owner = playerById(state, prop.ownerId);
          const rent = 25;
          charge(state, owner.id, rent, say(state, 'reasonTheft'), playerId);
        }
      }
      break;
    }

    case 'stick_up':
      break;

    case 'snitch': {
      const targetOpponentId = payload.targetPlayerId;
      if (targetOpponentId) {
        sendToJail(state, targetOpponentId, 'super', playerId);
      }
      break;
    }
  }

  return { ok: true };
}

/** Joue une carte Super Corruption depuis sa main. */
export function playSuperCorruptionCard(state, playerId, cardId, payload = {}, rng = null) {
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };
  if (!player.superCorruptionCards?.includes(cardId)) return { ok: false, error: 'Vous ne possédez pas cette carte Super Corruption.' };

  const card = getCard(state, cardId);
  if (!card) return { ok: false, error: 'Carte inconnue.' };

  if (player.cardsDrawnTurn?.[cardId] === state.turnCount && !card.reaction) {
    return { ok: false, error: 'Une carte Super Corruption ne peut pas être jouée le tour où elle est piochée.' };
  }

  player.superCorruptionCards = player.superCorruptionCards.filter((id) => id !== cardId);
  if (player.superJailCollectedCards?.includes(cardId)) {
    player.superJailCollectedCards = player.superJailCollectedCards.filter((id) => id !== cardId);
  }
  (state.decks.super_corruption ??= []).push(cardId);

  const title = card.title ?? card.text ?? cardId;
  log(state, 'card', say(state, 'superCorruptionPlay', { name: player.name, title }), { playerId, cardId });

  broadcastAction(state, {
    type: 'card_played',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    cardId: card.id,
    title: card.title ?? card.text ?? card.id,
    text: card.text,
    cardType: 'super_corruption',
    category: 'super_corruption',
    actionType: card.action?.type,
  });

  switch (card.action?.type) {
    case 'auction_hoax': {
      const unowned = ownableSpaces(state).filter((s) => !state.properties[s.id]?.ownerId);
      if (unowned.length) {
        const chosen = payload.spaceId != null ? getSpace(state, payload.spaceId) : unowned[0];
        if (chosen && !state.properties[chosen.id]?.ownerId) {
          state.properties[chosen.id].ownerId = playerId;
          credit(state, playerId, chosen.price, say(state, 'reasonTheft'));
        }
      }
      break;
    }

    case 'identity_theft': {
      const targetOpponentId = payload.targetPlayerId;
      const target = playerById(state, targetOpponentId);
      if (target && !target.bankrupt) {
        const temp = player.cash;
        player.cash = target.cash;
        target.cash = temp;
      }
      break;
    }

    case 'good_ol_scam': {
      const targetSpaceId = payload.targetSpaceId;
      const prop = state.properties[targetSpaceId];
      if (prop && prop.ownerId && prop.ownerId !== playerId && !isPartOfCompleteSet(state, targetSpaceId) && player.cash >= 1) {
        player.cash -= 1;
        credit(state, prop.ownerId, 1, say(state, 'reasonTheft'));
        prop.ownerId = playerId;
      }
      break;
    }

    case 'caper': {
      for (const opp of activePlayers(state).filter((p) => p.id !== playerId)) {
        if (opp.cash >= 100) {
          opp.cash -= 100;
          player.cash += 100;
        } else {
          sendToJail(state, opp.id, 'super', playerId);
        }
      }
      break;
    }

    case 'blackmail': {
      if (payload.targetPlayerId) {
        charge(state, payload.targetPlayerId, 150, say(state, 'reasonTheft'), playerId);
      } else {
        for (const opp of activePlayers(state).filter((p) => p.id !== playerId)) {
          charge(state, opp.id, 50, say(state, 'reasonTheft'), playerId);
        }
      }
      break;
    }

    case 'shoplift': {
      for (const opp of activePlayers(state).filter((p) => p.id !== playerId)) {
        if (opp.corruptionCards?.length) {
          const stolenId = opp.corruptionCards.shift();
          player.corruptionCards.push(stolenId);
          player.cardsDrawnTurn[stolenId] = state.turnCount;
        }
      }
      break;
    }

    case 'greasy_palms': {
      const groupId = payload.groupId;
      const oppId = payload.targetPlayerId;
      if (groupId && oppId && player.cash >= 500) {
        const grp = getGroup(state, groupId);
        if (grp && ownsFullGroup(state, oppId, groupId)) {
          player.cash -= 500;
          credit(state, oppId, 500, say(state, 'reasonTheft'));
          for (const spId of grp.spaces) {
            state.properties[spId].ownerId = playerId;
          }
        }
      }
      break;
    }

    case 'obstructing_injustice':
      break;

    case 'robbery': {
      for (const p of activePlayers(state).filter((pl) => (pl.inJail || pl.superJail) && pl.id !== playerId)) {
        const owned = propertiesOf(state, p.id);
        if (owned.length) {
          const stolenProp = owned[0];
          stolenProp.ownerId = playerId;
        }
      }
      break;
    }

    case 'long_con': {
      const owned = propertiesOf(state, playerId);
      if (owned.length && state.bank.hotels > 0) {
        const target = payload.spaceId != null ? state.properties[payload.spaceId] : owned[0];
        if (target && target.ownerId === playerId && !target.hotel) {
          state.bank.houses += target.houses;
          target.houses = 0;
          target.hotel = true;
          state.bank.hotels -= 1;
        }
      }
      break;
    }

    case 'cook_the_books': {
      if (player.cash >= 1) {
        player.cash -= 1;
        credit(state, playerId, 500, say(state, 'reasonTheft'));
      }
      break;
    }

    case 'forgery': {
      const targetSpaceId = payload.targetSpaceId;
      const prop = state.properties[targetSpaceId];
      if (prop && prop.ownerId && prop.ownerId !== playerId) {
        prop.ownerId = playerId;
      }
      break;
    }
  }

  return { ok: true };
}

// — Actions de l'extension Tout Acheter (Buy Everything) —————————————

/**
 * Lance le dé d'Achat (6 faces).
 */
export function rollBuyDie(state, playerId, rng) {
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };

  const faces = BUY_DIE_FACES;
  const faceIndex = rng.int(faces.length);
  const face = faces[faceIndex];
  state.buyDie = { faceIndex, face, timestamp: Date.now() };

  broadcastAction(state, {
    type: 'buy_die_rolled',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    faceIndex,
    face,
  });

  if (face.type === 'buy_card') {
    log(state, 'card', say(state, 'rollsBuyCard', { name: player.name }), { playerId, face });
    const vault = state.saleVault?.visible ?? [];
    const maxHand = config(state).mechanics?.saleVault?.maxHand ?? 3;
    state.pending = {
      kind: 'buy_sale_card',
      playerIds: [playerId],
      payload: {
        visibleCards: vault,
        mustDiscardFirst: (player.saleCards?.length ?? 0) >= maxHand,
      },
    };
  } else if (face.type === 'force_discard') {
    log(state, 'card', say(state, 'rollsForceDiscard', { name: player.name }), { playerId, face });
    const victims = activePlayers(state).filter((p) => p.id !== playerId && (p.saleCards?.length ?? 0) > 0);
    if (victims.length > 0) {
      state.pending = {
        kind: 'force_discard_sale_card',
        playerIds: [playerId],
        payload: {
          victimIds: victims.map((v) => v.id),
        },
      };
    } else {
      state.pending = { kind: 'end_turn', playerIds: [playerId], payload: { canRollBuyDie: false } };
    }
  } else if (face.type === 'refresh_vault') {
    log(state, 'card', say(state, 'rollsRefreshVault', { name: player.name }), { playerId, face });
    const vault = state.saleVault?.visible ?? [];
    if (vault.length > 0) {
      state.pending = {
        kind: 'refresh_sale_vault',
        playerIds: [playerId],
        payload: {
          visibleCards: vault,
        },
      };
    } else {
      state.pending = { kind: 'end_turn', playerIds: [playerId], payload: { canRollBuyDie: false } };
    }
  }

  return { ok: true, face };
}

/**
 * Achète une carte Vente depuis le Coffre-Fort.
 */
export function buySaleCard(state, playerId, cardId, discardCardId = null) {
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };
  if (!state.saleVault?.visible?.includes(cardId)) {
    return { ok: false, error: "Cette carte n'est pas disponible dans le Coffre-Fort." };
  }
  const card = getCard(state, cardId);
  if (!card) return { ok: false, error: 'Carte inconnue.' };

  const price = card.price ?? 150;
  const ownsBank = player.saleCards?.some((cId) => getCard(state, cId)?.ability?.type === 'the_bank');

  if (!ownsBank && player.cash < price) {
    return { ok: false, error: 'Fonds insuffisants pour acheter cette carte Vente.' };
  }

  const maxHand = config(state).mechanics?.saleVault?.maxHand ?? 3;
  if ((player.saleCards?.length ?? 0) >= maxHand) {
    if (!discardCardId || !player.saleCards.includes(discardCardId)) {
      return { ok: false, error: 'Vous avez déjà 3 cartes Vente. Choisissez-en une à défausser d’abord.' };
    }
    player.saleCards = player.saleCards.filter((cId) => cId !== discardCardId);
    (state.decks.sale ??= []).push(discardCardId);
  }

  if (ownsBank) {
    log(state, 'card', say(state, 'theBankPaid', { name: player.name, amount: amountText(state, price) }), {
      playerId,
      amount: price,
    });
  } else {
    player.cash -= price;
    if (potCollects(state)) state.freeParkingPot += price;
  }

  state.saleVault.visible = state.saleVault.visible.filter((cId) => cId !== cardId);
  player.saleCards = player.saleCards ?? [];
  player.saleCards.push(cardId);
  player.saleCardsDrawnTurn = player.saleCardsDrawnTurn ?? {};
  player.saleCardsDrawnTurn[cardId] = state.turnCount;

  log(
    state,
    'card',
    say(state, 'buysSaleCard', { name: player.name, title: card.title ?? cardId, amount: amountText(state, price) }),
    { playerId, cardId, price },
  );

  broadcastAction(state, {
    type: 'sale_card_bought',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    cardId: card.id,
    title: card.title ?? card.text,
    text: card.text,
    price,
    cardType: card.cardType,
  });

  refillVault(state);
  checkSaleVictory(state);

  state.pending = { kind: 'end_turn', playerIds: [playerId], payload: { canRollBuyDie: false } };
  return { ok: true };
}

/**
 * Force une joueuse adverse à défausser l'une de ses cartes Vente.
 */
export function forceDiscardSaleCard(state, playerId, targetPlayerId, targetCardId) {
  const player = playerById(state, playerId);
  const target = playerById(state, targetPlayerId);
  if (!player || !target) return { ok: false, error: 'Joueuse inconnue.' };
  if (!target.saleCards?.includes(targetCardId)) {
    return { ok: false, error: 'La cible ne possède pas cette carte Vente.' };
  }
  const card = getCard(state, targetCardId);
  target.saleCards = target.saleCards.filter((cId) => cId !== targetCardId);
  (state.decks.sale ??= []).push(targetCardId);

  log(
    state,
    'card',
    say(state, 'forcedDiscard', {
      name: player.name,
      target: target.name,
      title: card?.title ?? targetCardId,
    }),
    { playerId, targetPlayerId, cardId: targetCardId },
  );

  broadcastAction(state, {
    type: 'force_discard_sale_card',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    targetPlayerId,
    targetPlayerName: target.name,
    targetCardId,
    cardTitle: card?.title ?? targetCardId,
  });

  state.pending = { kind: 'end_turn', playerIds: [playerId], payload: { canRollBuyDie: false } };
  return { ok: true };
}

/**
 * Renouvelle une carte du Coffre-Fort en la remettant sous la pioche.
 */
export function refreshSaleVault(state, playerId, cardIdToReplace) {
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };
  if (!state.saleVault?.visible?.includes(cardIdToReplace)) {
    return { ok: false, error: "Cette carte n'est pas dans le Coffre-Fort." };
  }
  state.saleVault.visible = state.saleVault.visible.filter((cId) => cId !== cardIdToReplace);
  (state.decks.sale ??= []).push(cardIdToReplace);
  refillVault(state);

  log(state, 'card', say(state, 'refreshedVault', { name: player.name }), { playerId, cardId: cardIdToReplace });

  broadcastAction(state, {
    type: 'refresh_sale_vault',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    replacedCardId: cardIdToReplace,
    cardTitle: getCard(state, cardIdToReplace)?.title ?? cardIdToReplace,
  });

  state.pending = { kind: 'end_turn', playerIds: [playerId], payload: { canRollBuyDie: false } };
  return { ok: true };
}

/**
 * Joue une carte Vente à usage unique.
 */
export function playSaleCard(state, playerId, cardId, payload = {}, rng = null) {
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };
  if (!player.saleCards?.includes(cardId)) {
    return { ok: false, error: 'Vous ne possédez pas cette carte Vente.' };
  }
  if (player.saleCardsDrawnTurn?.[cardId] === state.turnCount) {
    return { ok: false, error: 'Vous devez attendre le début de votre prochain tour pour utiliser cette carte Vente.' };
  }

  const card = getCard(state, cardId);
  if (!card) return { ok: false, error: 'Carte inconnue.' };
  if (card.cardType !== 'single_use' && !card.action) {
    return { ok: false, error: 'Cette carte est un pouvoir permanent et ne peut pas être jouée comme une action.' };
  }

  player.saleCards = player.saleCards.filter((cId) => cId !== cardId);
  (state.decks.sale ??= []).push(cardId);

  log(state, 'card', say(state, 'saleCardPlayed', { name: player.name, title: card.title ?? cardId }), {
    playerId,
    cardId,
  });

  broadcastAction(state, {
    type: 'card_played',
    actorId: playerId,
    actorName: player.name,
    actorColor: player.color,
    actorToken: player.token,
    cardId: card.id,
    title: card.title ?? card.text ?? card.id,
    text: card.text,
    cardType: card.cardType ?? 'single_use',
    category: 'sale',
    actionType: card.action?.type,
  });

  const act = card.action;
  if (act.type === 'collect') {
    credit(state, playerId, act.amount, say(state, 'reasonCard'));
  } else if (act.type === 'collect_from_each') {
    for (const opponent of activePlayers(state)) {
      if (opponent.id === playerId) continue;
      charge(state, opponent.id, act.amount, say(state, 'reasonTheft'), playerId);
    }
  } else if (act.type === 'get_out_of_jail_free') {
    player.getOutOfJailCards += 1;
  } else if (act.type === 'teleport') {
    const targetSpaceId = payload.spaceId ?? 0;
    moveTo(state, playerId, targetSpaceId, false);
    resolveLanding(state, playerId, {});
  } else if (act.type === 'swap_property') {
    const myProp = state.properties[payload.mySpaceId];
    const targetProp = state.properties[payload.targetSpaceId];
    if (myProp?.ownerId === playerId && targetProp?.ownerId && targetProp.ownerId !== playerId) {
      if (!ownsFullGroup(state, targetProp.ownerId, getSpace(state, payload.targetSpaceId)?.group)) {
        myProp.ownerId = targetProp.ownerId;
        targetProp.ownerId = playerId;
      }
    }
  } else if (act.type === 'discount_property') {
    player.nextPropertyDiscount = 0.5;
  } else if (act.type === 'shield') {
    player.rentWaivers = (player.rentWaivers ?? 0) + 1;
  } else if (act.type === 'double_rent') {
    player.doubleNextRent = true;
  }

  return { ok: true };
}

export { amountText };
