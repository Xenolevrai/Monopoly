/**
 * Entraînement par auto-jeu.
 *
 * Il n'y a pas de réseau de neurones ici, et c'est délibéré : ce qu'on veut
 * n'est pas un modèle opaque, mais quatre niveaux **séparables et réglables**.
 * L'entraînement consiste donc à faire s'affronter les profils sur des milliers
 * de parties, à mesurer les taux de victoire, et à vérifier — ou corriger — que
 * l'échelle tient : expert > difficile > moyen > facile.
 *
 *   node scripts/train-bots.mjs                 # tournoi de contrôle
 *   node scripts/train-bots.mjs --games 2000    # plus de parties, moins de bruit
 *   node scripts/train-bots.mjs --duel expert:facile
 *
 * Une partie complète se joue sans interface ni serveur : le moteur suffit.
 */
import { createGame, addPlayer, startGame, dispatch } from '../server/engine/index.js';
import { createRng } from '../server/engine/rng.js';
import { netWorth, activePlayers } from '../server/engine/queries.js';
import { decideAction, answerPendingTrade } from '../server/bots/brain.js';
import { DIFFICULTIES } from '../server/bots/profiles.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const GAMES = Number(flag('games', 400));
const MAX_STEPS = Number(flag('steps', 6000));
const EDITION = flag('edition', 'classic-fr');

/**
 * Joue une partie entière entre bots et renvoie le classement.
 * @param {string[]} lineup les niveaux, dans l'ordre des sièges
 */
export function playMatch(lineup, seed, editionId = EDITION) {
  const game = createGame(`B${String(seed).padStart(5, '0')}`, 'p0', { seed, editionId });
  lineup.forEach((difficulty, i) => {
    addPlayer(game, { id: `p${i}`, name: `${difficulty[0].toUpperCase()}${i}`, token: null });
  });
  const started = startGame(game, 'p0');
  if (!started.ok) throw new Error(started.error);

  const rng = createRng(seed * 31 + 7);
  const levelOf = Object.fromEntries(lineup.map((d, i) => [`p${i}`, d]));
  let steps = 0;
  let stuck = 0;

  while (game.state.phase === 'playing' && steps < MAX_STEPS) {
    // Les échanges reçus se répondent hors tour : on les traite d'abord, sinon
    // une offre en attente bloquerait la partie.
    let answered = false;
    for (const player of activePlayers(game.state)) {
      const reply = answerPendingTrade(game.state, player.id, levelOf[player.id]);
      if (reply) {
        dispatch(game, player.id, reply);
        answered = true;
        break;
      }
    }
    if (answered) {
      steps += 1;
      continue;
    }

    const playerId = game.state.pending.playerIds[0];
    if (!playerId) break;
    const action = decideAction(game.state, playerId, rng, levelOf[playerId]);
    if (!action) break;

    const result = dispatch(game, playerId, action);
    if (!result.ok) {
      // Un refus est permis (mise trop basse, construction impossible) : on
      // retombe sur l'action neutre plutôt que de tourner en rond.
      stuck += 1;
      if (stuck > 3) {
        const fallback = game.state.pending.kind === 'end_turn' ? { type: 'END_TURN' } : { type: 'DECLARE_BANKRUPTCY' };
        dispatch(game, playerId, fallback);
        stuck = 0;
      }
    } else {
      stuck = 0;
    }
    steps += 1;
  }

  // Classement : les survivantes d'abord, départagées au patrimoine.
  const ranked = game.state.players
    .map((p) => ({ id: p.id, level: levelOf[p.id], bankrupt: p.bankrupt, worth: netWorth(game.state, p.id) }))
    .sort((a, b) => (a.bankrupt === b.bankrupt ? b.worth - a.worth : a.bankrupt ? 1 : -1));

  return { ranked, steps, finished: game.state.phase === 'finished' };
}

/** Fait tourner un tableau de rencontres et agrège les résultats. */
function tournament(lineup, games) {
  const wins = Object.fromEntries(lineup.map((d) => [d, 0]));
  const played = Object.fromEntries(lineup.map((d) => [d, 0]));
  let unfinished = 0;

  for (let seed = 1; seed <= games; seed++) {
    // On fait tourner les sièges : la place à table ne doit pas décider.
    const rotated = lineup.map((_, i) => lineup[(i + seed) % lineup.length]);
    const { ranked, finished } = playMatch(rotated, seed);
    if (!finished) unfinished += 1;
    for (const level of rotated) played[level] += 1;
    wins[ranked[0].level] += 1;
  }

  return { wins, played, unfinished };
}

function report(title, lineup, games) {
  const started = Date.now();
  const { wins, played, unfinished } = tournament(lineup, games);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\n${title}  —  ${games} parties en ${seconds}s`);
  console.log('─'.repeat(58));
  const order = [...new Set(lineup)];
  for (const level of order) {
    const share = (wins[level] / games) * 100;
    const expected = (played[level] / lineup.length / games) * 100;
    const bar = '█'.repeat(Math.round(share / 2));
    console.log(
      `${level.padEnd(10)} ${String(wins[level]).padStart(4)} victoires  ${share.toFixed(1).padStart(5)}%  ` +
      `(hasard : ${expected.toFixed(1)}%)  ${bar}`,
    );
  }
  if (unfinished) console.log(`⚠️  ${unfinished} partie(s) non terminées dans la limite de pas`);
  return wins;
}

const duel = flag('duel', null);
if (duel) {
  const [a, b] = duel.split(':');
  report(`Duel ${a} contre ${b}`, [a, b, a, b], GAMES);
} else {
  report('Tournoi des quatre niveaux', DIFFICULTIES, GAMES);
  report('Expert contre Facile', ['expert', 'facile', 'expert', 'facile'], Math.round(GAMES / 2));
  report('Difficile contre Moyen', ['difficile', 'moyen', 'difficile', 'moyen'], Math.round(GAMES / 2));
}
