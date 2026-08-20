/**
 * Les bots : légalité, terminaison, et hiérarchie des niveaux.
 *
 * Trois choses à prouver. D'abord qu'un bot ne produit **que des actions
 * légales** — il passe par `dispatch` comme une humaine, donc une action
 * refusée est un défaut de jugement, pas une triche. Ensuite qu'une partie
 * entre bots **se termine** : c'est le piège de ce genre de code, deux bots qui
 * se reproposent le même marché à l'infini (déjà arrivé, d'où le test).
 * Enfin que l'échelle de difficulté **tient statistiquement**.
 *
 * Le classement fin se mesure dans `scripts/train-bots.mjs`, sur des milliers
 * de parties ; ici on se contente d'un échantillon rapide mais net.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame, addPlayer, startGame, dispatch } from '../server/engine/index.js';
import { createRng } from '../server/engine/rng.js';
import { activePlayers, netWorth } from '../server/engine/queries.js';
import { decideAction, answerPendingTrade } from '../server/bots/brain.js';
import { DIFFICULTIES, profileOf, PROFILES } from '../server/bots/profiles.js';
import { spaceWorth, groupStatus } from '../server/bots/evaluate.js';
import { landingOdds } from '../server/bots/odds.js';
import { EDITIONS } from '../shared/editions.js';
import { EXTENSIONS } from '../shared/extensions.js';

/** Joue une partie entière entre bots, en surveillant chaque action. */
function playBotGame(lineup, seed, { editionId = 'classic-fr', extensionIds = [], maxSteps = 5000, onAction } = {}) {
  const game = createGame(`BOT${String(seed).padStart(3, '0')}`, 'p0', { seed, editionId, extensionIds });
  lineup.forEach((level, i) => addPlayer(game, { id: `p${i}`, name: `B${i}`, token: null }));
  assert.ok(startGame(game, 'p0').ok);

  const rng = createRng(seed * 17 + 3);
  const levelOf = Object.fromEntries(lineup.map((d, i) => [`p${i}`, d]));
  let steps = 0;

  while (game.state.phase === 'playing' && steps < maxSteps) {
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
    onAction?.(action, result, game.state);
    steps += 1;
  }

  const ranked = game.state.players
    .map((p) => ({ level: levelOf[p.id], bankrupt: p.bankrupt, worth: netWorth(game.state, p.id) }))
    .sort((a, b) => (a.bankrupt === b.bankrupt ? b.worth - a.worth : a.bankrupt ? 1 : -1));

  return { game, ranked, steps, finished: game.state.phase === 'finished' };
}

test('les quatre niveaux existent et déclarent tous les mêmes leviers', () => {
  assert.deepEqual(DIFFICULTIES, ['facile', 'moyen', 'difficile', 'expert']);
  const keys = Object.keys(PROFILES.expert).sort();
  for (const level of DIFFICULTIES) {
    assert.deepEqual(Object.keys(PROFILES[level]).sort(), keys, `${level} : leviers différents`);
  }
  // L'imperfection doit décroître avec le niveau, sinon l'échelle n'a pas de sens.
  for (let i = 1; i < DIFFICULTIES.length; i++) {
    const weak = profileOf(DIFFICULTIES[i - 1]);
    const strong = profileOf(DIFFICULTIES[i]);
    assert.ok(strong.noise <= weak.noise, `${strong.id} devrait juger au moins aussi bien`);
    assert.ok(strong.blunderRate <= weak.blunderRate, `${strong.id} devrait moins se tromper`);
  }
});

test('un bot ne propose jamais une action refusée par le moteur', () => {
  const refusals = [];
  playBotGame(['expert', 'difficile', 'moyen', 'facile'], 7, {
    onAction: (action, result) => {
      // Une enchère ou une construction peut légitimement échouer sur une course
      // (une autre a bâti entre-temps) : on tolère ces deux-là, pas le reste.
      if (!result.ok && !['AUCTION_BID', 'BUILD_HOUSE'].includes(action.type)) {
        refusals.push(`${action.type} : ${result.error}`);
      }
    },
  });
  assert.deepEqual(refusals, [], 'un bot a tenté une action illégale');
});

test('une partie entre bots se termine, elle ne tourne pas en rond', () => {
  // Le défaut à empêcher : deux bots qui se reproposent le même marché sans fin.
  for (const seed of [3, 11, 29]) {
    const { finished, steps } = playBotGame(['expert', 'moyen', 'difficile', 'facile'], seed);
    assert.ok(finished, `graine ${seed} : partie non terminée après ${steps} étapes`);
  }
});

test('les bots savent négocier : des échanges se concluent vraiment', () => {
  let accepted = 0;
  for (const seed of [3, 11, 29]) {
    const { game } = playBotGame(['expert', 'difficile', 'expert', 'difficile'], seed);
    accepted += game.state.trades.filter((t) => t.status === 'accepted').length;
  }
  assert.ok(accepted > 0, 'aucun échange conclu sur trois parties : la négociation ne sert à rien');
});

