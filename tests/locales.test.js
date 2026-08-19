/**
 * Le bilingue.
 *
 * Une langue est un calque de **mots**. Le contrat, vérifié ici pour chaque
 * édition : les prix, les positions, les types de cases et les effets de cartes
 * sont rigoureusement identiques en français et en anglais. Une partie jouée
 * dans une langue doit se dérouler exactement comme dans l'autre.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { EDITIONS, getEdition, LOCALES, DEFAULT_LOCALE } from '../shared/editions.js';
import { createGame, addPlayer, startGame, dispatch } from '../server/engine/index.js';

const IDS = Object.keys(EDITIONS);

test('les deux langues sont déclarées, le français est la base', () => {
  assert.deepEqual(LOCALES, ['fr', 'en']);
  assert.equal(DEFAULT_LOCALE, 'fr');
});

test('traduire ne change aucun prix, aucune position, aucun type de case', () => {
  for (const id of IDS) {
    const fr = getEdition(id, 'fr');
    const en = getEdition(id, 'en');

    assert.equal(fr.board.length, en.board.length, `${id} : taille du plateau`);
    for (let i = 0; i < fr.board.length; i++) {
      const a = fr.board[i];
      const b = en.board[i];
      assert.equal(a.id, b.id, `${id} : case ${i} — numéro`);
      assert.equal(a.type, b.type, `${id} : case ${i} — type`);
      assert.equal(a.group, b.group, `${id} : case ${i} — groupe`);
      assert.equal(a.price, b.price, `${id} : case ${i} — prix`);
      assert.equal(a.mortgage, b.mortgage, `${id} : case ${i} — hypothèque`);
      assert.equal(a.houseCost, b.houseCost, `${id} : case ${i} — coût de construction`);
      assert.equal(a.amount, b.amount, `${id} : case ${i} — montant`);
      assert.deepEqual(a.rent, b.rent, `${id} : case ${i} — loyers`);
    }

    // Les chiffres des règles ne bougent pas non plus.
    assert.equal(fr.currency.startingAmount, en.currency.startingAmount, `${id} : mise de départ`);
    assert.equal(fr.currency.goBonus, en.currency.goBonus, `${id} : bonus de passage`);
    assert.deepEqual(fr.jail, en.jail, `${id} : prison`);
    assert.deepEqual(fr.dice, en.dice, `${id} : dés`);
    assert.deepEqual(fr.bank, en.bank, `${id} : stock de la banque`);
    assert.deepEqual(fr.mechanics, en.mechanics, `${id} : mécaniques`);
    assert.equal(fr.winCondition, en.winCondition, `${id} : condition de victoire`);
    assert.deepEqual(fr.playerCount, en.playerCount, `${id} : nombre de joueuses`);
  }
});

test("traduire ne change aucun effet de carte, seulement le texte", () => {
  for (const id of IDS) {
    const fr = getEdition(id, 'fr');
    const en = getEdition(id, 'en');

    for (const deck of Object.keys(fr.cards)) {
      assert.equal(fr.cards[deck].length, en.cards[deck].length, `${id}/${deck} : nombre de cartes`);
      for (let i = 0; i < fr.cards[deck].length; i++) {
        const a = fr.cards[deck][i];
        const b = en.cards[deck][i];
        assert.equal(a.id, b.id, `${id}/${deck} : carte ${i} — identifiant`);
        assert.deepEqual(a.action, b.action, `${id}/${deck} : ${a.id} — effet`);
        assert.equal(Boolean(a.keepable), Boolean(b.keepable), `${id}/${deck} : ${a.id} — conservable`);
      }
    }
  }
});

test('tout est effectivement traduit : plus une seule case ni carte en français', () => {
  for (const id of IDS) {
    const fr = getEdition(id, 'fr');
    const en = getEdition(id, 'en');

    for (let i = 0; i < fr.board.length; i++) {
      assert.notEqual(
        en.board[i].name,
        undefined,
        `${id} : case ${i} sans nom anglais`,
      );
    }
    // Les noms propres restent identiques (Honeydukes, Thor…), mais l'ensemble
    // doit majoritairement différer, sinon c'est que le calque n'est pas appliqué.
    const changed = fr.board.filter((s, i) => s.name !== en.board[i].name).length;
    assert.ok(changed > fr.board.length / 2, `${id} : seules ${changed} cases sont traduites`);

    for (const [deck, list] of Object.entries(fr.cards)) {
      list.forEach((card, i) => {
        assert.ok(en.cards[deck][i].text?.length, `${id}/${deck} : ${card.id} sans texte anglais`);
        assert.notEqual(en.cards[deck][i].text, card.text, `${id}/${deck} : ${card.id} non traduite`);
      });
    }
  }
});

test('une langue inconnue retombe proprement sur le français', () => {
  const fallback = getEdition('harry-potter-fr', 'zz');
  assert.equal(fallback.board[1].name, getEdition('harry-potter-fr', 'fr').board[1].name);
});

test("la langue voyage dans l'état de la partie et suit jusqu'au journal", () => {
  const game = createGame('EN0001', 'p0', { seed: 5, editionId: 'harry-potter-fr', locale: 'en' });
  assert.equal(game.state.locale, 'en');

  addPlayer(game, { id: 'p0', name: 'Alice', token: null });
  addPlayer(game, { id: 'p1', name: 'Bruno', token: null });
  startGame(game, 'p0');

  // On avance jusqu'à une proposition d'achat, et le nom doit être l'anglais.
  for (let i = 0; i < 40 && game.state.pending.kind !== 'buy_or_auction'; i++) {
    const { kind, playerIds } = game.state.pending;
    if (!kind) break;
    const actions = { roll: 'ROLL_DICE', end_turn: 'END_TURN', draw_card: 'DRAW_CARD', card_reveal: 'ACKNOWLEDGE_CARD' };
    if (!actions[kind]) break;
    dispatch(game, playerIds[0], { type: actions[kind] });
  }

  const names = game.state.log.map((e) => e.text).join(' ');
  assert.ok(!/Placard sous l'escalier|Chaudron Baveur|Cabane de Hagrid/.test(names),
    'aucun nom français ne doit apparaître dans une partie anglaise');
});

test('une partie complète en anglais ne laisse pas une phrase de français au journal', () => {
  // Des mots qui n'existent que dans les tournures françaises du moteur : s'ils
  // apparaissent, c'est qu'une phrase a échappé au catalogue de traduction.
  const FRENCH = /\b(rejoint|achète|explore pour|paie|reçoit|arrive sur|doit|lance la partie|au tour de|pioche|mise|passe la|construit|revend|faillite|prison|Ordre de jeu|Fin de partie|hypothèque)\b/i;

  for (const id of IDS) {
    const game = createGame('ENFULL', 'h', { seed: 4242, editionId: id, locale: 'en' });
    const edition = getEdition(id, 'en');
    ['Alice', 'Bruno', 'Chloe'].slice(0, edition.playerCount.max).forEach((name, i) =>
      addPlayer(game, { id: `p${i}`, name, token: edition.tokens[i].id }),
    );
    startGame(game, 'p0');

    for (let step = 0; step < 600 && game.state.phase === 'playing'; step++) {
      const { kind, playerIds } = game.state.pending;
      if (!kind) break;
      const actor = playerIds[0];
      const player = game.state.players.find((p) => p.id === actor);
      const action =
        kind === 'roll' ? { type: 'ROLL_DICE' }
        : kind === 'buy_or_auction'
          ? (player.cash >= game.state.pending.payload.price
              ? { type: 'BUY_PROPERTY' }
              : { type: 'DECLINE_PROPERTY' })
        : kind === 'auction_bid' ? { type: 'AUCTION_PASS' }
        : kind === 'draw_card' ? { type: 'DRAW_CARD' }
        : kind === 'card_reveal' ? { type: 'ACKNOWLEDGE_CARD' }
        : kind === 'card_choice' ? { type: 'CARD_CHOICE', optionIndex: 0 }
        : kind === 'pay_debt'
          ? (player.cash >= game.state.debt.amount
              ? { type: 'PAY_DEBT' }
              : { type: 'DECLARE_BANKRUPTCY' })
        : { type: 'END_TURN' };
      dispatch(game, actor, action);
    }

    const offenders = game.state.log.filter((entry) => FRENCH.test(entry.text));
    assert.equal(
      offenders.length,
      0,
      `${id} : ${offenders.length} ligne(s) en français, ex. « ${offenders[0]?.text} »`,
    );
    assert.ok(game.state.log.length > 20, `${id} : la partie doit avoir vraiment tourné`);
  }
});

test('les deux boîtes Harry Potter restent bien distinctes dans les deux langues', () => {
  for (const locale of LOCALES) {
    const reskin = getEdition('harry-potter-fr', locale);
    const hasbro = getEdition('poudlard-points', locale);
    assert.notEqual(reskin.name, hasbro.name, `${locale} : les deux noms doivent différer`);
    assert.equal(reskin.currency.type, 'money');
    assert.equal(hasbro.currency.type, 'points');
    // La case 4 les sépare : taxe du Ministère d'un côté, retenue de l'autre.
    assert.notEqual(reskin.board[4].name, hasbro.board[4].name, `${locale} : case 4`);
  }
});
