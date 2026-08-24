/**
 * La Mega Edition : plateau de 52 cases, huit joueuses, trois dés.
 *
 * Ce fichier fige les règles que la boîte ajoute et qui n'existent nulle part
 * ailleurs — règle de majorité, gratte-ciels, dépôts, dé rapide, tickets de bus,
 * trois cases spéciales — et vérifie, à chaque fois que c'est possible, que le
 * classique n'a pas bougé d'un pouce. Le contrat de la plateforme est là :
 * ajouter des mécaniques ne doit rien changer aux boîtes qui ne les déclarent
 * pas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { EDITIONS, getEdition } from '../shared/editions.js';
import { createGame, addPlayer, startGame, dispatch } from '../server/engine/index.js';
import { canBuild, rentFor, buildingLevel, canMortgage, maxRaisable } from '../server/engine/queries.js';
import { busDestinations } from '../server/engine/speeddie.js';
import { scriptedRng, createRng } from '../server/engine/rng.js';

const MEGA = EDITIONS['mega-edition'];

/** Une partie lancée, avec les joueuses demandées, prête à recevoir des actions. */
function newGame({ players = 2, seed = 7, locale = 'fr' } = {}) {
  const game = createGame('MEGA01', 'p0', { seed, editionId: 'mega-edition', locale });
  for (let i = 0; i < players; i++) {
    addPlayer(game, { id: `p${i}`, name: `J${i}`, token: MEGA.tokens[i].id });
  }
  startGame(game, 'p0');
  // L'ordre de jeu est tiré au sort : on le remet à plat pour que `p0` commence,
  // sinon chaque test dépendrait de la graine.
  game.state.players.sort((a, b) => a.id.localeCompare(b.id));
  game.state.currentPlayerIndex = 0;
  return game;
}

/** Donne une propriété, éventuellement bâtie, à une joueuse. */
function give(state, spaceId, playerId, { houses = 0, hotel = false, skyscraper = false, depot = false } = {}) {
  Object.assign(state.properties[spaceId], { ownerId: playerId, houses, hotel, skyscraper, depot });
}

// — Le plateau ————————————————————————————————————————————————

test('le plateau compte 52 cases, quatre coins également espacés', () => {
  assert.equal(MEGA.board.length, 52);
  const corners = MEGA.board.filter((s) => s.corner).map((s) => s.id);
  assert.deepEqual(corners, [0, 13, 26, 39]);
  assert.deepEqual(
    corners.map((id) => MEGA.board[id].type),
    ['go', 'jail', 'free_parking', 'go_to_jail'],
  );
});

test('les neuf titres ajoutés portent bien les groupes annoncés', () => {
  const sizes = Object.fromEntries(Object.entries(MEGA.groups).map(([id, g]) => [id, g.size]));
  assert.deepEqual(sizes, {
    brown: 3, lightblue: 4, pink: 4, orange: 4, red: 4,
    yellow: 4, green: 4, darkblue: 3, railroad: 4, utility: 3,
  });
  // 22 terrains classiques + 8 nouveaux, plus une troisième compagnie.
  assert.equal(MEGA.board.filter((s) => s.type === 'property').length, 30);
  assert.equal(MEGA.board.filter((s) => s.type === 'utility').length, 3);
});

test('les trois cases spéciales sont posées où la boîte les met', () => {
  assert.equal(MEGA.board[14].type, 'auction_space');
  assert.equal(MEGA.board[32].type, 'bus_ticket');
  assert.equal(MEGA.board[47].type, 'birthday_gift');
});

test('huit joueuses tiennent à table, la neuvième est refusée', () => {
  const game = createGame('MEGA08', 'p0', { seed: 1, editionId: 'mega-edition' });
  for (let i = 0; i < 8; i++) {
    assert.ok(addPlayer(game, { id: `p${i}`, name: `J${i}`, token: null }).ok, `la joueuse ${i} doit entrer`);
  }
  assert.equal(addPlayer(game, { id: 'p8', name: 'J8', token: null }).ok, false);
  // Et la limite des autres boîtes n'a pas bougé.
  assert.equal(getEdition('classic-fr').playerCount.max, 6);
});

test('chaque joueuse démarre avec 2 500 €', () => {
  const game = newGame({ players: 3 });
  for (const player of game.state.players) assert.equal(player.cash, 2500);
});