test("l'expert bat le facile nettement", () => {
  let expert = 0;
  let facile = 0;
  for (let seed = 1; seed <= 14; seed++) {
    // On alterne les sièges : la place à table ne doit pas décider.
    const lineup = seed % 2 ? ['expert', 'facile'] : ['facile', 'expert'];
    const { ranked } = playBotGame(lineup, seed);
    if (ranked[0].level === 'expert') expert += 1;
    else facile += 1;
  }
  assert.ok(expert > facile * 2, `expert ${expert} / facile ${facile} : l'écart n'est pas net`);
});

test('les bots jouent toutes les boîtes et toutes les extensions', () => {
  // Le vrai test de « connaît les règles » : chaque édition et chaque extension
  // pose des invites différentes (raccourcis de toile, coffre des ventes, geôle
  // sévère, points de maison sans hypothèque). Un bot doit les traiter toutes,
  // sans jamais rester sans réponse ni s'entêter sur une action refusée.
  const combos = [
    ...Object.keys(EDITIONS).map((id) => [id, []]),
    ...Object.keys(EXTENSIONS).map((ext) => ['classic-fr', [ext]]),
    ['classic-fr', ['go-to-jail', 'buy-everything']],
  ];

  for (const [editionId, extensionIds] of combos) {
    const label = `${editionId}${extensionIds.length ? ` + ${extensionIds.join('+')}` : ''}`;
    const refusals = [];
    const { finished } = playBotGame(['expert', 'difficile', 'moyen', 'facile'], 12, {
      editionId,
      extensionIds,
      onAction: (action, result) => {
        if (!result.ok && !['AUCTION_BID', 'BUILD_HOUSE'].includes(action.type)) {
          refusals.push(`${action.type} : ${result.error}`);
        }
      },
    });
    assert.equal(refusals.length, 0, `${label} : ${refusals[0]}`);
    assert.ok(finished, `${label} : la partie ne s'est pas terminée`);
  }
});

test('la carte des probabilités retrouve seule les points chauds du plateau', () => {
  const game = createGame('ODDS01', 'h', { seed: 1, editionId: 'classic-fr' });
  const odds = landingOdds(game.state);
  assert.equal(odds.length, 40);
  assert.ok(Math.abs(odds.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'la somme doit faire 1');

  // La prison est le puits du plateau, et l'orange (16, 18, 19) profite d'être
  // à un jet de dés de sa sortie : c'est le résultat connu du Monopoly, retrouvé
  // ici par simple marche aléatoire, sans table écrite à la main.
  const hottest = odds.indexOf(Math.max(...odds));
  assert.equal(hottest, 10, 'la case la plus visitée doit être la prison');
  assert.ok(odds[16] > odds[39], "l'orange doit être plus visité que la rue de la Paix");
  assert.ok(odds[18] > odds[37], "l'orange doit être plus visité que le bleu foncé");
});

test('un bot fort valorise le terrain qui ferme un groupe', () => {
  const game = createGame('WORTH1', 'h', { seed: 5, editionId: 'classic-fr' });
  addPlayer(game, { id: 'p0', name: 'A', token: null });
  addPlayer(game, { id: 'p1', name: 'B', token: null });
  startGame(game, 'p0');

  const expert = profileOf('expert');
  const seul = spaceWorth(game.state, 19, 'p0', expert);

  // On lui donne les deux autres oranges : la troisième doit valoir bien plus.
  game.state.properties[16].ownerId = 'p0';
  game.state.properties[18].ownerId = 'p0';
  const ferme = spaceWorth(game.state, 19, 'p0', expert);

  assert.ok(ferme > seul * 1.5, `fermer le groupe doit peser (${seul} → ${ferme})`);
  const status = groupStatus(game.state, 'orange', 'p0');
  assert.equal(status.mine, 2);
  assert.equal(status.free, 1);
});

test('un bot faible ne voit pas le blocage, un expert le paie', () => {
  const game = createGame('BLOCK1', 'h', { seed: 5, editionId: 'classic-fr' });
  addPlayer(game, { id: 'p0', name: 'A', token: null });
  addPlayer(game, { id: 'p1', name: 'B', token: null });
  startGame(game, 'p0');

  // L'adversaire tient deux oranges : la troisième vaut d'être prise pour la lui refuser.
  game.state.properties[16].ownerId = 'p1';
  game.state.properties[18].ownerId = 'p1';

  const pourExpert = spaceWorth(game.state, 19, 'p0', profileOf('expert'));
  const pourFacile = spaceWorth(game.state, 19, 'p0', profileOf('facile'));
  assert.ok(pourExpert > pourFacile, "l'expert doit payer plus cher pour bloquer");
});
