import test from 'node:test';
import assert from 'node:assert/strict';

import { newGame, forceDice, act, give, setCash, place, dispatch, playerById } from './helpers.js';
import { rentFor, maxRaisable } from '../server/engine/queries.js';
import { applyCardAction, drawCard, applyRevealedCard, returnJailCard } from '../server/engine/cards.js';

// ————————————————————————————————————— Tour de jeu

test('un lancer déplace le pion et propose l\'achat de la case', () => {
  const game = newGame();
  forceDice(game, [3, 4]); // 7 → Chance ? non : 0 + 7 = case 7… on vise une propriété
  place(game, 'p0', 0);
  forceDice(game, [2, 4]); // 6 → Rue de Vaugirard
  act(game, 'p0', { type: 'ROLL_DICE' });

  assert.equal(playerById(game.state, 'p0').position, 6);
  assert.equal(game.state.pending.kind, 'buy_or_auction');
  assert.equal(game.state.pending.payload.spaceId, 6);
  assert.equal(game.state.pending.payload.price, 100);
});

test('acheter débite le solde et inscrit la propriétaire', () => {
  const game = newGame();
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });
  act(game, 'p0', { type: 'BUY_PROPERTY' });

  assert.equal(playerById(game.state, 'p0').cash, 1400);
  assert.equal(game.state.properties[6].ownerId, 'p0');
  assert.equal(game.state.pending.kind, 'end_turn');
});

test('passer par la case Départ rapporte 200 €', () => {
  const game = newGame();
  place(game, 'p0', 38);
  forceDice(game, [2, 3]); // 38 + 5 = 43 → case 3
  act(game, 'p0', { type: 'ROLL_DICE' });

  assert.equal(playerById(game.state, 'p0').position, 3);
  assert.equal(playerById(game.state, 'p0').cash, 1700);
});

test('un double redonne la main à la même joueuse', () => {
  const game = newGame();
  forceDice(game, [3, 3]);
  act(game, 'p0', { type: 'ROLL_DICE' });
  act(game, 'p0', { type: 'DECLINE_PROPERTY' }); // case 6, on laisse filer
  // L'enchère qui suit doit d'abord être vidée.
  act(game, 'p0', { type: 'AUCTION_PASS' });
  act(game, 'p1', { type: 'AUCTION_PASS' });

  assert.equal(game.state.pending.kind, 'end_turn');
  act(game, 'p0', { type: 'END_TURN' });
  assert.equal(game.state.pending.kind, 'roll');
  assert.deepEqual(game.state.pending.playerIds, ['p0'], 'la même joueuse rejoue');
});

test('trois doubles d\'affilée envoient en prison', () => {
  const game = newGame();
  forceDice(game, [5, 5, 5, 5, 5, 5]); // 10 (simple visite), 20 (parc gratuit), puis prison
  act(game, 'p0', { type: 'ROLL_DICE' });
  act(game, 'p0', { type: 'END_TURN' });
  act(game, 'p0', { type: 'ROLL_DICE' });
  act(game, 'p0', { type: 'END_TURN' });
  act(game, 'p0', { type: 'ROLL_DICE' });

  const player = playerById(game.state, 'p0');
  assert.equal(player.inJail, true);
  assert.equal(player.position, 10);
  assert.equal(game.state.pending.kind, 'end_turn');
  act(game, 'p0', { type: 'END_TURN' });
  assert.deepEqual(game.state.pending.playerIds, ['p1'], 'pas de tour supplémentaire');
});

test('on ne peut pas jouer à la place d\'une autre', () => {
  const game = newGame();
  const result = dispatch(game, 'p1', { type: 'ROLL_DICE' });
  assert.equal(result.ok, false);
  assert.match(result.error, /pas à vous/i);
});

// ————————————————————————————————————— Loyers

test('le loyer d\'un terrain nu double si le groupe est complet', () => {
  const game = newGame();
  give(game, 'p1', [1]);
  assert.equal(rentFor(game.state, 1), 2, 'groupe incomplet');
  give(game, 'p1', [3]);
  assert.equal(rentFor(game.state, 1), 4, 'groupe complet → loyer doublé');
});