// — Règle de majorité ——————————————————————————————————————————

test('la majorité suffit à bâtir : 3 propriétés sur 4, 2 sur 3', () => {
  const game = newGame();
  const { state } = game;

  // Orange : quatre cases (21, 23, 24, 25). Deux ne suffisent pas.
  give(state, 21, 'p0');
  give(state, 23, 'p0');
  assert.equal(canBuild(state, 'p0', 21).ok, false);

  give(state, 24, 'p0');
  assert.equal(canBuild(state, 'p0', 21).ok, true, 'trois sur quatre doivent suffire');

  // Marron : trois cases (1, 3, 4). Deux suffisent.
  give(state, 1, 'p0');
  assert.equal(canBuild(state, 'p0', 1).ok, false);
  give(state, 3, 'p0');
  assert.equal(canBuild(state, 'p0', 1).ok, true, 'deux sur trois doivent suffire');
});

test('le classique, lui, exige toujours le groupe entier', () => {
  const game = createGame('CLS001', 'p0', { seed: 3, editionId: 'classic-fr' });
  addPlayer(game, { id: 'p0', name: 'A', token: null });
  addPlayer(game, { id: 'p1', name: 'B', token: null });
  startGame(game, 'p0');
  const { state } = game;
  give(state, 6, 'p0');
  give(state, 8, 'p0');
  assert.equal(canBuild(state, 'p0', 6).ok, false, 'deux bleu ciel sur trois ne doivent pas suffire');
  give(state, 9, 'p0');
  assert.equal(canBuild(state, 'p0', 6).ok, true);
});

test('la répartition égale ne compte que les terrains qu’on possède', () => {
  const game = newGame();
  const { state } = game;
  // Trois oranges sur quatre, la quatrième à l'adversaire : sans ce garde-fou,
  // son niveau zéro interdirait toute construction.
  give(state, 21, 'p0', { houses: 1 });
  give(state, 23, 'p0');
  give(state, 24, 'p0');
  give(state, 25, 'p1');
  assert.equal(canBuild(state, 'p0', 21).ok, false, 'on bâtit d’abord les moins bâties');
  assert.equal(canBuild(state, 'p0', 23).ok, true);
});

test('le loyer nu passe au double sur majorité, au triple sous un gratte-ciel', () => {
  const game = newGame();
  const { state } = game;
  const base = state.properties[21] && MEGA.board[21].rent[0];

  give(state, 21, 'p0');
  assert.equal(rentFor(state, 21), base, 'une seule case du groupe : tarif simple');

  give(state, 23, 'p0');
  give(state, 24, 'p0');
  assert.equal(rentFor(state, 21), base * 2, 'majorité : tarif double');

  give(state, 25, 'p0');
  Object.assign(state.properties[23], { hotel: false, skyscraper: true });
  assert.equal(rentFor(state, 21), base * 3, 'un gratte-ciel dans le groupe : tarif triple');
});

// — Gratte-ciels ————————————————————————————————————————————————

test('le gratte-ciel réclame le groupe entier coiffé d’hôtels', () => {
  const game = newGame();
  const { state } = game;
  // Majorité seulement, hôtels partout où c'est à nous : pas de gratte-ciel.
  give(state, 21, 'p0', { hotel: true });
  give(state, 23, 'p0', { hotel: true });
  give(state, 24, 'p0', { hotel: true });
  give(state, 25, 'p1');
  assert.equal(canBuild(state, 'p0', 21).ok, false);

  give(state, 25, 'p0');
  assert.equal(canBuild(state, 'p0', 21).ok, false, 'il manque un hôtel sur la quatrième');

  state.properties[25].hotel = true;
  const check = canBuild(state, 'p0', 21);
  assert.equal(check.ok, true);
  assert.equal(check.isSkyscraper, true);
});

test('le gratte-ciel ajoute la prime de son groupe au tarif de l’hôtel', () => {
  const game = newGame();
  const { state } = game;
  give(state, 21, 'p0', { skyscraper: true }); // orange : prime de 500
  give(state, 51, 'p0', { skyscraper: true }); // bleu foncé : prime de 1000
  assert.equal(rentFor(state, 21), MEGA.board[21].rent[5] + 500);
  assert.equal(rentFor(state, 51), MEGA.board[51].rent[5] + 1000);
  assert.equal(buildingLevel(state.properties[21]), 6);
});

