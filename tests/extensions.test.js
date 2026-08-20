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
import { startTurn, rollBuyDie } from '../server/engine/turn.js';
import { scriptedRng } from '../server/engine/rng.js';
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

test('le registre contient les trois extensions Hasbro', () => {
  assert.deepEqual(Object.keys(EXTENSIONS).sort(), ['buy-everything', 'free-parking-jackpot', 'go-to-jail']);
  assert.deepEqual(compatibleExtensions(EDITIONS['classic-fr']).map((e) => e.id).sort(), [
    'buy-everything',
    'free-parking-jackpot',
    'go-to-jail',
  ]);
  assert.deepEqual(conflictingPositions([]), []);
});

test('activer les trois ensemble est détecté en conflit (Chance/Caisse et Parc Gratuit sont disputés)', () => {
  const conflicts = conflictingPositions(Object.values(EXTENSIONS));
  assert.ok(conflicts.length > 0);
});

test('Prison et Tout Acheter ne se marchent pas dessus : la combinaison est autorisée', () => {
  assert.deepEqual(conflictingPositions([EXTENSIONS['go-to-jail'], EXTENSIONS['buy-everything']]), []);
});

test('Parc Gratuit Jackpot et Tout Acheter se disputent le Parc Gratuit', () => {
  const conflicts = conflictingPositions([EXTENSIONS['free-parking-jackpot'], EXTENSIONS['buy-everything']]);
  assert.deepEqual(conflicts, [20]);
});

