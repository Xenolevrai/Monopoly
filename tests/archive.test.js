/**
 * L'archive des parties jouées.
 *
 * Ce qu'on veut prouver : une partie terminée laisse une trace complète et
 * relisible, contenant non seulement ce qui s'est passé mais **ce que chaque
 * joueuse voyait au moment de décider**. Sans ça, l'archive raconte une
 * histoire mais n'apprend rien.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Le dossier d'archive est lu à l'import du module : on le détourne avant.
const TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'monopoly-archives-'));
process.env.MONOPOLY_ARCHIVE_DIR = TMP;

const { archiveGame, ARCHIVE_DIR } = await import('../server/archive.js');
const { createGame, addPlayer, startGame, dispatch } = await import('../server/engine/index.js');
const { decideAction } = await import('../server/bots/brain.js');
const { createRng } = await import('../server/engine/rng.js');

/** Fait jouer une partie entière entre bots et renvoie la partie terminée. */
function playToTheEnd(seed = 4) {
  const game = createGame('ARCH01', 'p0', { seed, editionId: 'classic-fr' });
  ['expert', 'facile'].forEach((level, i) =>
    addPlayer(game, { id: `p${i}`, name: `B${i}`, token: null, bot: level }),
  );
  startGame(game, 'p0');

  const rng = createRng(seed + 1);
  for (let step = 0; step < 6000 && game.state.phase === 'playing'; step++) {
    const actor = game.state.pending.playerIds?.[0];
    if (!actor) break;
    const action = decideAction(game.state, actor, rng, game.state.players.find((p) => p.id === actor).bot);
    if (!action) break;
    dispatch(game, actor, action);
  }
  return game;
}

test("la graine d'une partie est conservée : une archive doit être rejouable", () => {
  const game = createGame('SEED01', 'p0', { seed: 123456, editionId: 'classic-fr' });
  assert.equal(game.seed, 123456);
  // Sans graine explicite on en prend une, mais on la garde quand même.
  assert.equal(typeof createGame('SEED02', 'p0', {}).seed, 'number');
});

test('chaque action acceptée laisse une décision, avec ce qui la précédait', () => {
  const game = createGame('DEC001', 'p0', { seed: 9, editionId: 'classic-fr' });
  addPlayer(game, { id: 'p0', name: 'Julie', token: null });
  addPlayer(game, { id: 'p1', name: 'Sophie', token: null });
  startGame(game, 'p0');

  const actor = game.state.pending.playerIds[0];
  const avant = game.state.players.find((p) => p.id === actor).cash;
  dispatch(game, actor, { type: 'ROLL_DICE' });

  const decision = game.decisions.at(-1);
  assert.equal(decision.playerId, actor);
  assert.equal(decision.pendingKind, 'roll', "l'invite à laquelle on répondait");
  assert.equal(decision.action.type, 'ROLL_DICE');
  assert.equal(decision.accepted, true);
  // La photo est prise AVANT le coup : le solde est celui d'avant le jet.
  assert.equal(decision.before.cash, avant);
  assert.ok(Array.isArray(decision.before.opponents), 'les adversaires sont décrits');
});

test('une action refusée est notée comme telle, avec sa raison', () => {
  const game = createGame('DEC002', 'p0', { seed: 3, editionId: 'classic-fr' });
  addPlayer(game, { id: 'p0', name: 'Julie', token: null });
  addPlayer(game, { id: 'p1', name: 'Sophie', token: null });
  startGame(game, 'p0');

  const wrong = game.state.pending.playerIds[0] === 'p0' ? 'p1' : 'p0';
  dispatch(game, wrong, { type: 'ROLL_DICE' });

  const decision = game.decisions.at(-1);
  assert.equal(decision.accepted, false);
  assert.ok(decision.error, 'la raison du refus est gardée');
});

test('une partie terminée écrit une ligne complète et relisible', async () => {
  const game = playToTheEnd();
  assert.equal(game.state.phase, 'finished', 'la partie doit aller à son terme');

  assert.equal(await archiveGame(game), true);
  // Archiver deux fois ne duplique pas la ligne : la diffusion appelle cette
  // fonction à chaque coup.
  assert.equal(await archiveGame(game), false);

  const files = await fs.readdir(ARCHIVE_DIR);
  const lines = (await fs.readFile(path.join(ARCHIVE_DIR, files[0]), 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1, 'une partie, une ligne');

  const record = JSON.parse(lines[0]);
  assert.equal(record.code, 'ARCH01');
  assert.equal(record.editionId, 'classic-fr');
  assert.equal(typeof record.seed, 'number');
  assert.ok(record.turns > 0);
  assert.ok(record.decisions.length > 10, 'les décisions sont là');
  assert.ok(record.log.length > 10, 'le journal aussi');
  assert.equal(record.partial, false);

  // Le classement : autant d'entrées que de joueuses, rangs à la suite.
  assert.equal(record.players.length, 2);
  assert.deepEqual(record.players.map((p) => p.rank), [1, 2]);
  assert.ok(record.players.every((p) => ['expert', 'facile'].includes(p.bot)));

  // Chaque décision doit pouvoir se relire seule.
  for (const decision of record.decisions) {
    assert.ok(decision.playerId, 'une décision sans autrice');
    assert.ok(decision.action?.type, 'une décision sans action');
    assert.ok(decision.before, 'une décision sans contexte');
  }
});

test("le chat ne part jamais dans l'archive", async () => {
  const game = playToTheEnd(11);
  game.state.chat = [{ id: 'c1', playerId: 'p0', text: 'coucou', at: Date.now() }];
  game.archived = false;
  await archiveGame(game);

  const files = await fs.readdir(ARCHIVE_DIR);
  const contenu = await fs.readFile(path.join(ARCHIVE_DIR, files[0]), 'utf8');
  assert.equal(contenu.includes('coucou'), false, 'une conversation de famille reste privée');
});