test('se bâtir puis se revendre : le gratte-ciel redescend à l’hôtel', () => {
  const game = newGame();
  const { state } = game;
  for (const id of [21, 23, 24, 25]) give(state, id, 'p0', { hotel: true });
  state.bank.hotels -= 4;
  const before = state.players[0].cash;

  assert.ok(dispatch(game, 'p0', { type: 'BUILD_HOUSE', spaceId: 21 }).ok);
  assert.equal(state.properties[21].skyscraper, true);
  assert.equal(state.properties[21].hotel, false);
  assert.equal(state.players[0].cash, before - MEGA.board[21].houseCost);

  assert.ok(dispatch(game, 'p0', { type: 'SELL_BUILDING', spaceId: 21 }).ok);
  assert.equal(state.properties[21].skyscraper, false);
  assert.equal(state.properties[21].hotel, true, 'il redevient l’hôtel qu’il coiffait');
});

// — Dépôts de train ————————————————————————————————————————————

test('un dépôt se pose sur une gare seule et double son loyer', () => {
  const game = newGame();
  const { state } = game;
  give(state, 6, 'p0');
  give(state, 20, 'p0');
  const twoStations = rentFor(state, 6);

  const check = canBuild(state, 'p0', 6);
  assert.equal(check.ok, true, 'pas besoin des quatre gares');
  assert.equal(check.cost, 100);

  assert.ok(dispatch(game, 'p0', { type: 'BUILD_HOUSE', spaceId: 6 }).ok);
  assert.equal(state.properties[6].depot, true);
  assert.equal(rentFor(state, 6), twoStations * 2);
  assert.equal(rentFor(state, 20), twoStations, 'la gare voisine n’est pas concernée');

  // Une carte « la gare la plus proche » double encore : quadruple en tout.
  assert.equal(rentFor(state, 6, { multiplier: 2 }), twoStations * 4);
});

test('un dépôt bloque l’hypothèque de sa gare, pas celle des autres', () => {
  const game = newGame();
  const { state } = game;
  give(state, 6, 'p0', { depot: true });
  give(state, 20, 'p0');
  assert.equal(canMortgage(state, 'p0', 6).ok, false);
  assert.equal(canMortgage(state, 'p0', 20).ok, true);
  // Et il compte dans ce qu'on peut réunir en cas de coup dur.
  const raisable = maxRaisable(state, 'p0');
  assert.ok(raisable >= state.players[0].cash + 50, 'la revente du dépôt doit compter');
});

// — Compagnies ————————————————————————————————————————————————

test('trois compagnies font payer vingt fois le jet', () => {
  const game = newGame();
  const { state } = game;
  give(state, 10, 'p0');
  assert.equal(rentFor(state, 10, { diceTotal: 7 }), 7 * 4);
  give(state, 17, 'p0');
  assert.equal(rentFor(state, 10, { diceTotal: 7 }), 7 * 10);
  give(state, 36, 'p0');
  assert.equal(rentFor(state, 10, { diceTotal: 7 }), 7 * 20);
  // Une carte « la compagnie la plus proche » impose son propre multiple.
  assert.equal(rentFor(state, 10, { diceTotal: 7, utilityFactor: 10 }), 7 * 10);
});

// — Dé rapide ——————————————————————————————————————————————————

/** Une partie où le prochain jet est imposé : deux dés blancs puis le dé rapide. */
function scripted(dice, { players = 2 } = {}) {
  const game = newGame({ players });
  game.rng = scriptedRng([dice]);
  return game;
}

/**
 * Fait arriver une joueuse exactement sur la case voulue : 1 + 2 sur les dés
 * blancs (surtout pas un double) et 1 sur le dé rapide, soit quatre cases.
 */
function rollTo(game, playerId, target) {
  const size = game.state.players.length && 52;
  game.state.players.find((p) => p.id === playerId).position = (target - 4 + size) % size;
  game.state.currentPlayerIndex = game.state.players.findIndex((p) => p.id === playerId);
  game.state.pending = { kind: 'roll', playerIds: [playerId], payload: {} };
  game.rng = scriptedRng([[1, 2, 1]]);
  return dispatch(game, playerId, { type: 'ROLL_DICE' });
}

