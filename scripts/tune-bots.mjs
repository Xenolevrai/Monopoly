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
import { PROFILES, DIFFICULTIES } from '../server/bots/profiles.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const LEVEL = flag('level', 'expert');
const ROUNDS = Number(flag('rounds', 10));
const GAMES = Number(flag('games', 50));
const MAX_STEPS = 5000;
// La graine de la marche : deux campagnes de graines différentes explorent des
// chemins différents, et se lancent donc en parallèle sans se répéter.
const SEED = Number(flag('seed', 20260820));

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
 * Les trois autres niveaux du catalogue : le champ où le profil réglé jouera
 * vraiment. **C'est le point qui a été corrigé ici, et il coûtait cher.**
 *
 * L'ancienne version faisait s'affronter le challenger et le tenant *entre eux*,
 * deux sièges chacun. Elle mesurait donc « bat-il son propre miroir ? », une
 * question voisine mais différente de « gagne-t-il la partie de famille ? ».
 * Mesuré : une campagne de 24 rondes remportées en duel (yieldToPrice 218 → 410)
 * a fait *baisser* l'expert de 38 % à 30,7 % au tournoi à quatre — sous le
 * difficile. Un réglage qui écrase un adversaire aussi vorace que soi peut être
 * mauvais contre un champ mêlé, et c'est le champ mêlé qu'on joue.
 */
const FIELD = DIFFICULTIES.filter((id) => id !== LEVEL).map((id) => PROFILES[id]);

/**
 * Une partie à quatre : `profile` occupe un siège, les trois autres niveaux du
 * catalogue occupent le reste. Renvoie ce que `profile` y marque — 3 points
 * pour la victoire, puis 2, 1, 0 selon le patrimoine final.
 *
 * ⚠️ **Pourquoi le rang et non la victoire.** Mesuré : un écart de ±10 % sur un
 * levier ne change *qui gagne* que sur une graine sur quarante. Comparer deux
 * réglages sur la seule victoire demandait donc des milliers de parties par
 * ronde pour sortir du bruit. Le rang, lui, bouge à presque chaque partie et
 * porte la même information — finir deuxième plutôt que troisième, c'est mieux
 * jouer. Le taux de victoire reste l'arbitre final : il se relit sur
 * `train-bots.mjs` une fois les réglages retenus.
 */
function fieldScore(profile, seed) {
  const game = createGame(`T${String(seed).padStart(5, '0')}`, 'p0', { seed, editionId: 'classic-fr' });
  const table = [profile, ...FIELD];
  // Sièges tournants : l'ordre de jeu donne à lui seul un avantage réel.
  const seats = table.map((_, i) => table[(i + seed) % table.length]);
  seats.forEach((_, i) => addPlayer(game, { id: `p${i}`, name: `B${i}`, token: null }));
  if (!startGame(game, 'p0').ok) return 0;

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
  return 3 - ranked.findIndex((r) => r.profile === profile);
}

/**
 * Comparaison **appariée** : à graine égale, on rejoue le même champ une fois
 * avec le challenger, une fois avec le tenant, et l'on ne regarde que l'écart
 * de rang. Le hasard des dés étant identique des deux côtés, il s'annule au
 * lieu de noyer le signal.
 *
 * Le verdict est un t de Student sur ces écarts : au-delà de deux, l'avance
 * cesse de s'expliquer par la chance.
 */
function winRate(challenger, holder, games) {
  const ecarts = [];
  let gagnees = 0;
  for (let seed = 1; seed <= games; seed++) {
    const c = fieldScore(challenger, seed);
    const h = fieldScore(holder, seed);
    ecarts.push(c - h);
    if (c === 3) gagnees += 1;
  }
  const n = ecarts.length;
  const moyenne = ecarts.reduce((a, b) => a + b, 0) / n;
  const variance = ecarts.reduce((sum, d) => sum + (d - moyenne) ** 2, 0) / Math.max(1, n - 1);
  const erreur = Math.sqrt(variance / n);
  return { rate: gagnees / n, gain: moyenne, sigma: erreur > 0 ? moyenne / erreur : 0 };
}

/** Secoue un ou deux leviers au hasard. */
function mutate(profile, rng) {
  const next = { ...profile };
  const keys = Object.keys(KNOBS);
  const count = 1 + (rng.next() < 0.4 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const key = keys[Math.floor(rng.next() * keys.length)];
    const spread = KNOBS[key];
    // Le pas est **franc**, jamais tiède : l'amplitude est tirée dans la moitié
    // haute de l'écart permis. Une secousse de 3 % ne change l'issue d'aucune
    // partie sur quarante — elle produisait des rondes à 0,0σ où le tenant
    // gagnait par défaut, faute d'avoir été mis à l'épreuve.
    const sens = rng.next() < 0.5 ? -1 : 1;
    const ampleur = spread / 2 + rng.next() * (spread / 2);
    // `tradeMargin` peut être négatif : on le décale, on ne le multiplie pas.
    next[key] = key === 'tradeMargin'
      ? Number((profile[key] + sens * (0.02 + rng.next() * 0.05)).toFixed(3))
      : Number(Math.max(0, profile[key] * (1 + sens * ampleur)).toFixed(3));
  }
  return next;
}

console.log(`Réglage de « ${LEVEL} » — ${ROUNDS} rondes de ${GAMES} parties (graine ${SEED})`);
console.log('Chaque graine est jouée deux fois — une avec le challenger, une avec le');
console.log('tenant — et l\'on compare les rangs obtenus. Il faut deux écarts-types');
console.log('d\'avance : en dessous, c\'est le hasard des dés.\n');

const rng = createRng(SEED);
let best = { ...PROFILES[LEVEL] };
let improvements = 0;

for (let round = 1; round <= ROUNDS; round++) {
  const challenger = mutate(best, rng);
  const { rate, gain, sigma } = winRate(challenger, best, GAMES);
  const changed = Object.keys(KNOBS).filter((k) => challenger[k] !== best[k]);
  const detail = `${changed.map((k) => `${k} ${best[k]}→${challenger[k]}`).join(', ')}`;

  if (sigma > 2) {
    best = challenger;
    improvements += 1;
    console.log(`ronde ${String(round).padStart(2)} : ✅ ${(rate * 100).toFixed(0)}% de victoires, ${gain >= 0 ? '+' : ''}${gain.toFixed(2)} rang (${sigma.toFixed(1)}σ)  ${detail}`);
  } else {
    console.log(`ronde ${String(round).padStart(2)} : ·  ${(rate * 100).toFixed(0)}% de victoires, ${gain >= 0 ? '+' : ''}${gain.toFixed(2)} rang (${sigma.toFixed(1)}σ)  ${detail}`);
  }
}

console.log(`\n${improvements} amélioration(s) retenue(s). Réglages pour profiles.js :\n`);
for (const key of Object.keys(KNOBS)) {
  const before = PROFILES[LEVEL][key];
  const mark = best[key] === before ? '  ' : '→ ';
  console.log(`  ${mark}${key}: ${best[key]},${best[key] === before ? '' : `   // était ${before}`}`);
}