test('aucune extension ne convient à une édition qui ne remplit pas ses conditions', () => {
  // L'édition à points joue en exploration : les extensions séquentielles la refusent.
  assert.deepEqual(compatibleExtensions(EDITIONS['poudlard-points']).map((e) => e.id), []);
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


// — Extension Tout Acheter ————————————————————————————————————

test('extension Tout Acheter : une partie entière tourne sans blocage', () => {
  const game = createGame('EXTBUY1', 'h', { seed: 13, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  assert.deepEqual(game.state.extensionIds, ['buy-everything']);
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  addPlayer(game, { id: 'p2', name: 'Chloé', token: 'bateau' });
  startGame(game, 'p0');
  autoPlay(game, 600);
  assert.ok(game.state.turnCount > 10, 'la partie doit avoir avancé sur de nombreux tours');
});

test('extension Tout Acheter : Départ, Prison et Parc Gratuit portent un titre achetable', () => {
  const game = createGame('EXTBUY2', 'h', { seed: 4, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  const edition = editionOf(game.state);
  for (const id of [0, 10, 20]) {
    assert.equal(edition.board[id].type, 'landmark', `case ${id}`);
    assert.ok(game.state.properties[id], `la case ${id} doit avoir un état de propriété`);
  }
  // Aucune de ces cases ne se construit : ce sont des titres, pas des terrains.
  assert.equal(edition.board[20].houseCost, undefined);
});

test('extension Tout Acheter : arriver sur le Parc Gratuit propose de l\'acheter, et le loyer se paie', () => {
  const game = createGame('EXTBUY3', 'h', { seed: 6, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');

  moveTo(game.state, 'p0', 20, false);
  resolveLanding(game.state, 'p0', {});
  assert.equal(game.state.pending.kind, 'buy_or_auction');
  assert.equal(game.state.pending.payload.spaceId, 20);
  dispatch(game, 'p0', { type: 'BUY_PROPERTY' });
  assert.equal(game.state.properties[20].ownerId, 'p0');

  const before = playerById(game.state, 'p1').cash;
  moveTo(game.state, 'p1', 20, false);
  resolveLanding(game.state, 'p1', {});
  // Loyer fixe du titre : 60 €, ouvert en dette négociable comme tout loyer.
  assert.ok(game.state.debt || playerById(game.state, 'p1').cash === before - 60);
});

test('extension Tout Acheter : une case achetable dépassée part aux enchères', () => {
  const game = createGame('EXTBUY4', 'h', { seed: 8, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  game.state.auctionQueue = [];
  moveTo(game.state, 'p0', 5, false); // franchit 1, 2, 3, 4 en chemin
  // Les cases achetables franchies (1 et 3 ; 2 et 4 ne le sont pas) sont en file.
  assert.deepEqual(game.state.auctionQueue, [1, 3]);
  // La case d'arrivée, elle, n'est pas « dépassée » : elle se résout normalement.
  assert.ok(!game.state.auctionQueue.includes(5));
});

test('extension Tout Acheter : le dé d\'Achat donne une carte du coffre sur une face gagnante', () => {
  const game = createGame('EXTBUY5', 'h', { seed: 9, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  // Le coffre garde en permanence trois cartes retournées.
  assert.equal(game.state.saleVault.visible.length, 3);

  const chosen = game.state.saleVault.visible[0];
  game.state.dice.rolled = true;
  rollBuyDie(game.state, 'p0', scriptedRng([[6]])); // face gagnante
  assert.equal(game.state.pending.kind, 'card_choice');
  dispatch(game, 'p0', { type: 'CARD_CHOICE', optionIndex: 0 });
  assert.deepEqual(playerById(game.state, 'p0').saleCards, [chosen]);
  // Le présentoir se recomplète aussitôt.
  assert.equal(game.state.saleVault.visible.length, 3);
  assert.ok(!game.state.saleVault.visible.includes(chosen));
});

test('extension Tout Acheter : le dé d\'Achat ne se lance qu\'une fois par jet', () => {
  const game = createGame('EXTBUY6', 'h', { seed: 10, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  game.state.dice.rolled = true;
  assert.equal(rollBuyDie(game.state, 'p0', scriptedRng([[3]])).ok, true);
  assert.equal(rollBuyDie(game.state, 'p0', scriptedRng([[3]])).ok, false);
});

test('extension Tout Acheter : une carte jaune rapporte à chaque début de tour', () => {
  const game = createGame('EXTBUY7', 'h', { seed: 12, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  const player = playerById(game.state, 'p0');
  player.saleCards = ['sale-yellow-01']; // 50 € par tour
  const before = player.cash;
  game.state.currentPlayerIndex = game.state.players.findIndex((p) => p.id === 'p0');
  startTurn(game.state);
  assert.equal(playerById(game.state, 'p0').cash, before + 50);
});

test('extension Tout Acheter : une carte verte remplie met fin à la partie sur-le-champ', () => {
  const game = createGame('EXTBUY8', 'h', { seed: 14, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  const player = playerById(game.state, 'p0');
  player.saleCards = ['sale-green-01']; // objectif : 2 500 € en liquide
  player.cash = 2600;
  // Une action quelconque relance advanceFlow, qui teste la condition.
  dispatch(game, game.state.pending.playerIds[0], { type: 'ROLL_DICE' });
  assert.equal(game.state.phase, 'finished');
  assert.equal(game.state.winnerId, 'p0');
});

test('extension Tout Acheter : sans la carte verte, la même fortune ne termine rien', () => {
  const game = createGame('EXTBUY9', 'h', { seed: 14, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  playerById(game.state, 'p0').cash = 5000;
  dispatch(game, game.state.pending.playerIds[0], { type: 'ROLL_DICE' });
  assert.notEqual(game.state.phase, 'finished');
});

test('extensions Prison et Tout Acheter activées ensemble : une partie entière tourne', () => {
  const game = createGame('EXTMIX1', 'h', {
    seed: 21,
    editionId: 'classic-fr',
    extensionIds: ['go-to-jail', 'buy-everything'],
  });
  assert.deepEqual(game.state.extensionIds, ['go-to-jail', 'buy-everything']);
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  addPlayer(game, { id: 'p2', name: 'Chloé', token: 'bateau' });
  startGame(game, 'p0');
  const edition = editionOf(game.state);
  // Les deux deltas cohabitent : la geôle sévère et les titres spéciaux.
  assert.ok(edition.board.some((s) => s.type === 'super_jail'));
  assert.equal(edition.board[0].type, 'landmark');
  assert.equal(edition.jail.bail, 100);
  autoPlay(game, 600);
  assert.ok(game.state.turnCount > 10);
});

test('une partie sans extension n\'a ni coffre ni file d\'enchères au passage', () => {
  const game = createGame('EXTNONE', 'h', { seed: 2, editionId: 'classic-fr' });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  assert.equal(game.state.saleVault, null);
  moveTo(game.state, 'p0', 8, false);
  assert.deepEqual(game.state.auctionQueue, []);
  assert.equal(editionOf(game.state).board[0].type, 'go');
});