test('une face chiffrée s’ajoute au déplacement, jamais au loyer de compagnie', () => {
  // 2 + 5 sur les blancs, 3 sur le dé rapide : dix cases en tout.
  const game = scripted([2, 5, 3]);
  const { state } = game;
  state.players[0].position = 0;
  dispatch(game, 'p0', { type: 'ROLL_DICE' });
  assert.equal(state.players[0].position, 10);
  assert.equal(state.speedDie.face, 3);

  // La compagnie du Gaz est en 10 : le loyer se calcule sur les deux dés blancs.
  give(state, 10, 'p1');
  assert.equal(rentFor(state, 10, { diceTotal: 7 }), 28);
});

test('Mr Monopoly rejoue une fois la première case réglée', () => {
  // 1 + 2 sur les blancs, index 4 → face « mr_monopoly ».
  const game = scripted([1, 2, 4]);
  const { state } = game;
  state.players[0].position = 0;

  dispatch(game, 'p0', { type: 'ROLL_DICE' });
  // Case 3 (Rue Lecourbe, libre) : la première invite est un achat.
  assert.equal(state.pending.kind, 'buy_or_auction');
  assert.equal(state.pending.payload.spaceId, 3);
  assert.equal(state.postMove?.type, 'mr_monopoly');

  dispatch(game, 'p0', { type: 'BUY_PROPERTY' });
  // Le second déplacement s'est joué tout seul : la prochaine case libre est 4.
  assert.equal(state.players[0].position, 4);
  assert.equal(state.pending.kind, 'buy_or_auction');
  assert.equal(state.pending.payload.spaceId, 4);
  assert.equal(state.postMove, null);
});

test('Mr Monopoly ne rejoue pas depuis la prison', () => {
  // 4 + 5 sur les blancs depuis la case 30 → case 39, « Allez en prison ».
  const game = scripted([4, 5, 4]);
  const { state } = game;
  state.players[0].position = 30;
  dispatch(game, 'p0', { type: 'ROLL_DICE' });
  assert.equal(state.players[0].inJail, true);
  assert.equal(state.players[0].position, 13);
  assert.equal(state.postMove, null, 'le déplacement différé doit être abandonné');
});

test('un triple identique laisse choisir sa case et ne fait pas rejouer', () => {
  // 3 + 3 sur les blancs, index 3 → face 3 : triple.
  const game = scripted([3, 3, 3]);
  const { state } = game;
  dispatch(game, 'p0', { type: 'ROLL_DICE' });

  assert.equal(state.pending.kind, 'choose_space');
  assert.equal(state.pending.payload.spaceIds.length, 52, 'tout le plateau est ouvert');
  assert.equal(state.dice.extraRoll, false, 'un triple ne rejoue pas');

  dispatch(game, 'p0', { type: 'CHOOSE_SPACE', spaceId: 49 });
  assert.equal(state.players[0].position, 49);
});

test('les doubles n’envoient jamais en prison dans cette boîte', () => {
  const game = newGame();
  const { state } = game;
  state.dice.doublesCount = 5;
  game.rng = scriptedRng([[2, 2, 1]]);
  dispatch(game, 'p0', { type: 'ROLL_DICE' });
  assert.equal(state.players[0].inJail, false);
  assert.equal(state.dice.extraRoll, true, 'mais un double fait bien rejouer');
});

test('le dé rapide ne sert ni en prison ni au tirage de l’ordre de jeu', () => {
  const game = newGame();
  const { state } = game;
  state.players[0].inJail = true;
  state.players[0].position = 13;
  game.rng = scriptedRng([[2, 5]]);
  dispatch(game, 'p0', { type: 'ROLL_DICE' });
  assert.equal(state.speedDie, null, 'aucun troisième dé en cellule');
});

// — Tickets de bus ————————————————————————————————————————————

test('la pioche de tickets est brassée et se vide ticket par ticket', () => {
  const game = newGame();
  assert.equal(game.state.busTickets.length, 15);
  assert.equal(game.state.busTickets.filter((t) => t.expires).length, 4);
});

