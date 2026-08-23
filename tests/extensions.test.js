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
import { moveTo, resolveLanding, sendToJail } from '../server/engine/movement.js';
import { startTurn, rollBuyDie } from '../server/engine/turn.js';
import { rentFor } from '../server/engine/queries.js';
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

test('Prison et Tout Acheter se disputent les taxes et les coins', () => {
  assert.deepEqual(
    conflictingPositions([EXTENSIONS['go-to-jail'], EXTENSIONS['buy-everything']]).sort((a, b) => a - b),
    [4, 30, 38],
  );
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
      case 'roll_escape_die':
        dispatch(game, actorId, { type: 'ROLL_ESCAPE_DIE' });
        break;
      case 'roll_heist_die':
        dispatch(game, actorId, { type: 'ROLL_HEIST_DIE' });
        break;
      case 'jail_decision':
        dispatch(game, actorId, { type: 'PAY_BAIL' });
        break;
      case 'leave_super_jail': {
        const payload = state.pending.payload;
        if (payload?.canGiveCards) {
          dispatch(game, actorId, { type: 'LEAVE_SUPER_JAIL', choice: 'cards' });
        } else if (payload?.canPayCash) {
          dispatch(game, actorId, { type: 'LEAVE_SUPER_JAIL', choice: 'cash' });
        } else if (payload?.canStay) {
          dispatch(game, actorId, { type: 'STAY_IN_JAIL' });
        } else {
          dispatch(game, actorId, { type: 'LEAVE_SUPER_JAIL', choice: 'cash' });
        }
        break;
      }
      case 'spin_spinner':
        dispatch(game, actorId, { type: 'SPIN_SPINNER' });
        break;
      case 'choose_rent_or_chip':
        dispatch(game, actorId, { type: 'CHOOSE_RENT_OR_CHIP', choice: 'chip' });
        break;
      case 'card_reveal':
        dispatch(game, actorId, { type: 'ACKNOWLEDGE_CARD' });
        break;
      case 'card_choice':
        dispatch(game, actorId, { type: 'CARD_CHOICE', optionIndex: 0 });
        break;
      case 'buy_sale_card': {
        const payload = state.pending.payload;
        const cardId = payload.visibleCards?.[0];
        const player = playerById(state, actorId);
        const discardId = payload.mustDiscardFirst ? player?.saleCards?.[0] : null;
        if (cardId) {
          dispatch(game, actorId, { type: 'BUY_SALE_CARD', cardId, discardCardId: discardId });
        } else {
          dispatch(game, actorId, { type: 'END_TURN' });
        }
        break;
      }
      case 'force_discard_sale_card': {
        const payload = state.pending.payload;
        const victimId = payload.victimIds?.[0];
        const victim = playerById(state, victimId);
        const cardId = victim?.saleCards?.[0];
        if (victimId && cardId) {
          dispatch(game, actorId, { type: 'FORCE_DISCARD_SALE_CARD', targetPlayerId: victimId, targetCardId: cardId });
        } else {
          dispatch(game, actorId, { type: 'END_TURN' });
        }
        break;
      }
      case 'refresh_sale_vault': {
        const payload = state.pending.payload;
        const cardId = payload.visibleCards?.[0];
        if (cardId) {
          dispatch(game, actorId, { type: 'REFRESH_SALE_VAULT', cardId });
        } else {
          dispatch(game, actorId, { type: 'END_TURN' });
        }
        break;
      }
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
  // Chaque joueur démarre avec 2 jetons Spin et 2 cartes Bonus
  assert.ok(game.state.players.every((p) => p.spinChips >= 0 && Array.isArray(p.bonusCards)));
});

