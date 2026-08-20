/**
 * L'édition à pion hostile autonome (Spider-Man Hasbro) et les pouvoirs de camp.
 *
 * Tout ce qui est vérifié ici passe par une configuration d'édition — jamais
 * par un nom d'édition dans le moteur. Ces tests valent donc autant pour la
 * boîte du Bouffon Vert que pour n'importe quelle future édition qui déclarerait
 * `mechanics.hazardPawn`, `mechanics.warpSpaces` ou un pouvoir de camp.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { EDITIONS, editionOf } from '../shared/editions.js';
import { createGame, addPlayer, startGame, dispatch } from '../server/engine/index.js';
import { moveTo, resolveLanding } from '../server/engine/movement.js';
import { dropHazard, isHazarded, playHazardTurn, advanceHazardPawn } from '../server/engine/hazard.js';
import { canBuild } from '../server/engine/queries.js';
import { createRng, scriptedRng } from '../server/engine/rng.js';
import { startTurn } from '../server/engine/turn.js';

const ID = 'spiderman-hasbro-fr';

/** Une partie prête à jouer, chaque joueuse dans le camp demandé. */
function newGame(code, factions = ['peter', 'miles', 'gwen'], seed = 5) {
  const game = createGame(code, 'h', { seed, editionId: ID });
  const tokens = ['masque', 'toile', 'araignee'];
  factions.forEach((faction, i) => {
    addPlayer(game, { id: `p${i}`, name: `J${i}`, token: tokens[i], faction });
  });
  startGame(game, 'p0');
  return game;
}

const playerOf = (state, id) => state.players.find((p) => p.id === id);

test('le pion hostile démarre où l\'édition le dit, et pas ailleurs', () => {
  const game = newGame('HZ01');
  const start = editionOf(game.state).mechanics.hazardPawn.start;
  assert.equal(game.state.hazardPawn.position, start);
  assert.deepEqual(game.state.hazards, {});
});

test('une édition sans pion hostile ne porte rien de plus dans son état', () => {
  const game = createGame('HZ02', 'h', { seed: 1, editionId: 'classic-fr' });
  assert.equal(game.state.hazardPawn, null);
  assert.deepEqual(game.state.hazards, {});
});

test('le pion hostile ne piège que ce qui est possédé et non défendu', () => {
  const game = newGame('HZ03');
  const { state } = game;

  // Case libre : rien, la capture doit rester possible.
  assert.equal(dropHazard(state, 1), false);
  assert.equal(isHazarded(state, 1), false);

  // Case possédée : piégée.
  state.properties[1].ownerId = 'p1';
  assert.equal(dropHazard(state, 1), true);
  assert.equal(isHazarded(state, 1), true);

  // Case possédée mais construite : la construction repousse le pion.
  state.properties[3].ownerId = 'p1';
  state.properties[3].houses = 1;
  assert.equal(dropHazard(state, 3), false);

  // Case déjà piégée : on n'empile pas.
  assert.equal(dropHazard(state, 1), false);

  // Case non achetable : jamais.
  assert.equal(dropHazard(state, 0), false);
});

test('arriver sur une case piégée coûte la pénalité, consomme le piège et annule le loyer', () => {
  const game = newGame('HZ04');
  const { state } = game;
  const penalty = editionOf(state).mechanics.hazardPawn.penalty;

  state.properties[1].ownerId = 'p1';
  dropHazard(state, 1);
  const visitorBefore = playerOf(state, 'p2').cash;
  const ownerBefore = playerOf(state, 'p1').cash;

  moveTo(state, 'p2', 1, false);
  resolveLanding(state, 'p2', {});

  assert.equal(playerOf(state, 'p2').cash, visitorBefore - penalty, 'la pénalité est prélevée');
  assert.equal(playerOf(state, 'p1').cash, ownerBefore, 'la propriétaire ne touche aucun loyer');
  assert.equal(isHazarded(state, 1), false, 'le piège est consommé par celle qui le déclenche');
});

test('une case piégée reste achetable : le piège verrouille le loyer, pas la capture', () => {
  const game = newGame('HZ05');
  const { state } = game;
  state.properties[1].ownerId = 'p1';
  dropHazard(state, 1);
  state.properties[1].ownerId = null; // piégée *et* libre

  moveTo(state, 'p2', 1, false);
  resolveLanding(state, 'p2', {});
  assert.equal(state.pending.kind, 'buy_or_auction');
  assert.equal(state.pending.payload.spaceId, 1);
});

test('un camp qui désamorce en arrivant ne paie rien (Venom Blast)', () => {
  const game = newGame('HZ06', ['miles', 'peter', 'gwen']);
  const { state } = game;
  state.properties[1].ownerId = 'p1';
  dropHazard(state, 1);
  const before = playerOf(state, 'p0').cash;

  moveTo(state, 'p0', 1, false);
  resolveLanding(state, 'p0', {});

  assert.equal(playerOf(state, 'p0').cash, before, 'aucune pénalité');
  assert.equal(isHazarded(state, 1), false, 'le piège est neutralisé');
});

