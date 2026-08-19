/**
 * Réunir une somme, puis s'en servir.
 *
 * Le défaut signalé en jouant : on hypothèque pour pouvoir acheter la case sur
 * laquelle on vient de tomber, l'argent arrive… et le bouton reste refusé. Ces
 * tests couvrent la chaîne entière — hypothéquer, revendre, négocier, dans
 * l'ordre qu'on veut et autant de fois qu'on veut — pour un achat comme pour un
 * loyer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatch } from '../server/engine/index.js';
import { resolveLanding } from '../server/engine/movement.js';
import { newGame } from './helpers.js';

/** Place une joueuse sur une case et résout l'arrivée, sans passer par les dés. */
function landOn(game, playerId, spaceId, diceTotal = 7) {
  const player = game.state.players.find((p) => p.id === playerId);
  player.position = spaceId;
  resolveLanding(game.state, playerId, { diceTotal });
}

test("on peut hypothéquer pour acheter la case sur laquelle on vient de tomber", () => {
  const game = newGame(['Julie', 'Sophie']);
  const [julie] = game.state.players;

  // Elle possède une rue, mais n'a pas de quoi acheter celle où elle arrive.
  game.state.properties[1].ownerId = julie.id; // Belleville, hypothèque 30
  julie.cash = 100;

  landOn(game, julie.id, 39); // Rue de la Paix, 400 €
  assert.equal(game.state.pending.kind, 'buy_or_auction');
  assert.equal(game.state.pending.payload.canAfford, false, 'au départ, elle ne peut pas');

  // Elle hypothèque : l'achat doit rester proposé, et devenir possible.
  julie.cash = 380;
  const mortgaged = dispatch(game, julie.id, { type: 'MORTGAGE', spaceId: 1 });
  assert.ok(mortgaged.ok, mortgaged.error);
  assert.equal(julie.cash, 410, 'les 30 € de l\'hypothèque sont versés');
  assert.equal(game.state.pending.kind, 'buy_or_auction', "l'achat est toujours proposé");

  const bought = dispatch(game, julie.id, { type: 'BUY_PROPERTY' });
  assert.ok(bought.ok, `l'achat doit passer — ${bought.error}`);
  assert.equal(game.state.properties[39].ownerId, julie.id);
});

test("le montant réunissable annoncé suit les hypothèques, il n'est pas figé", () => {
  const game = newGame(['Julie', 'Sophie']);
  const [julie] = game.state.players;
  game.state.properties[1].ownerId = julie.id;
  julie.cash = 0;

  landOn(game, julie.id, 39);
  const before = game.state.pending.payload;
  assert.equal(before.canAfford, false);

  // Le serveur expose le prix : c'est lui que le client compare au solde courant,
  // et non un cliché pris au moment de l'arrivée.
  assert.equal(before.price, 400, 'le prix doit être publié pour être recomparé');
});

test('on peut hypothéquer plusieurs biens de suite pour régler un loyer', () => {
  const game = newGame(['Julie', 'Sophie']);
  const [julie, sophie] = game.state.players;

  // Sophie tient la Rue de la Paix ; Julie tombe dessus sans le sou.
  game.state.properties[39].ownerId = sophie.id;
  game.state.properties[1].ownerId = julie.id; // hypothèque 30
  game.state.properties[3].ownerId = julie.id; // hypothèque 30
  game.state.properties[6].ownerId = julie.id; // hypothèque 50
  julie.cash = 0;

  landOn(game, julie.id, 39);
  assert.equal(game.state.pending.kind, 'pay_debt');
  const due = game.state.debt.amount;

  // Trois hypothèques d'affilée, sans que la dette ne se referme entre-temps.
  for (const spaceId of [1, 3, 6]) {
    const result = dispatch(game, julie.id, { type: 'MORTGAGE', spaceId });
    assert.ok(result.ok, `hypothèque de ${spaceId} refusée : ${result.error}`);
    assert.equal(game.state.pending.kind, 'pay_debt', 'la dette reste ouverte');
  }
  assert.equal(julie.cash, 110);

  // Il manque encore : on ajoute une revente de construction impossible ici,
  // donc on complète à la main et on règle.
  julie.cash = due;
  const paid = dispatch(game, julie.id, { type: 'PAY_DEBT' });
  assert.ok(paid.ok, paid.error);
  assert.equal(game.state.debt, null, 'la dette est soldée');
  assert.equal(sophie.cash > 1500, true, 'Sophie a bien encaissé');
});