test('le loyer suit le nombre de constructions', () => {
  const game = newGame();
  give(game, 'p1', [1, 3], { houses: 3 });
  assert.equal(rentFor(game.state, 1), 90);
  give(game, 'p1', [1], { hotel: true });
  assert.equal(rentFor(game.state, 1), 250);
});

test('une propriété hypothéquée ne rapporte aucun loyer', () => {
  const game = newGame();
  give(game, 'p1', [1, 3], { mortgaged: true });
  assert.equal(rentFor(game.state, 1), 0);
});

test('le loyer des gares dépend du nombre de gares possédées', () => {
  const game = newGame();
  give(game, 'p1', [5]);
  assert.equal(rentFor(game.state, 5), 25);
  give(game, 'p1', [15, 25]);
  assert.equal(rentFor(game.state, 5), 100);
  give(game, 'p1', [35]);
  assert.equal(rentFor(game.state, 5), 200);
});

test('le loyer des compagnies se calcule sur le jet de dés', () => {
  const game = newGame();
  give(game, 'p1', [12]);
  assert.equal(rentFor(game.state, 12, { diceTotal: 7 }), 28, 'une compagnie → dés × 4');
  give(game, 'p1', [28]);
  assert.equal(rentFor(game.state, 12, { diceTotal: 7 }), 70, 'deux compagnies → dés × 10');
});

test('atterrir chez une autre joueuse transfère le loyer', () => {
  const game = newGame();
  give(game, 'p1', [6]);
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });

  assert.equal(playerById(game.state, 'p0').cash, 1494);
  assert.equal(playerById(game.state, 'p1').cash, 1506);
});

// ————————————————————————————————————— Construction

test('on ne construit qu\'avec le groupe complet et de façon répartie', () => {
  const game = newGame();
  give(game, 'p0', [1]);
  assert.match(dispatch(game, 'p0', { type: 'BUILD_HOUSE', spaceId: 1 }).error, /groupe de couleur/);

  give(game, 'p0', [3]);
  act(game, 'p0', { type: 'BUILD_HOUSE', spaceId: 1 });
  const second = dispatch(game, 'p0', { type: 'BUILD_HOUSE', spaceId: 1 });
  assert.equal(second.ok, false);
  assert.match(second.error, /répartie/);

  act(game, 'p0', { type: 'BUILD_HOUSE', spaceId: 3 });
  assert.equal(game.state.properties[1].houses, 1);
  assert.equal(game.state.properties[3].houses, 1);
  assert.equal(playerById(game.state, 'p0').cash, 1400);
  assert.equal(game.state.bank.houses, 30);
});

test('la cinquième maison devient un hôtel et rend 4 maisons à la banque', () => {
  const game = newGame();
  give(game, 'p0', [1, 3], { houses: 4 });
  game.state.bank.houses -= 8;
  act(game, 'p0', { type: 'BUILD_HOUSE', spaceId: 1 });

  assert.equal(game.state.properties[1].hotel, true);
  assert.equal(game.state.properties[1].houses, 0);
  assert.equal(game.state.bank.hotels, 11);
  assert.equal(game.state.bank.houses, 28, 'les 4 maisons retournent au stock');
});

test('le stock de la banque bloque la construction', () => {
  const game = newGame();
  give(game, 'p0', [1, 3]);
  game.state.bank.houses = 0;
  const result = dispatch(game, 'p0', { type: 'BUILD_HOUSE', spaceId: 1 });
  assert.equal(result.ok, false);
  assert.match(result.error, /plus de maison/);
});

test('revendre une maison rembourse la moitié du prix', () => {
  const game = newGame();
  give(game, 'p0', [1, 3], { houses: 1 });
  act(game, 'p0', { type: 'SELL_BUILDING', spaceId: 1 });
  assert.equal(game.state.properties[1].houses, 0);
  assert.equal(playerById(game.state, 'p0').cash, 1525);
});

// ————————————————————————————————————— Hypothèques

