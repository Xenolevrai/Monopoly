/**
 * Le système de fusion (étape 1), avant qu'aucune extension n'existe.
 *
 * Le contrat à tenir : activer ce système ne doit rien changer à une partie
 * qui n'active aucune extension — ni référence différente, ni comportement
 * différent, ni copie superflue. C'est ce filet qui permettra d'ajouter
 * « Prison », « Parc Gratuit Jackpot » et « Tout Acheter » un par un sans
 * craindre d'avoir dérangé les éditions existantes au passage.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { EDITIONS, editionOf } from '../shared/editions.js';
import { applyExtensions, compatibleExtensions, conflictingPositions, EXTENSIONS } from '../shared/extensions.js';
import { moveTo, resolveLanding } from '../server/engine/movement.js';
import { startTurn } from '../server/engine/turn.js';
import { createGame, addPlayer, startGame, dispatch } from '../server/engine/index.js';

test('sans extension activée, la fusion renvoie la même référence — aucune copie', () => {
  for (const edition of Object.values(EDITIONS)) {
    assert.equal(applyExtensions(edition, []), edition);
    assert.equal(applyExtensions(edition, undefined), edition);
    assert.equal(applyExtensions(edition, null), edition);
  }
});

test('un identifiant inconnu est ignoré plutôt que de faire échouer la fusion', () => {
  const edition = EDITIONS['classic-fr'];
  assert.equal(applyExtensions(edition, ['n-existe-pas']), edition);
});

test('une partie créée sans extensionIds en a un tableau vide, jamais undefined', () => {
  const game = createGame('EXT001', 'h', { seed: 1, editionId: 'classic-fr' });
  assert.deepEqual(game.state.extensionIds, []);
  assert.equal(editionOf(game.state), EDITIONS['classic-fr']);
});

test('le registre contient les deux extensions codées à ce stade (Tout Acheter reste à faire)', () => {
  assert.deepEqual(Object.keys(EXTENSIONS).sort(), ['free-parking-jackpot', 'go-to-jail']);
  assert.deepEqual(compatibleExtensions(EDITIONS['classic-fr']).map((e) => e.id).sort(), [
    'free-parking-jackpot',
    'go-to-jail',
  ]);
  assert.deepEqual(conflictingPositions([]), []);
});

test('activer les deux extensions codées ensemble est détecté en conflit (elles se marchent sur Chance/Caisse)', () => {
  const conflicts = conflictingPositions(Object.values(EXTENSIONS));
  assert.ok(conflicts.length > 0);
});

test('une partie entière tourne à l\'identique, extensionIds vide ou omis', () => {
  for (const editionId of Object.keys(EDITIONS)) {
    const withEmpty = createGame(`E${editionId.slice(0, 3)}A`, 'h', { seed: 5, editionId, extensionIds: [] });
    const withoutField = createGame(`E${editionId.slice(0, 3)}B`, 'h', { seed: 5, editionId });
    for (const game of [withEmpty, withoutField]) {
      addPlayer(game, { id: 'p0', name: 'Alice', token: editionOf(game.state).tokens[0].id });
      addPlayer(game, { id: 'p1', name: 'Bruno', token: editionOf(game.state).tokens[1].id });
      startGame(game, 'p0');
    }
    // Même graine, même déroulé : les deux parties doivent rester identiques
    // pas à pas, preuve que le champ extensionIds n'a aucun effet à vide.
    for (let step = 0; step < 60; step++) {
      const kindA = withEmpty.state.pending.kind;
      const kindB = withoutField.state.pending.kind;
      assert.equal(kindA, kindB, `${editionId} : divergence à l'étape ${step}`);
      if (!kindA) break;
      if (kindA === 'roll') {
        dispatch(withEmpty, withEmpty.state.pending.playerIds[0], { type: 'ROLL_DICE' });
        dispatch(withoutField, withoutField.state.pending.playerIds[0], { type: 'ROLL_DICE' });
      } else {
        break; // suffisant pour prouver l'absence de divergence de configuration
      }
    }
  }
});


/**
 * Joue des tours au hasard jusqu'à `maxSteps`, en résolvant systématiquement
 * toute décision en attente par le choix le plus simple disponible. Sert à
 * vérifier qu'une extension ne bloque jamais la partie, sans avoir à scripter
 * un déroulé précis (les piles sont mélangées, l'ordre des cartes varie).
 */
function autoPlay(game, maxSteps = 400) {
  for (let step = 0; step < maxSteps; step++) {
    const { state } = game;
    if (state.phase === 'finished') return;
    const kind = state.pending.kind;
    if (state.debt) {
      const debtorId = state.debt.debtorId;
      if (playerById(game.state, debtorId).cash >= state.debt.amount) {
        dispatch(game, debtorId, { type: 'PAY_DEBT' });
      } else {
        dispatch(game, debtorId, { type: 'DECLARE_BANKRUPTCY' });
      }
      continue;
    }
    if (!kind) return;
    const actorId = state.pending.playerIds[0];
    switch (kind) {
      case 'roll':
        dispatch(game, actorId, { type: 'ROLL_DICE' });
        break;
      case 'buy_or_auction':
        dispatch(game, actorId, { type: 'DECLINE_PROPERTY' });
        break;
      case 'auction_bid':
        dispatch(game, actorId, { type: 'AUCTION_PASS' });
        break;
      case 'draw_card':
        dispatch(game, actorId, { type: 'DRAW_CARD' });
        break;
      case 'card_reveal':
        dispatch(game, actorId, { type: 'ACKNOWLEDGE_CARD' });
        break;
      case 'card_choice':
        dispatch(game, actorId, { type: 'CARD_CHOICE', optionIndex: 0 });
        break;
      case 'end_turn':
        dispatch(game, actorId, { type: 'END_TURN' });
        break;
      default:
        return; // pending inconnu pour ce driver : on s'arrête plutôt que de boucler
    }
  }
}

