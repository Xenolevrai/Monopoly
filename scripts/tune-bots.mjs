/**
 * Régler les bots par auto-jeu.
 *
 * L'entraînement, ici, c'est de l'optimisation de paramètres contre des données
 * réelles : on prend un profil, on secoue ses réglages, on fait jouer la
 * variante contre la version en place sur des centaines de parties, et l'on
 * garde ce qui gagne. C'est une montée de colline (« hill climbing ») — lente
 * mais honnête, et surtout **lisible** : le résultat est une poignée de nombres
 * qu'on peut relire, comprendre et corriger à la main, là où un réseau de
 * neurones ne laisserait qu'une boîte noire impossible à doser en quatre
 * niveaux.
 *
 *   node scripts/tune-bots.mjs --level expert --rounds 12 --games 60
 *
 * Les réglages retenus s'affichent à la fin, à recopier dans `profiles.js`.
 */
import { createGame, addPlayer, startGame, dispatch } from '../server/engine/index.js';
import { createRng } from '../server/engine/rng.js';
import { netWorth, activePlayers } from '../server/engine/queries.js';
import { decideAction, answerPendingTrade } from '../server/bots/brain.js';
import { PROFILES } from '../server/bots/profiles.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const LEVEL = flag('level', 'expert');
const ROUNDS = Number(flag('rounds', 10));
const GAMES = Number(flag('games', 50));
const MAX_STEPS = 5000;

/** Les leviers qu'on secoue, et de combien on ose les bouger. */
const KNOBS = {
  yieldToPrice: 0.25,
  completesGroup: 0.2,
  nearlyGroup: 0.2,
  deadGroup: 0.2,
  blockRival: 0.3,
  cashReserve: 0.3,
  bidCeiling: 0.15,
  tradeMargin: 0.5,
  mortgagePenalty: 0.3,
};

/**
 * Une partie entre deux profils donnés en objets (pas en identifiants) : c'est
 * ce qui permet de faire jouer une variante qui n'existe pas dans le catalogue.
 */
function duel(profileA, profileB, seed) {
  const game = createGame(`T${String(seed).padStart(5, '0')}`, 'p0', { seed, editionId: 'classic-fr' });
  const seats = seed % 2 ? [profileA, profileB, profileA, profileB] : [profileB, profileA, profileB, profileA];
  seats.forEach((_, i) => addPlayer(game, { id: `p${i}`, name: `B${i}`, token: null }));
  if (!startGame(game, 'p0').ok) return null;

  const rng = createRng(seed * 29 + 5);
  const profileOfSeat = Object.fromEntries(seats.map((p, i) => [`p${i}`, p]));
  let steps = 0;
  let stuck = 0;

  while (game.state.phase === 'playing' && steps < MAX_STEPS) {
    let answered = false;
    for (const player of activePlayers(game.state)) {
      const reply = answerPendingTrade(game.state, player.id, profileOfSeat[player.id]);
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
    const action = decideAction(game.state, playerId, rng, profileOfSeat[playerId]);
    if (!action) break;
    if (!dispatch(game, playerId, action).ok) {
      stuck += 1;
      if (stuck > 3) {
        dispatch(game, playerId, game.state.pending.kind === 'end_turn' ? { type: 'END_TURN' } : { type: 'DECLARE_BANKRUPTCY' });
        stuck = 0;
      }
    } else stuck = 0;
    steps += 1;
  }

  const ranked = game.state.players
    .map((p) => ({ profile: profileOfSeat[p.id], bankrupt: p.bankrupt, worth: netWorth(game.state, p.id) }))
    .sort((a, b) => (a.bankrupt === b.bankrupt ? b.worth - a.worth : a.bankrupt ? 1 : -1));
  return ranked[0].profile;
}

/** Le taux de victoire du challenger contre le tenant, sur `games` parties. */
function winRate(challenger, holder, games) {
  let wins = 0;
  for (let seed = 1; seed <= games; seed++) {
    if (duel(challenger, holder, seed) === challenger) wins += 1;
  }
  return wins / games;
}

/** Secoue un ou deux leviers au hasard. */
function mutate(profile, rng) {
  const next = { ...profile };
  const keys = Object.keys(KNOBS);
  const count = 1 + (rng.next() < 0.4 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const key = keys[Math.floor(rng.next() * keys.length)];
    const spread = KNOBS[key];
    const factor = 1 + (rng.next() * 2 - 1) * spread;
    // `tradeMargin` peut être négatif : on le décale, on ne le multiplie pas.
    next[key] = key === 'tradeMargin'
      ? Number((profile[key] + (rng.next() * 2 - 1) * 0.05).toFixed(3))
      : Number(Math.max(0, profile[key] * factor).toFixed(3));
  }
  return next;
}

console.log(`Réglage de « ${LEVEL} » — ${ROUNDS} rondes de ${GAMES} parties`);
console.log('Un challenger ne l\'emporte que s\'il bat le tenant à plus de 53 % :');
console.log('en dessous, l\'écart se confond avec le bruit.\n');

const rng = createRng(20260820);
let best = { ...PROFILES[LEVEL] };
let improvements = 0;

for (let round = 1; round <= ROUNDS; round++) {
  const challenger = mutate(best, rng);
  const rate = winRate(challenger, best, GAMES);
  const changed = Object.keys(KNOBS).filter((k) => challenger[k] !== best[k]);
  const detail = changed.map((k) => `${k} ${best[k]}→${challenger[k]}`).join(', ');

  if (rate > 0.53) {
    best = challenger;
    improvements += 1;
    console.log(`ronde ${String(round).padStart(2)} : ✅ ${(rate * 100).toFixed(0)}%  ${detail}`);
  } else {
    console.log(`ronde ${String(round).padStart(2)} : ·  ${(rate * 100).toFixed(0)}%  ${detail}`);
  }
}

console.log(`\n${improvements} amélioration(s) retenue(s). Réglages pour profiles.js :\n`);
for (const key of Object.keys(KNOBS)) {
  const before = PROFILES[LEVEL][key];
  const mark = best[key] === before ? '  ' : '→ ';
  console.log(`  ${mark}${key}: ${best[key]},${best[key] === before ? '' : `   // était ${before}`}`);
}