test('hypothéquer rapporte la valeur, lever coûte 10 % de plus', () => {
  const game = newGame();
  give(game, 'p0', [1]);
  act(game, 'p0', { type: 'MORTGAGE', spaceId: 1 });
  assert.equal(game.state.properties[1].mortgaged, true);
  assert.equal(playerById(game.state, 'p0').cash, 1530);

  act(game, 'p0', { type: 'UNMORTGAGE', spaceId: 1 });
  assert.equal(game.state.properties[1].mortgaged, false);
  assert.equal(playerById(game.state, 'p0').cash, 1497, '30 € + 10 % = 33 €');
});

test('on ne peut pas hypothéquer un terrain construit', () => {
  const game = newGame();
  give(game, 'p0', [1, 3], { houses: 1 });
  const result = dispatch(game, 'p0', { type: 'MORTGAGE', spaceId: 1 });
  assert.equal(result.ok, false);
  assert.match(result.error, /constructions/);
});

// ————————————————————————————————————— Prison

test('payer la caution libère avant le lancer', () => {
  const game = newGame();
  const player = playerById(game.state, 'p0');
  player.inJail = true;
  player.position = 10;
  game.state.pending = { kind: 'roll', playerIds: ['p0'], payload: { inJail: true } };

  act(game, 'p0', { type: 'PAY_BAIL' });
  assert.equal(player.inJail, false);
  assert.equal(player.cash, 1450);
  assert.equal(game.state.pending.kind, 'roll');
});

test('un double en prison libère mais ne donne pas de tour supplémentaire', () => {
  const game = newGame();
  const player = playerById(game.state, 'p0');
  player.inJail = true;
  player.position = 10;
  forceDice(game, [4, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });

  assert.equal(player.inJail, false);
  assert.equal(player.position, 18);
  act(game, 'p0', { type: 'DECLINE_PROPERTY' });
  act(game, 'p0', { type: 'AUCTION_PASS' });
  act(game, 'p1', { type: 'AUCTION_PASS' });
  act(game, 'p0', { type: 'END_TURN' });
  assert.deepEqual(game.state.pending.playerIds, ['p1']);
});

test('au troisième échec, la caution est payée d\'office', () => {
  const game = newGame();
  const player = playerById(game.state, 'p0');
  player.inJail = true;
  player.position = 10;
  player.jailTurns = 2;
  forceDice(game, [1, 2]);
  act(game, 'p0', { type: 'ROLL_DICE' });

  assert.equal(player.inJail, false);
  assert.equal(player.cash, 1450, 'caution de 50 € prélevée');
  assert.equal(player.position, 13);
});

test('la case Allez en Prison envoie bien en prison', () => {
  const game = newGame();
  place(game, 'p0', 25);
  forceDice(game, [2, 3]);
  act(game, 'p0', { type: 'ROLL_DICE' });
  assert.equal(playerById(game.state, 'p0').position, 10);
  assert.equal(playerById(game.state, 'p0').inJail, true);
});

// ————————————————————————————————————— Enchères

test('refuser un achat ouvre une enchère remportée par la dernière en lice', () => {
  const game = newGame(['Julie', 'Sophie', 'Marc']);
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });
  act(game, 'p0', { type: 'DECLINE_PROPERTY' });

  assert.equal(game.state.pending.kind, 'auction_bid');
  act(game, 'p0', { type: 'AUCTION_BID', amount: 20 });
  act(game, 'p1', { type: 'AUCTION_BID', amount: 50 });
  act(game, 'p2', { type: 'AUCTION_PASS' });
  act(game, 'p0', { type: 'AUCTION_PASS' });

  assert.equal(game.state.properties[6].ownerId, 'p1');
  assert.equal(playerById(game.state, 'p1').cash, 1450);
  assert.equal(game.state.auction, null);
  assert.equal(game.state.pending.kind, 'end_turn');
});