test('un ticket dessert les cases devant soi jusqu’au prochain coin', () => {
  const game = newGame();
  const { state } = game;
  assert.deepEqual(busDestinations(state, 0), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.deepEqual(busDestinations(state, 24), [25, 26]);
  assert.deepEqual(busDestinations(state, 13), [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]);
});

test('la case Ticket de Bus en donne un, puis ne fait plus rien', () => {
  const game = newGame();
  const { state } = game;
  rollTo(game, 'p0', 32);
  assert.equal(state.players[0].position, 32);
  assert.equal(state.players[0].busTickets.length, 1);
  assert.equal(state.busTickets.length, 14);

  // Pioche vide : la case devient un second Parc Gratuit.
  state.busTickets = [];
  rollTo(game, 'p0', 32);
  assert.equal(state.players[0].busTickets.length, 1, 'aucun ticket de plus');
});

test('un ticket se joue à la place du lancer, et certains périment les autres', () => {
  const game = newGame({ players: 3 });
  const { state } = game;
  state.players[0].position = 0;
  state.players[0].busTickets = [{ id: 'bus-a', expires: true }];
  state.players[1].busTickets = [{ id: 'bus-b', expires: false }];
  state.players[2].busTickets = [{ id: 'bus-c', expires: false }];
  state.pending = { kind: 'roll', playerIds: ['p0'], payload: {} };

  assert.ok(dispatch(game, 'p0', { type: 'USE_BUS_TICKET', ticketId: 'bus-a' }).ok);
  assert.equal(state.pending.kind, 'choose_space');
  assert.deepEqual(state.pending.payload.spaceIds, busDestinations(state, 0));

  assert.ok(dispatch(game, 'p0', { type: 'CHOOSE_SPACE', spaceId: 12 }).ok);
  assert.equal(state.players[0].position, 12);
  // Le ticket périmait tous les autres — le sien y compris, déjà consommé.
  assert.deepEqual(state.players.map((p) => p.busTickets.length), [0, 0, 0]);
});

test('une case hors du côté courant est refusée au ticket', () => {
  const game = newGame();
  const { state } = game;
  state.players[0].position = 0;
  state.players[0].busTickets = [{ id: 'bus-a', expires: false }];
  state.pending = { kind: 'roll', playerIds: ['p0'], payload: {} };
  dispatch(game, 'p0', { type: 'USE_BUS_TICKET' });
  assert.equal(dispatch(game, 'p0', { type: 'CHOOSE_SPACE', spaceId: 30 }).ok, false);
});

// — Cases spéciales ————————————————————————————————————————————

test('la case Enchères met une propriété de la banque en vente', () => {
  const game = newGame({ players: 3 });
  const { state } = game;
  rollTo(game, 'p0', 14);

  assert.equal(state.players[0].position, 14);
  assert.equal(state.pending.kind, 'choose_space');
  assert.equal(state.pending.payload.then, 'auction');

  assert.ok(dispatch(game, 'p0', { type: 'CHOOSE_SPACE', spaceId: 51 }).ok);
  assert.equal(state.pending.kind, 'auction_bid');
  assert.equal(state.auction.spaceId, 51);
});

test('plus rien à vendre : la case Enchères pousse vers le loyer le plus cher', () => {
  const game = newGame();
  const { state } = game;
  // Tout est possédé, et le plus gros loyer devant n'est pas le plus proche.
  for (const prop of Object.values(state.properties)) prop.ownerId = 'p1';
  state.properties[16].houses = 4; // Boulevard de la Villette, bien bâti
  rollTo(game, 'p0', 14);

  assert.equal(state.players[0].position, 16, 'le plus gros loyer devant, pas le plus proche');
});

test('le cadeau d’anniversaire laisse choisir, ou verse d’office', () => {
  const game = newGame();
  const { state } = game;
  rollTo(game, 'p0', 47);
  assert.equal(state.players[0].position, 47);
  assert.equal(state.pending.kind, 'card_choice');
  assert.equal(state.pending.payload.options.length, 2);

  const before = state.players[0].cash;
  dispatch(game, 'p0', { type: 'CARD_CHOICE', optionIndex: 0 });
  assert.equal(state.players[0].cash, before + 100);
});

test('sans ticket en pioche, le cadeau verse d’office', () => {
  const game = newGame();
  const { state } = game;
  state.busTickets = [];
  const before = state.players[0].cash;
  rollTo(game, 'p0', 47);
  assert.equal(state.pending.kind, 'end_turn', 'aucun choix à faire');
  assert.equal(state.players[0].cash, before + 100);
});

// — La partie complète ————————————————————————————————————————

test('une partie à huit tourne sans invariant cassé', () => {
  const game = createGame('MEGA88', 'h', { seed: 20260824, editionId: 'mega-edition' });
  for (let i = 0; i < 8; i++) addPlayer(game, { id: `p${i}`, name: `J${i}`, token: null });
  startGame(game, 'p0');

  const rng = createRng(11);
  for (let step = 0; step < 4000 && game.state.phase === 'playing'; step++) {
    const { kind, playerIds, payload } = game.state.pending;
    if (!kind) break;
    const actor = playerIds[0];
    const player = game.state.players.find((p) => p.id === actor);
    let action;
    switch (kind) {
      case 'roll': action = { type: 'ROLL_DICE' }; break;
      case 'buy_or_auction':
        action = player.cash >= payload.price * 1.4 ? { type: 'BUY_PROPERTY' } : { type: 'DECLINE_PROPERTY' };
        break;
      case 'auction_bid': {
        const bid = game.state.auction.highestBid + 20;
        action = bid <= player.cash && rng.next() > 0.5 ? { type: 'AUCTION_BID', amount: bid } : { type: 'AUCTION_PASS' };
        break;
      }
      case 'draw_card': action = { type: 'DRAW_CARD' }; break;
      case 'card_reveal': action = { type: 'ACKNOWLEDGE_CARD' }; break;
      case 'card_choice': action = { type: 'CARD_CHOICE', optionIndex: rng.int(payload.options.length) }; break;
      case 'choose_space': action = { type: 'CHOOSE_SPACE', spaceId: payload.spaceIds[rng.int(payload.spaceIds.length)] }; break;
      case 'bus_choice': action = { type: 'BUS_CHOICE', choice: payload.canTake ? 'take' : 'use' }; break;
      case 'pay_debt':
        action = player.cash >= game.state.debt.amount ? { type: 'PAY_DEBT' } : { type: 'DECLARE_BANKRUPTCY' };
        break;
      case 'end_turn': action = { type: 'END_TURN' }; break;
      default: throw new Error(`pilote de test : « ${kind} » non géré`);
    }
    const result = dispatch(game, actor, action);
    assert.ok(result.ok, `${kind} refusé : ${result.error}`);

    for (const p of game.state.players) {
      assert.ok(p.cash >= 0, `solde négatif pour ${p.name}`);
      assert.ok(p.position >= 0 && p.position < 52, `${p.name} hors plateau (${p.position})`);
    }
    assert.ok(game.state.bank.skyscrapers >= 0, 'stock de gratte-ciels négatif');
  }
  assert.ok(game.state.turnCount > 40, 'la partie doit avoir vraiment tourné');
});

test('les quatre faces du dé rapide sortent toutes sur une longue partie', () => {
  const game = createGame('MEGAFA', 'h', { seed: 99, editionId: 'mega-edition' });
  for (let i = 0; i < 4; i++) addPlayer(game, { id: `p${i}`, name: `J${i}`, token: null });
  startGame(game, 'p0');

  const seen = new Set();
  const rng = createRng(5);
  for (let step = 0; step < 3000 && game.state.phase === 'playing'; step++) {
    const { kind, playerIds, payload } = game.state.pending;
    if (!kind) break;
    const actor = playerIds[0];
    const player = game.state.players.find((p) => p.id === actor);
    const action =
      kind === 'roll' ? { type: 'ROLL_DICE' }
      : kind === 'buy_or_auction' ? { type: 'DECLINE_PROPERTY' }
      : kind === 'auction_bid' ? { type: 'AUCTION_PASS' }
      : kind === 'draw_card' ? { type: 'DRAW_CARD' }
      : kind === 'card_reveal' ? { type: 'ACKNOWLEDGE_CARD' }
      : kind === 'card_choice' ? { type: 'CARD_CHOICE', optionIndex: 0 }
      : kind === 'choose_space' ? { type: 'CHOOSE_SPACE', spaceId: payload.spaceIds[rng.int(payload.spaceIds.length)] }
      : kind === 'bus_choice' ? { type: 'BUS_CHOICE', choice: payload.canTake ? 'take' : 'use' }
      : kind === 'pay_debt'
        ? (player.cash >= game.state.debt.amount ? { type: 'PAY_DEBT' } : { type: 'DECLARE_BANKRUPTCY' })
      : { type: 'END_TURN' };
    dispatch(game, actor, action);
    if (game.state.speedDie) seen.add(game.state.speedDie.kind);
  }
  assert.deepEqual([...seen].sort(), ['bus', 'mr_monopoly', 'number']);
});