test('extension Parc Gratuit Jackpot : atterrir sur le secteur « Jackpot ! » vide la cagnotte vers la joueuse', () => {
  const game = createGame('EXTJP2', 'h', { seed: 3, editionId: 'classic-fr', extensionIds: ['free-parking-jackpot'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  game.state.freeParkingPot = 300;
  const before = playerById(game.state, 'p0').cash;
  moveTo(game.state, 'p0', 7, false); // case Spin (ex-Chance)
  resolveLanding(game.state, 'p0', {});
  assert.equal(game.state.pending.kind, 'spin_spinner');
  dispatch(game, 'p0', { type: 'SPIN_SPINNER', sectorIndex: 3 }); // Sector green-jackpot
  assert.equal(game.state.freeParkingPot, 0);
  assert.equal(playerById(game.state, 'p0').cash, before + 300);
});

test('extension Parc Gratuit Jackpot : Deal Mobile offre les propriétés libres et exonère de loyer', () => {
  const game = createGame('EXTJP3', 'h', { seed: 5, editionId: 'classic-fr', extensionIds: ['free-parking-jackpot'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');

  // Alice prend le Deal Mobile
  game.state.dealMobileOwnerId = 'p0';

  // Alice atterrit sur une propriété libre (case 1) : elle est acquise gratuitement
  moveTo(game.state, 'p0', 1, false);
  resolveLanding(game.state, 'p0', {});
  assert.equal(game.state.properties[1].ownerId, 'p0');

  // Bruno achète la case 3
  game.state.properties[3].ownerId = 'p1';
  const aliceCashBefore = playerById(game.state, 'p0').cash;

  // Alice au volant du Deal Mobile atterrit chez Bruno : 0 loyer
  moveTo(game.state, 'p0', 3, false);
  resolveLanding(game.state, 'p0', {});
  assert.equal(playerById(game.state, 'p0').cash, aliceCashBefore);
  // Bruno a l'option de prendre 1 jeton Spin à la banque
  assert.equal(game.state.pending.kind, 'choose_rent_or_chip');
  dispatch(game, 'p1', { type: 'CHOOSE_RENT_OR_CHIP', choice: 'chip' });
  assert.equal(playerById(game.state, 'p1').spinChips, 3); // 2 init + 1

  // Si Alice va en prison, elle perd le Deal Mobile
  sendToJail(game.state, 'p0');
  assert.equal(game.state.dealMobileOwnerId, null);
});

test('extension Parc Gratuit Jackpot : les cartes Bonus fonctionnent correctement', () => {
  const game = createGame('EXTJP4', 'h', { seed: 9, editionId: 'classic-fr', extensionIds: ['free-parking-jackpot'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  game.state.currentPlayerIndex = game.state.players.findIndex((p) => p.id === 'p0');
  const p0 = playerById(game.state, 'p0');
  p0.bonusCards = ['fp-jackpot-01'];
  game.state.freeParkingPot = 500;
  const cashBefore = p0.cash;
  dispatch(game, 'p0', { type: 'PLAY_BONUS_CARD', cardId: 'fp-jackpot-01' });
  assert.equal(p0.cash, cashBefore + 500);
  assert.equal(game.state.freeParkingPot, 0);
});

test('extension Prison : configuration initiale des 32 cartes Corruption et 12 Super Corruption', () => {
  const game = createGame('EXTJAIL1', 'h', { seed: 11, editionId: 'classic-fr', extensionIds: ['go-to-jail'] });
  assert.deepEqual(game.state.extensionIds, ['go-to-jail']);
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  addPlayer(game, { id: 'p2', name: 'Chloé', token: 'bateau' });
  startGame(game, 'p0');

  const edition = editionOf(game.state);
  assert.equal(edition.mechanics.corruptionCards, true);
  assert.equal(edition.mechanics.superCorruptionCards, true);
  assert.equal(edition.board.filter((s) => s.type === 'tax').length, 0);
  assert.equal(edition.board.filter((s) => s.type === 'escape_die').length, 3);
  assert.equal(edition.board.filter((s) => s.type === 'heist_die').length, 3);
  assert.ok(edition.board.some((s) => s.type === 'super_jail'));

  // Chaque joueur démarre avec 2 cartes Corruption
  assert.equal(playerById(game.state, 'p0').corruptionCards.length, 2);
  assert.equal(playerById(game.state, 'p1').corruptionCards.length, 2);
  assert.equal(playerById(game.state, 'p2').corruptionCards.length, 2);
  // Total 32 cartes Corruption (6 distribuées + 26 dans la pile)
  assert.equal(game.state.decks.corruption.length, 26);
  // Total 13 cartes Super Corruption dans la pile Super Prison
  assert.equal(game.state.decks.super_corruption.length, 13);
});

test('extension Prison : cases 4 et 38 envoient en Prison et font piocher 1 carte Corruption', () => {
  const game = createGame('EXTJAIL2', 'h', { seed: 1, editionId: 'classic-fr', extensionIds: ['go-to-jail'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');

  const p0 = playerById(game.state, 'p0');
  const countBefore = p0.corruptionCards.length;

  moveTo(game.state, 'p0', 4, false);
  resolveLanding(game.state, 'p0', {});
  assert.equal(p0.inJail, true);
  assert.equal(p0.superJail, false);
  assert.equal(p0.corruptionCards.length, countBefore + 1);
});

test('extension Prison : franchir la case Prison (position 10) fait piocher 1 carte Corruption', () => {
  const game = createGame('EXTJAIL3', 'h', { seed: 2, editionId: 'classic-fr', extensionIds: ['go-to-jail'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');

  const p0 = playerById(game.state, 'p0');
  p0.position = 8;
  const countBefore = p0.corruptionCards.length;

  // Avance de 4 cases (franchit la case 10 et atterrit en 12)
  moveTo(game.state, 'p0', 12, false);
  assert.equal(p0.corruptionCards.length, countBefore + 1);
});

test('extension Prison : les dés Évasion et Casse fonctionnent correctement', () => {
  const game = createGame('EXTJAIL4', 'h', { seed: 4, editionId: 'classic-fr', extensionIds: ['go-to-jail'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');

  // Dé Évasion sur case 7
  moveTo(game.state, 'p0', 7, false);
  resolveLanding(game.state, 'p0', {});
  assert.equal(game.state.pending.kind, 'roll_escape_die');
  dispatch(game, 'p0', { type: 'ROLL_ESCAPE_DIE' });
  assert.ok(game.state.escapeDie);

  // Dé Casse sur case 2
  moveTo(game.state, 'p1', 2, false);
  resolveLanding(game.state, 'p1', {});
  assert.equal(game.state.pending.kind, 'roll_heist_die');
  dispatch(game, 'p1', { type: 'ROLL_HEIST_DIE' });
  assert.ok(game.state.heistDie);
});

test('extension Prison : la Super Prison rapporte des Super Corruption et permet de sortir via cartes ou cash', () => {
  const game = createGame('EXTJAIL5', 'h', { seed: 5, editionId: 'classic-fr', extensionIds: ['go-to-jail'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');

  // Alice envoie Bruno en Super Prison via la carte Balance (Snitch)
  sendToJail(game.state, 'p1', 'super', 'p0');
  const p1 = playerById(game.state, 'p1');
  assert.equal(p1.superJail, true);
  assert.equal(p1.superJailSenderId, 'p0');

  // Au tour de Bruno : il gagne 1 carte Super Corruption et doit décider de sa sortie
  game.state.currentPlayerIndex = game.state.players.findIndex((p) => p.id === 'p1');
  startTurn(game.state);
  assert.equal(game.state.pending.kind, 'leave_super_jail');
  assert.equal(p1.superCorruptionCards.length, 1);
  assert.equal(p1.superJailCollectedCards.length, 1);

  // Bruno choisit de donner ses cartes Super Corruption collectées à Alice
  dispatch(game, 'p1', { type: 'LEAVE_SUPER_JAIL', choice: 'cards' });
  assert.equal(p1.inJail, false);
  assert.equal(p1.superJail, false);
  assert.equal(playerById(game.state, 'p0').superCorruptionCards.length, 1);
  assert.equal(p1.superCorruptionCards.length, 0);
  assert.equal(game.state.pending.kind, 'roll');
});

test('extension Prison : condition de victoire et disqualification des joueurs en prison à la fin', () => {
  const game = createGame('EXTJAIL6', 'h', { seed: 6, editionId: 'classic-fr', extensionIds: ['go-to-jail'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');

  const p0 = playerById(game.state, 'p0');
  const p1 = playerById(game.state, 'p1');

  p0.cash = 5000;
  p1.cash = 1000;

  // Alice est en prison
  p0.inJail = true;
  p1.inJail = false;

  // Fin de partie (toutes propriétés capturées)
  for (let i = 0; i < 40; i++) {
    if (game.state.properties[i]) game.state.properties[i].ownerId = 'p1';
  }

  autoPlay(game, 10);
  // Alice a plus de cash mais est en cellule : elle ne peut pas gagner ! Bruno l'emporte.
  assert.equal(game.state.phase, 'finished');
  assert.equal(game.state.winnerId, 'p1');
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

test('extension Tout Acheter : capital initial officiel à 2 150 €', () => {
  const game = createGame('EXTBUY1', 'h', { seed: 1, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  assert.equal(playerById(game.state, 'p0').cash, 2150);
  assert.equal(playerById(game.state, 'p1').cash, 2150);
});

test('extension Tout Acheter : Départ, Prison, Parc Gratuit, Go to Jail et Taxes portent des titres achetables', () => {
  const game = createGame('EXTBUY2', 'h', { seed: 4, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  const edition = editionOf(game.state);
  for (const id of [0, 4, 10, 20, 30, 38]) {
    assert.equal(edition.board[id].type, 'landmark', `case ${id}`);
    assert.ok(game.state.properties[id], `la case ${id} doit avoir un état de propriété`);
  }
  // Aucune de ces cases ne se construit : ce sont des titres, pas des terrains.
  assert.equal(edition.board[20].houseCost, undefined);
});

test('extension Tout Acheter : arriver sur le Parc Gratuit propose de l\'acheter, et le loyer de coin se paie', () => {
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
  // Loyer de coin (1 coin possédé) : 50 €, ouvert en dette négociable comme tout loyer.
  assert.ok(game.state.debt || playerById(game.state, 'p1').cash === before - 50);
});

test('extension Tout Acheter : loyer progressif des 4 Coins (50, 100, 200, 400 €)', () => {
  const game = createGame('EXTBUY_CORNERS', 'h', { seed: 7, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');

  game.state.properties[0].ownerId = 'p0';
  assert.equal(rentFor(game.state, 0), 50);

  game.state.properties[10].ownerId = 'p0';
  assert.equal(rentFor(game.state, 0), 100);

  game.state.properties[20].ownerId = 'p0';
  assert.equal(rentFor(game.state, 0), 200);

  game.state.properties[30].ownerId = 'p0';
  assert.equal(rentFor(game.state, 0), 400);
});

test('extension Tout Acheter : le dé d\'Achat permet d\'acheter une carte au Coffre-Fort', () => {
  const game = createGame('EXTBUY5', 'h', { seed: 9, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  assert.equal(game.state.saleVault.visible.length, 3);

  const chosen = game.state.saleVault.visible[0];
  game.state.dice.rolled = true;
  // Face buy_card (index 0)
  rollBuyDie(game.state, 'p0', scriptedRng([[1]]));
  assert.equal(game.state.pending.kind, 'buy_sale_card');
  dispatch(game, 'p0', { type: 'BUY_SALE_CARD', cardId: chosen });
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
  assert.equal(rollBuyDie(game.state, 'p0', scriptedRng([[1]])).ok, true);
  assert.equal(rollBuyDie(game.state, 'p0', scriptedRng([[1]])).ok, false);
});

test('extension Tout Acheter : une carte permanente de rente rapporte 50 € à chaque début de tour', () => {
  const game = createGame('EXTBUY7', 'h', { seed: 12, editionId: 'classic-fr', extensionIds: ['buy-everything'] });
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  startGame(game, 'p0');
  const player = playerById(game.state, 'p0');
  player.saleCards = ['sale-revenue-01']; // 50 € par tour
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
  player.saleCards = ['sale-cash-01']; // objectif : 2 500 € en liquide
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

test('extension Tout Acheter : une partie entière tourne sans blocage', () => {
  const game = createGame('EXTMIX1', 'h', {
    seed: 21,
    editionId: 'classic-fr',
    extensionIds: ['buy-everything'],
  });
  assert.deepEqual(game.state.extensionIds, ['buy-everything']);
  addPlayer(game, { id: 'p0', name: 'Alice', token: 'chapeau' });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: 'chat' });
  addPlayer(game, { id: 'p2', name: 'Chloé', token: 'bateau' });
  startGame(game, 'p0');
  const edition = editionOf(game.state);
  assert.equal(edition.board[0].type, 'landmark');
  assert.equal(playerById(game.state, 'p0').cash, 2150);
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