test('une enchère sans aucune mise laisse la propriété à la banque', () => {
  const game = newGame();
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });
  act(game, 'p0', { type: 'DECLINE_PROPERTY' });
  act(game, 'p0', { type: 'AUCTION_PASS' });
  act(game, 'p1', { type: 'AUCTION_PASS' });

  assert.equal(game.state.properties[6].ownerId, null);
});

test('on ne peut pas miser plus que son solde', () => {
  const game = newGame();
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });
  act(game, 'p0', { type: 'DECLINE_PROPERTY' });
  const result = dispatch(game, 'p0', { type: 'AUCTION_BID', amount: 5000 });
  assert.equal(result.ok, false);
  assert.match(result.error, /solde/);
});

// ————————————————————————————————————— Dettes et faillite

test('une dette impayable met la partie en attente puis se solde par une hypothèque', () => {
  const game = newGame();
  give(game, 'p1', [6], { });
  give(game, 'p1', [8]);
  give(game, 'p1', [9]); // groupe bleu ciel complet → loyer doublé = 12 €
  setCash(game, 'p0', 5);
  give(game, 'p0', [1]);
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });

  assert.equal(game.state.debt.amount, 12);
  assert.equal(game.state.pending.kind, 'pay_debt');
  assert.equal(game.state.pending.payload.canPay, true);

  act(game, 'p0', { type: 'MORTGAGE', spaceId: 1 });
  assert.equal(game.state.debt, null);
  assert.equal(playerById(game.state, 'p0').cash, 23, '5 + 30 − 12');
  assert.equal(game.state.pending.kind, 'end_turn');
});

test('une faillite envers une joueuse lui transfère tout', () => {
  const game = newGame();
  give(game, 'p1', [6, 8, 9], { houses: 4 });
  setCash(game, 'p0', 10);
  give(game, 'p0', [1, 3]);
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });

  assert.equal(game.state.debt.amount, 400);
  assert.equal(game.state.pending.payload.canPay, false);
  act(game, 'p0', { type: 'DECLARE_BANKRUPTCY' });

  assert.equal(playerById(game.state, 'p0').bankrupt, true);
  assert.equal(game.state.properties[1].ownerId, 'p1');
  assert.equal(game.state.properties[3].ownerId, 'p1');
  assert.equal(game.state.phase, 'finished');
  assert.equal(game.state.winnerId, 'p1');
});

test('une faillite envers la banque remet les biens aux enchères', () => {
  const game = newGame(['Julie', 'Sophie', 'Marc']);
  setCash(game, 'p0', 10);
  give(game, 'p0', [1]);
  place(game, 'p0', 2);
  forceDice(game, [1, 1]); // case 4 : impôt sur le revenu, 200 €
  act(game, 'p0', { type: 'ROLL_DICE' });

  assert.equal(game.state.debt.amount, 200);
  act(game, 'p0', { type: 'DECLARE_BANKRUPTCY' });

  assert.equal(game.state.properties[1].ownerId, null);
  assert.equal(game.state.pending.kind, 'auction_bid', 'le bien part aux enchères');
  act(game, 'p1', { type: 'AUCTION_BID', amount: 10 });
  act(game, 'p2', { type: 'AUCTION_PASS' });

  assert.equal(game.state.properties[1].ownerId, 'p1');
  assert.equal(game.state.pending.kind, 'roll', 'la partie reprend au tour suivant');
  assert.deepEqual(game.state.pending.playerIds, ['p1']);
});

test('maxRaisable additionne liquide, hypothèques et reventes', () => {
  const game = newGame();
  setCash(game, 'p0', 100);
  give(game, 'p0', [1, 3], { houses: 2 });
  // 100 € + 2 × (2 × 25 €) de maisons + 2 × 30 € d'hypothèques
  assert.equal(maxRaisable(game.state, 'p0'), 100 + 100 + 60);
});

// ————————————————————————————————————— Cartes

test('une carte « avancez à la case Départ » déplace et crédite', () => {
  const game = newGame();
  place(game, 'p0', 30);
  applyCardAction(game.state, 'p0', { type: 'move_to', target: 0, collectGoSalary: true });
  assert.equal(playerById(game.state, 'p0').position, 0);
  assert.equal(playerById(game.state, 'p0').cash, 1700);
});

