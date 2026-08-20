/**
 * Faire jouer les bots, à un rythme qu'on peut suivre des yeux.
 *
 * Le moteur ne sait pas ce qu'est un bot, et ce fichier est la seule raison
 * pour laquelle il n'a pas besoin de le savoir : quand `state.pending` désigne
 * une joueuse artificielle, on attend un instant, on lui demande son coup, et
 * on le passe par `dispatch` comme celui de n'importe qui.
 *
 * Deux choses comptent ici, et aucune n'est du Monopoly :
 *  - **le rythme** : un bot qui joue instantanément donne l'impression d'un
 *    bug. On laisse le temps de voir les dés rouler et la case s'allumer ;
 *  - **ne jamais se marcher dessus** : une seule échéance par partie, annulée
 *    et reprogrammée à chaque changement d'état. Sans ça, deux coups partent
 *    en même temps et l'un des deux se fait refuser.
 */
import { dispatch } from '../engine/index.js';
import { activePlayers } from '../engine/queries.js';
import { createRng } from '../engine/rng.js';
import { decideAction, answerPendingTrade } from './brain.js';

/** Le temps de réflexion affiché, selon ce qu'on vient de décider. */
const DELAYS = {
  roll: 900,
  reroll: 800,
  buy_or_auction: 1100,
  auction_bid: 700,
  draw_card: 900,
  card_reveal: 1600, // on laisse lire la carte
  card_choice: 1200,
  pay_debt: 900,
  end_turn: 700,
  trade: 1300, // répondre à une offre : on simule qu'on réfléchit
};

/** Une échéance par partie, pour ne jamais jouer deux coups à la fois. */
const timers = new Map();

/** Les générateurs des bots, un par partie : les décisions restent reproductibles. */
const generators = new Map();

function rngFor(code) {
  if (!generators.has(code)) generators.set(code, createRng(Date.now() ^ [...code].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)));
  return generators.get(code);
}

/** La joueuse artificielle dont c'est le tour de décider, s'il y en a une. */
function botToPlay(state) {
  const pending = state.pending;
  if (!pending?.kind) return null;
  for (const playerId of pending.playerIds) {
    const player = state.players.find((p) => p.id === playerId);
    if (player?.bot && !player.bankrupt) return player;
  }
  return null;
}

/** Un bot à qui l'on a proposé un échange et qui doit répondre. */
function botToAnswer(state) {
  if (!state.trades?.length) return null;
  for (const player of activePlayers(state)) {
    if (!player.bot) continue;
    if (state.trades.some((t) => t.status === 'pending' && t.toPlayerId === player.id)) return player;
  }
  return null;
}

/**
 * Programme le prochain coup d'un bot, s'il y en a un à jouer.
 *
 * À rappeler après **chaque** changement d'état — c'est ce qui enchaîne les
 * tours : un bot joue, l'état change, on repasse ici, et le bot suivant est
 * programmé. Une partie de quatre bots se déroule ainsi toute seule.
 *
 * @param {{state: object}} room
 * @param {(room: object) => void} onPlayed appelée après chaque coup joué
 */
export function scheduleBots(room, onPlayed) {
  const code = room.state.code;
  clearTimeout(timers.get(code));
  timers.delete(code);

  if (room.state.phase !== 'playing') return;

  // Répondre à une offre passe avant : une proposition en attente bloque la
  // partie tant que personne ne tranche.
  const answering = botToAnswer(room.state);
  const deciding = answering ? null : botToPlay(room.state);
  const player = answering ?? deciding;
  if (!player) return;

  const delay = answering ? DELAYS.trade : (DELAYS[room.state.pending.kind] ?? 800);

  const timer = setTimeout(() => {
    timers.delete(code);
    // L'état a pu changer pendant l'attente (une humaine a agi) : on revérifie
    // plutôt que de jouer un coup calculé sur une position périmée.
    const stillThere = room.state.players.find((p) => p.id === player.id);
    if (!stillThere?.bot || room.state.phase !== 'playing') return;

    const action = answering
      ? answerPendingTrade(room.state, player.id, player.bot)
      : decideAction(room.state, player.id, rngFor(code), player.bot);

    if (action) {
      const result = dispatch(room, player.id, action);
      // Un refus ne doit jamais figer la partie : on retombe sur l'action
      // neutre de l'invite en cours plutôt que de laisser le bot bloqué.
      if (!result.ok && room.state.pending?.kind === 'end_turn') {
        dispatch(room, player.id, { type: 'END_TURN' });
      }
      onPlayed?.(room);
    }

    // Coup suivant : c'est cette relance qui déroule la partie.
    scheduleBots(room, onPlayed);
  }, delay);

  timers.set(code, timer);
}

/** Arrête les bots d'une partie (fin de partie, salle supprimée). */
export function stopBots(code) {
  clearTimeout(timers.get(code));
  timers.delete(code);
  generators.delete(code);
}

/** Y a-t-il au moins une joueuse artificielle dans cette partie ? */
export function hasBots(state) {
  return state.players.some((p) => p.bot);
}