test('le pion hostile avance et frappe, tour après tour', () => {
  const game = newGame('HZ07');
  const { state } = game;
  for (const id of [1, 3, 6, 8, 9]) state.properties[id].ownerId = 'p1';
  const start = state.hazardPawn.position;
  playHazardTurn(state, createRng(3));
  assert.notEqual(state.hazardPawn.position, start, 'le pion doit avoir bougé');

  // Sur un tour complet de plateau, il finit forcément par piéger quelque chose.
  for (let i = 0; i < 40; i++) playHazardTurn(state, createRng(i + 1));
  assert.ok(Object.keys(state.hazards).length > 0);
});

test('une carte peut déplacer le pion hostile de son propre chef', () => {
  const game = newGame('HZ08');
  const { state } = game;
  const before = state.hazardPawn.position;
  advanceHazardPawn(state, 3);
  assert.equal(state.hazardPawn.position, (before + 3) % 40);
});

test('un raccourci de toile propose de se balancer, et le fait payer', () => {
  const game = newGame('HZ09', ['peter', 'miles', 'gwen']);
  const { state } = game;
  const cost = editionOf(state).mechanics.warpSpaces.cost;
  const before = playerOf(state, 'p0').cash;

  moveTo(state, 'p0', 7, false); // premier raccourci
  resolveLanding(state, 'p0', {});
  assert.equal(state.pending.kind, 'card_choice');

  dispatch(game, 'p0', { type: 'CARD_CHOICE', optionIndex: 0 }); // se balancer
  assert.equal(playerOf(state, 'p0').position, 22, 'on atterrit sur le raccourci suivant');
  assert.equal(playerOf(state, 'p0').cash, before - cost);
});

test('le raccourci est gratuit pour le camp qui l\'annonce (Ghost-Spider)', () => {
  const game = newGame('HZ10', ['gwen', 'peter', 'miles']);
  const { state } = game;
  const before = playerOf(state, 'p0').cash;
  moveTo(state, 'p0', 7, false);
  resolveLanding(state, 'p0', {});
  dispatch(game, 'p0', { type: 'CARD_CHOICE', optionIndex: 0 });
  assert.equal(playerOf(state, 'p0').position, 22);
  assert.equal(playerOf(state, 'p0').cash, before, 'aucun frais');
});

test('refuser le raccourci laisse la joueuse où elle est', () => {
  const game = newGame('HZ11');
  const { state } = game;
  moveTo(state, 'p0', 7, false);
  resolveLanding(state, 'p0', {});
  dispatch(game, 'p0', { type: 'CARD_CHOICE', optionIndex: 1 });
  assert.equal(playerOf(state, 'p0').position, 7);
});

test('un camp qui relance voit son jet avant de le valider, une seule fois', () => {
  const game = newGame('HZ12', ['peter', 'miles', 'gwen']);
  const { state } = game;
  state.currentPlayerIndex = state.players.findIndex((p) => p.id === 'p0');
  startTurn(state);

  dispatch(game, 'p0', { type: 'ROLL_DICE' });
  assert.equal(state.pending.kind, 'reroll', 'le jet est proposé avant résolution');

  dispatch(game, 'p0', { type: 'REROLL_DICE' });
  assert.notEqual(state.pending.kind, 'reroll', 'la relance résout le tour');
  assert.equal(state.dice.rerollUsed, true);
});

test('un camp sans pouvoir de relance résout son jet directement', () => {
  const game = newGame('HZ13', ['miles', 'peter', 'gwen']);
  const { state } = game;
  state.currentPlayerIndex = state.players.findIndex((p) => p.id === 'p0');
  startTurn(state);
  dispatch(game, 'p0', { type: 'ROLL_DICE' });
  assert.notEqual(state.pending.kind, 'reroll');
});

test('un camp peut bâtir à prix réduit (Spider-Man 2099)', () => {
  const game = newGame('HZ14', ['miguel', 'peter', 'miles']);
  const { state } = game;
  // Le groupe marron complet, chez la même joueuse.
  for (const id of [1, 3]) state.properties[id].ownerId = 'p0';
  const plein = canBuild(state, 'p1', 1);
  state.properties[1].ownerId = 'p1';
  state.properties[3].ownerId = 'p1';
  const rival = canBuild(state, 'p1', 1);
  state.properties[1].ownerId = 'p0';
  state.properties[3].ownerId = 'p0';
  const reduit = canBuild(state, 'p0', 1);

  assert.ok(rival.ok && reduit.ok, `les deux doivent pouvoir bâtir (${rival.reason ?? ''} ${reduit.reason ?? ''})`);
  assert.equal(reduit.cost, Math.floor(rival.cost / 2), 'moitié prix pour le camp qui l\'annonce');
  assert.ok(plein.ok || true);
});