test('une carte de réparations facture maisons et hôtels', () => {
  const game = newGame();
  give(game, 'p0', [1], { houses: 3 });
  give(game, 'p0', [3], { hotel: true });
  applyCardAction(game.state, 'p0', { type: 'pay_per_building', perHouse: 25, perHotel: 100 });
  assert.equal(playerById(game.state, 'p0').cash, 1500 - 75 - 100);
});

test('la carte anniversaire collecte 10 € auprès de chaque joueuse', () => {
  const game = newGame(['Julie', 'Sophie', 'Marc']);
  applyCardAction(game.state, 'p0', { type: 'collect_from_each', amount: 10 });
  assert.equal(playerById(game.state, 'p0').cash, 1520);
  assert.equal(playerById(game.state, 'p1').cash, 1490);
  assert.equal(playerById(game.state, 'p2').cash, 1490);
});

test('une carte « libérée de prison » est conservée puis rendue à la pile', () => {
  const game = newGame();
  game.state.decks.chance = ['chance-13', 'chance-03'];
  drawCard(game.state, 'p0', 'chance');
  assert.equal(game.state.pending.kind, 'card_reveal', 'la carte est retournée, pas encore appliquée');
  applyRevealedCard(game.state, 'p0');

  assert.equal(playerById(game.state, 'p0').getOutOfJailCards, 1);
  assert.equal(game.state.decks.chance.includes('chance-13'), false, 'la carte quitte la pile');

  returnJailCard(game.state, 'p0');
  assert.equal(playerById(game.state, 'p0').getOutOfJailCards, 0);
  assert.equal(game.state.decks.chance.includes('chance-13'), true, 'elle revient sous la pile');
});

test('les cartes non conservables retournent sous la pile', () => {
  const game = newGame();
  game.state.decks.chance = ['chance-03', 'chance-09'];
  drawCard(game.state, 'p0', 'chance');
  assert.deepEqual(game.state.decks.chance, ['chance-03', 'chance-09'], 'la carte reste sur le tas tant qu\'on ne l\'a pas validée');
  applyRevealedCard(game.state, 'p0');
  assert.deepEqual(game.state.decks.chance, ['chance-09', 'chance-03']);
});

// ————————————————————————————————————— Échanges

test('un échange accepté transfère argent et propriétés', () => {
  const game = newGame();
  give(game, 'p0', [1]);
  give(game, 'p1', [3]);

  act(game, 'p0', {
    type: 'PROPOSE_TRADE',
    toPlayerId: 'p1',
    give: { cash: 100, spaceIds: [1], jailCards: 0 },
    receive: { cash: 0, spaceIds: [3], jailCards: 0 },
  });
  const tradeId = game.state.trades[0].id;
  act(game, 'p1', { type: 'RESPOND_TRADE', tradeId, accept: true });

  assert.equal(game.state.properties[1].ownerId, 'p1');
  assert.equal(game.state.properties[3].ownerId, 'p0');
  assert.equal(playerById(game.state, 'p0').cash, 1400);
  assert.equal(playerById(game.state, 'p1').cash, 1600);
});

test('on ne peut pas échanger un terrain construit', () => {
  const game = newGame();
  give(game, 'p0', [1, 3], { houses: 1 });
  const result = dispatch(game, 'p0', {
    type: 'PROPOSE_TRADE',
    toPlayerId: 'p1',
    give: { spaceIds: [1] },
    receive: {},
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /construite/);
});

test('un échange refusé ne change rien', () => {
  const game = newGame();
  give(game, 'p0', [1]);
  act(game, 'p0', {
    type: 'PROPOSE_TRADE',
    toPlayerId: 'p1',
    give: { spaceIds: [1] },
    receive: { cash: 200 },
  });
  act(game, 'p1', { type: 'RESPOND_TRADE', tradeId: game.state.trades[0].id, accept: false });

  assert.equal(game.state.properties[1].ownerId, 'p0');
  assert.equal(playerById(game.state, 'p1').cash, 1500);
  assert.equal(game.state.trades[0].status, 'declined');
});

// ————————————————————————————————————— Divers

test('le journal enregistre les événements en français', () => {
  const game = newGame();
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });
  act(game, 'p0', { type: 'BUY_PROPERTY' });
  const texts = game.state.log.map((e) => e.text);
  assert.ok(texts.some((t) => /Julie achète Rue de Vaugirard pour 100 €/.test(t)), texts.at(-1));
});