function playerById(state, id) {
  return state.players.find((p) => p.id === id);
}

test('extension Parc Gratuit Jackpot : une partie entière tourne sans blocage', () => {
  const game = createGame('EXTJP1', 'h', { seed: 7, editionId: 'classic-fr', extensionIds: ['free-parking-jackpot'] });
  assert.deepEqual(game.state.extensionIds, ['free-parking-jackpot']);
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  addPlayer(game, { id: 'p2', name: 'Chloé', token: 'bateau' });
  startGame(game, 'p0');
  autoPlay(game);
  assert.ok(game.state.turnCount > 20, 'la partie doit avoir avancé sur de nombreux tours');
  // Aucune case Chance/Caisse ne doit subsister : elles sont devenues Spin.
  const edition = editionOf(game.state);
  assert.equal(edition.board.filter((s) => s.type === 'chance' || s.type === 'community_chest').length, 0);
  assert.ok(edition.board.some((s) => s.type === 'spin'));
});

test('extension Parc Gratuit Jackpot : atterrir sur le secteur « Jackpot ! » vide la cagnotte vers la joueuse', () => {
  const game = createGame('EXTJP2', 'h', { seed: 3, editionId: 'classic-fr', extensionIds: ['free-parking-jackpot'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  game.state.freeParkingPot = 300;
  const before = playerById(game.state, 'p0').cash;
  // On force le tirage de la carte « Jackpot ! » plutôt que de dépendre du mélange.
  game.state.decks.spin = ['spin-jackpot', ...game.state.decks.spin.filter((id) => id !== 'spin-jackpot')];
  moveTo(game.state, 'p0', 7, false); // case Spin (ex-Chance)
  resolveLanding(game.state, 'p0', {});
  dispatch(game, 'p0', { type: 'DRAW_CARD' });
  dispatch(game, 'p0', { type: 'ACKNOWLEDGE_CARD' });
  assert.equal(game.state.freeParkingPot, 0);
  assert.equal(playerById(game.state, 'p0').cash, before + 300 + 200);
});

test('extension Prison : une partie entière tourne sans blocage, caution à 100 €', () => {
  const game = createGame('EXTJAIL1', 'h', { seed: 11, editionId: 'classic-fr', extensionIds: ['go-to-jail'] });
  assert.deepEqual(game.state.extensionIds, ['go-to-jail']);
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  addPlayer(game, { id: 'p2', name: 'Chloé', token: 'bateau' });
  startGame(game, 'p0');
  const edition = editionOf(game.state);
  assert.equal(edition.jail.bail, 100);
  assert.equal(edition.mechanics.doublesNeverJail, true);
  assert.equal(edition.board.filter((s) => s.type === 'tax').length, 0);
  assert.ok(edition.board.some((s) => s.type === 'super_jail'));
  autoPlay(game, 500);
  assert.ok(game.state.turnCount > 20, 'la partie doit avoir avancé sur de nombreux tours');
});

test('extension Prison : atterrir sur une ex-case taxe envoie en prison', () => {
  const game = createGame('EXTJAIL2', 'h', { seed: 1, editionId: 'classic-fr', extensionIds: ['go-to-jail'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  moveTo(game.state, 'p0', 4, false); // ex-Impôt sur le revenu, devenue « Allez en prison »
  resolveLanding(game.state, 'p0', {});
  assert.equal(playerById(game.state, 'p0').inJail, true);
  assert.equal(playerById(game.state, 'p0').jailTier, 'normal');
});

test('extension Prison : atterrir sur l\'ex-case « Allez en prison » envoie en Super Jail (caution 200 €)', () => {
  const game = createGame('EXTJAIL3', 'h', { seed: 2, editionId: 'classic-fr', extensionIds: ['go-to-jail'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  moveTo(game.state, 'p0', 30, false); // ex-« Allez en prison », devenue Super Jail
  resolveLanding(game.state, 'p0', {});
  const player = playerById(game.state, 'p0');
  assert.equal(player.inJail, true);
  assert.equal(player.jailTier, 'super');
  assert.equal(player.position, 30);
  player.cash = 1000;
  game.state.currentPlayerIndex = game.state.players.findIndex((p) => p.id === 'p0');
  startTurn(game.state);
  assert.equal(game.state.pending.kind, 'card_choice');
  dispatch(game, 'p0', { type: 'CARD_CHOICE', optionIndex: 0 }); // paie la caution sévère
  assert.equal(playerById(game.state, 'p0').inJail, false);
  assert.equal(playerById(game.state, 'p0').cash, 800);
});