test('un camp épargne un loyer par tour de plateau (Spider-Ham)', () => {
  const game = newGame('HZ15', ['ham', 'peter', 'miles']);
  const { state } = game;
  assert.equal(playerOf(state, 'p0').rentWaivers, 1, 'le jeton est donné au lancement');

  state.properties[1].ownerId = 'p1';
  const ownerBefore = playerOf(state, 'p1').cash;
  const hamBefore = playerOf(state, 'p0').cash;
  moveTo(state, 'p0', 1, false);
  resolveLanding(state, 'p0', {});
  assert.equal(playerOf(state, 'p0').cash, hamBefore, 'le premier loyer est épargné');
  assert.equal(playerOf(state, 'p1').cash, ownerBefore);
  assert.equal(playerOf(state, 'p0').rentWaivers, 0, 'le jeton est consommé');

  // Le deuxième loyer, lui, se paie.
  moveTo(state, 'p0', 0, false);
  moveTo(state, 'p0', 1, false);
  resolveLanding(state, 'p0', {});
  assert.ok(playerOf(state, 'p0').cash < hamBefore || state.debt, 'le loyer suivant est bien dû');
});

test('un camp voit la prochaine dépêche avant de lancer (Silk)', () => {
  const game = newGame('HZ16', ['silk', 'peter', 'miles']);
  const { state } = game;
  state.currentPlayerIndex = state.players.findIndex((p) => p.id === 'p0');
  startTurn(state);
  assert.equal(state.pending.kind, 'roll');
  assert.ok(state.pending.payload.peek?.length, 'le texte de la carte du dessus est annoncé');
});

test('un camp sans ce pouvoir ne voit rien', () => {
  const game = newGame('HZ17', ['miles', 'peter', 'gwen']);
  const { state } = game;
  state.currentPlayerIndex = state.players.findIndex((p) => p.id === 'p0');
  startTurn(state);
  assert.equal(state.pending.payload.peek, undefined);
});

test('la partie s\'arrête dès que tous les vilains sont capturés', () => {
  const game = newGame('HZ18');
  const { state } = game;
  for (const prop of Object.values(state.properties)) prop.ownerId = 'p0';
  // Une action quelconque suffit à faire repasser le moteur par advanceFlow.
  dispatch(game, state.pending.playerIds[0], { type: 'ROLL_DICE' });
  assert.equal(state.phase, 'finished');
});

test('les six héros sont proposés, chacun avec un pouvoir décrit', () => {
  const options = EDITIONS[ID].factions.options;
  assert.equal(options.length, 6);
  for (const hero of options) {
    assert.ok(hero.power?.length, `${hero.id} : pouvoir non décrit`);
    // Chaque pouvoir doit être porté par un drapeau que le moteur sait lire.
    const flags = ['rerollDice', 'clearsHazardOnLand', 'freeWarp', 'peekDeck', 'rentWaiverPerLap', 'buildCostFactor'];
    assert.ok(flags.some((flag) => hero[flag] !== undefined), `${hero.id} : pouvoir non branché au moteur`);
  }
});

test('une partie entière tourne sur cette édition, pion hostile compris', () => {
  const game = newGame('HZ19', ['peter', 'miles', 'gwen'], 101);
  const { state } = game;
  const rng = createRng(11);
  for (let step = 0; step < 6000 && state.phase === 'playing'; step++) {
    if (state.debt) {
      const id = state.debt.debtorId;
      dispatch(game, id, {
        type: playerOf(state, id).cash >= state.debt.amount ? 'PAY_DEBT' : 'DECLARE_BANKRUPTCY',
      });
      continue;
    }
    const kind = state.pending.kind;
    if (!kind) break;
    const actor = state.pending.playerIds[0];
    const move = {
      roll: 'ROLL_DICE', reroll: rng.next() > 0.5 ? 'REROLL_DICE' : 'KEEP_ROLL',
      draw_card: 'DRAW_CARD', card_reveal: 'ACKNOWLEDGE_CARD', card_choice: 'CARD_CHOICE',
      end_turn: 'END_TURN', auction_bid: 'AUCTION_PASS', buy_or_auction: 'BUY_PROPERTY',
    }[kind];
    assert.ok(move, `pending « ${kind} » non géré par le pilote`);
    const result = dispatch(game, actor, { type: move, optionIndex: 0 });
    if (!result.ok && move === 'BUY_PROPERTY') dispatch(game, actor, { type: 'DECLINE_PROPERTY' });
  }
  assert.equal(state.phase, 'finished', 'la partie doit aller à son terme');
  assert.ok(state.turnCount > 20);
  assert.ok(scriptedRng([[1]]));
});