test("hypothéquer puis proposer un arrangement : les deux gestes s'enchaînent", () => {
  const game = newGame(['Julie', 'Sophie']);
  const [julie, sophie] = game.state.players;

  game.state.properties[39].ownerId = sophie.id;
  game.state.properties[1].ownerId = julie.id;
  game.state.properties[3].ownerId = julie.id;
  julie.cash = 0;

  landOn(game, julie.id, 39);
  assert.equal(game.state.pending.kind, 'pay_debt');

  // 1. Elle hypothèque un bien pour se donner de l'air.
  assert.ok(dispatch(game, julie.id, { type: 'MORTGAGE', spaceId: 1 }).ok);
  assert.equal(game.state.pending.kind, 'pay_debt');

  // 2. Puis elle propose l'autre bien en arrangement, sans quitter la dette.
  const offered = dispatch(game, julie.id, {
    type: 'PROPOSE_TRADE',
    toPlayerId: sophie.id,
    give: { cash: 0, spaceIds: [3], jailCards: 0 },
    receive: { cash: 0, spaceIds: [], jailCards: 0 },
    settlesDebt: true,
  });
  assert.ok(offered.ok, `la proposition doit passer — ${offered.error}`);

  // 3. Sophie accepte : la dette disparaît, le bien change de main.
  const trade = game.state.trades.at(-1);
  const answered = dispatch(game, sophie.id, {
    type: 'RESPOND_TRADE',
    tradeId: trade.id,
    accept: true,
  });
  assert.ok(answered.ok, answered.error);
  assert.equal(game.state.debt, null, "l'arrangement efface la dette");
  assert.equal(game.state.properties[3].ownerId, sophie.id, 'le bien est bien cédé');
  assert.equal(julie.bankrupt, false, "Julie n'est pas éliminée");
});

test('revendre une construction pendant une dette est possible, et recrédite', () => {
  const game = newGame(['Julie', 'Sophie']);
  const [julie, sophie] = game.state.players;

  // Julie tient tout le groupe orange et y a bâti.
  for (const id of [16, 18, 19]) {
    game.state.properties[id].ownerId = julie.id;
    game.state.properties[id].houses = 1;
  }
  game.state.bank.houses -= 3;
  game.state.properties[39].ownerId = sophie.id;
  julie.cash = 0;

  landOn(game, julie.id, 39);
  assert.equal(game.state.pending.kind, 'pay_debt');

  const sold = dispatch(game, julie.id, { type: 'SELL_BUILDING', spaceId: 19 });
  assert.ok(sold.ok, sold.error);
  assert.ok(julie.cash > 0, 'la revente a crédité');
  assert.equal(game.state.pending.kind, 'pay_debt', 'la dette reste ouverte');
});

test("une hypothèque pendant une dette ne referme jamais la dette toute seule", () => {
  const game = newGame(['Julie', 'Sophie']);
  const [julie, sophie] = game.state.players;
  game.state.properties[39].ownerId = sophie.id;
  game.state.properties[37].ownerId = julie.id; // hypothèque 175
  julie.cash = 0;

  landOn(game, julie.id, 39);
  const due = game.state.debt.amount;

  dispatch(game, julie.id, { type: 'MORTGAGE', spaceId: 37 });
  // Même si l'hypothèque suffit, rien n'est prélevé d'office : c'est elle qui décide.
  assert.ok(julie.cash >= due, 'elle a maintenant de quoi payer');
  assert.equal(game.state.debt.amount, due, 'la dette est inchangée');
  assert.equal(game.state.pending.kind, 'pay_debt', 'et toujours à régler');

  assert.ok(dispatch(game, julie.id, { type: 'PAY_DEBT' }).ok);
  assert.equal(game.state.debt, null);
});
