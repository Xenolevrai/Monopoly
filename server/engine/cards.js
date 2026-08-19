/**
 * Piles Chance et Caisse de Communauté.
 *
 * Une pile est une file d'identifiants : on pioche en tête, on remet en queue —
 * c'est littéralement la règle « remettre la carte sous la pile ». Les deux
 * cartes « libérée de prison » quittent la file tant qu'une joueuse les détient.
 */
import { cardsOf, getEdition } from '../../shared/index.js';
import { log, euros } from './log.js';
import { playerById, buildingsOf, activePlayers } from './queries.js';
import { credit, charge } from './money.js';
import { advance, moveTo, sendToJail, resolveLanding } from './movement.js';

const DECKS = ['chance', 'community_chest'];

/** Index des cartes par identifiant, calculé une fois par édition. */
const INDEX_CACHE = new Map();

function cardIndex(state) {
  const editionId = state.editionId ?? 'classic-fr';
  if (!INDEX_CACHE.has(editionId)) {
    const decks = cardsOf(state);
    INDEX_CACHE.set(
      editionId,
      Object.fromEntries(
        DECKS.flatMap((deck) => (decks[deck] ?? []).map((card) => [card.id, { ...card, deck }])),
      ),
    );
  }
  return INDEX_CACHE.get(editionId);
}

/** Le nom que cette édition donne à chaque pile. */
function deckLabel(state, deck) {
  return getEdition(state.editionId).theming?.decks?.[deck]?.label ?? deck;
}

export function getCard(state, cardId) {
  return cardIndex(state)[cardId];
}

/** Mélange les piles au début de la partie. */
export function buildDecks(state, rng) {
  const decks = cardsOf(state);
  for (const deck of DECKS) {
    state.decks[deck] = rng.shuffle((decks[deck] ?? []).map((c) => c.id));
  }
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
  log(state, 'card', `${player.name} pioche une carte ${deckLabel(state, deck)} : « ${card.text} »`, {
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
export function applyRevealedCard(state, playerId) {
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
  applyCardAction(state, playerId, card.action, { diceTotal: payload.diceTotal ?? 0 });
  return { ok: true, card };
}

/** Remet une carte « libérée de prison » sous sa pile après usage. */
export function returnJailCard(state, playerId) {
  const player = playerById(state, playerId);
  if (player.getOutOfJailCards <= 0) return false;
  player.getOutOfJailCards -= 1;
  const decks = cardsOf(state);
  for (const deck of DECKS) {
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
      credit(state, playerId, action.amount, 'carte');
      return;

    case 'pay':
      charge(state, playerId, action.amount, 'carte');
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

    case 'go_to_jail':
      sendToJail(state, playerId);
      return;

    case 'pay_per_building': {
      const { houses, hotels } = buildingsOf(state, playerId);
      const total = houses * action.perHouse + hotels * action.perHotel;
      if (total === 0) {
        log(state, 'card', `${player.name} n'a aucune construction : rien à payer.`, { playerId });
        return;
      }
      charge(state, playerId, total, `réparations (${houses} maison(s), ${hotels} hôtel(s))`);
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
      log(state, 'card', `${player.name} conserve une carte « libérée de prison ».`, { playerId });
      return;

    case 'draw_card':
      drawCard(state, playerId, action.deck, ctx);
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
      log(state, 'error', `Effet de carte inconnu : ${action.type}`, { action });
  }
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
    charge(state, payerId, amount, 'anniversaire', collectorId);
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
  log(state, 'card', `${playerById(state, playerId).name} choisit : ${label}.`, { playerId, optionIndex });
  state.pending = { kind: null, playerIds: [] };
  applyCardAction(state, playerId, action, ctx);
  return { ok: true };
}

export { euros };