test('chaque action acceptée incrémente la version de l\'état', () => {
  const game = newGame();
  const before = game.state.version;
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });
  assert.equal(game.state.version, before + 1);
  dispatch(game, 'p1', { type: 'ROLL_DICE' }); // refusée
  assert.equal(game.state.version, before + 1);
});

test('le chat accepte les messages et coupe les messages vides', () => {
  const game = newGame();
  act(game, 'p1', { type: 'CHAT', text: '  bien joué !  ' });
  assert.equal(game.state.chat.at(-1).text, 'bien joué !');
  assert.equal(dispatch(game, 'p1', { type: 'CHAT', text: '   ' }).ok, false);
});

// ————————————————————————————————————— Arrangements sur dette

test('un arrangement accepté efface la dette sans payer le montant', () => {
  const game = newGame(['Julie', 'Sophie']);
  give(game, 'p1', [6, 8, 9], { houses: 4 }); // groupe bleu ciel bien bâti
  setCash(game, 'p0', 10);
  give(game, 'p0', [1, 3]);
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });

  assert.equal(game.state.debt.amount, 400, 'loyer largement au-dessus de ses moyens');

  // Julie propose ses deux terrains marron plutôt que de payer.
  act(game, 'p0', {
    type: 'PROPOSE_TRADE',
    toPlayerId: 'p1',
    give: { spaceIds: [1, 3] },
    receive: {},
    settlesDebt: true,
  });
  const tradeId = game.state.trades.at(-1).id;
  assert.equal(game.state.trades.at(-1).settlesDebt, true);
  assert.equal(game.state.trades.at(-1).debtAmount, 400);

  act(game, 'p1', { type: 'RESPOND_TRADE', tradeId, accept: true });

  assert.equal(game.state.debt, null, 'la dette est effacée');
  assert.equal(playerById(game.state, 'p0').bankrupt, false, 'Julie reste en jeu');
  assert.equal(playerById(game.state, 'p0').cash, 10, "elle n'a pas payé le loyer");
  assert.equal(game.state.properties[1].ownerId, 'p1');
  assert.equal(game.state.properties[3].ownerId, 'p1');
  assert.equal(game.state.pending.kind, 'end_turn', 'la partie reprend son cours');
});

test('un arrangement refusé laisse la dette en place', () => {
  const game = newGame(['Julie', 'Sophie']);
  give(game, 'p1', [6, 8, 9], { houses: 4 });
  setCash(game, 'p0', 10);
  give(game, 'p0', [1]);
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });

  act(game, 'p0', {
    type: 'PROPOSE_TRADE',
    toPlayerId: 'p1',
    give: { spaceIds: [1] },
    receive: {},
    settlesDebt: true,
  });
  act(game, 'p1', { type: 'RESPOND_TRADE', tradeId: game.state.trades.at(-1).id, accept: false });

  assert.equal(game.state.debt.amount, 400, 'la dette est toujours là');
  assert.equal(game.state.pending.kind, 'pay_debt');
  assert.equal(game.state.properties[1].ownerId, 'p0', 'rien n\'a changé de main');
});

test('on ne peut proposer un arrangement qu\'à sa créancière et avec une dette', () => {
  const game = newGame(['Julie', 'Sophie', 'Marc']);
  give(game, 'p0', [1]);

  // Sans dette.
  const sansDette = dispatch(game, 'p0', {
    type: 'PROPOSE_TRADE',
    toPlayerId: 'p1',
    give: { spaceIds: [1] },
    receive: {},
    settlesDebt: true,
  });
  assert.equal(sansDette.ok, false);
  assert.match(sansDette.error, /dette/i);

  // Avec une dette, mais adressé à la mauvaise personne.
  give(game, 'p1', [6, 8, 9], { houses: 4 });
  setCash(game, 'p0', 10);
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });
  const mauvaiseCible = dispatch(game, 'p0', {
    type: 'PROPOSE_TRADE',
    toPlayerId: 'p2',
    give: { spaceIds: [1] },
    receive: {},
    settlesDebt: true,
  });
  assert.equal(mauvaiseCible.ok, false);
  assert.match(mauvaiseCible.error, /créancière/i);
});

test('une joueuse endettée peut négocier avec une tierce pour réunir des fonds', () => {
  const game = newGame(['Julie', 'Sophie', 'Marc']);
  give(game, 'p1', [6, 8, 9]); // groupe complet, loyer doublé = 12 €
  setCash(game, 'p0', 5);
  give(game, 'p0', [1]);
  setCash(game, 'p2', 500);
  forceDice(game, [2, 4]);
  act(game, 'p0', { type: 'ROLL_DICE' });
  assert.equal(game.state.pending.kind, 'pay_debt');

  // Julie vend un terrain à Marc, qui n'a rien à voir avec la dette.
  act(game, 'p0', {
    type: 'PROPOSE_TRADE',
    toPlayerId: 'p2',
    give: { spaceIds: [1] },
    receive: { cash: 100 },
  });
  act(game, 'p2', { type: 'RESPOND_TRADE', tradeId: game.state.trades.at(-1).id, accept: true });

  assert.equal(game.state.debt, null, 'la dette se règle toute seule dès que les fonds arrivent');
  assert.equal(game.state.properties[1].ownerId, 'p2');
});

test('une offre se répond hors de son tour', () => {
  const game = newGame(['Julie', 'Sophie']);
  give(game, 'p1', [6]);
  // C'est le tour de Julie ; Sophie propose quand même un échange.
  act(game, 'p1', {
    type: 'PROPOSE_TRADE',
    toPlayerId: 'p0',
    give: { spaceIds: [6] },
    receive: { cash: 150 },
  });
  // Et Julie répond immédiatement, sans avoir fini son tour.
  act(game, 'p0', { type: 'RESPOND_TRADE', tradeId: game.state.trades.at(-1).id, accept: true });

  assert.equal(game.state.properties[6].ownerId, 'p0');
  assert.equal(playerById(game.state, 'p0').cash, 1350);
  assert.equal(game.state.pending.kind, 'roll', 'le tour de Julie continue normalement');
});

test('on pioche la carte soi-même, puis on la valide', () => {
  const game = newGame(['Julie', 'Sophie']);
  place(game, 'p0', 5);
  forceDice(game, [1, 1]); // case 7 : Chance
  act(game, 'p0', { type: 'ROLL_DICE' });

  assert.equal(game.state.pending.kind, 'draw_card', 'le tas attend d\'être pioché');
  assert.equal(game.state.pending.payload.deck, 'chance');

  act(game, 'p0', { type: 'DRAW_CARD' });
  assert.equal(game.state.pending.kind, 'card_reveal');
  assert.ok(game.state.pending.payload.text.length > 0, 'le texte de la carte est lisible');

  const avant = playerById(game.state, 'p0').cash;
  act(game, 'p0', { type: 'ACKNOWLEDGE_CARD' });
  assert.notEqual(game.state.pending.kind, 'card_reveal', 'la carte a été appliquée');
  assert.ok(typeof playerById(game.state, 'p0').cash === 'number' && avant >= 0);
});

test('on ne peut pas piocher à la place d\'une autre', () => {
  const game = newGame(['Julie', 'Sophie']);
  place(game, 'p0', 5);
  forceDice(game, [1, 1]);
  act(game, 'p0', { type: 'ROLL_DICE' });
  const refus = dispatch(game, 'p1', { type: 'DRAW_CARD' });
  assert.equal(refus.ok, false);
  assert.match(refus.error, /carte/i);
});
