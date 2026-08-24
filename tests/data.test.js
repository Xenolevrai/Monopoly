import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEdition,
  getSpace,
  ownableSpaces,
  spacesOfGroup,
  forwardDistance,
  passesGo,
} from '../shared/index.js';

import { createGameState, createPlayer } from '../shared/schema.js';

const EDITION = 'classic-fr';
const edition = getEdition(EDITION);
const { board, groups, cards } = edition;

test('le plateau contient 40 cases numérotées de 0 à 39', () => {
  assert.equal(board.length, 40);
  board.forEach((space, i) => assert.equal(space.id, i, `case ${i}`));
});

test('la composition du plateau correspond à l\'édition classique', () => {
  const count = (type) => board.filter((s) => s.type === type).length;
  assert.equal(count('property'), 22);
  assert.equal(count('railroad'), 4);
  assert.equal(count('utility'), 2);
  assert.equal(count('chance'), 3);
  assert.equal(count('community_chest'), 3);
  assert.equal(count('tax'), 2);
  assert.equal(count('go') + count('jail') + count('free_parking') + count('go_to_jail'), 4);
  assert.equal(board.filter((s) => s.corner).length, 4);
});

test('chaque groupe de couleur référence les bonnes cases', () => {
  for (const group of Object.values(groups)) {
    assert.equal(group.spaces.length, group.size, `taille du groupe ${group.id}`);
    for (const id of group.spaces) {
      assert.equal(getSpace(EDITION, id).group, group.id, `case ${id} → groupe ${group.id}`);
    }
  }
  // Inversement : toute case achetable appartient à un groupe déclaré.
  for (const space of ownableSpaces(EDITION)) {
    assert.ok(groups[space.group], `groupe manquant pour la case ${space.id}`);
    assert.ok(groups[space.group].spaces.includes(space.id));
  }
  assert.equal(ownableSpaces(EDITION).length, 28);
});

test('les terrains ont 6 paliers de loyer croissants et une hypothèque = prix / 2', () => {
  for (const space of board.filter((s) => s.type === 'property')) {
    assert.equal(space.rent.length, 6, `${space.name} : paliers de loyer`);
    for (let i = 1; i < space.rent.length; i++) {
      assert.ok(space.rent[i] > space.rent[i - 1], `${space.name} : loyer non croissant au palier ${i}`);
    }
    assert.equal(space.mortgage, space.price / 2, `${space.name} : hypothèque`);
    assert.equal(space.houseCost, groups[space.group].houseCost, `${space.name} : coût maison`);
  }
});

test('gares et compagnies suivent les tarifs officiels', () => {
  for (const space of board.filter((s) => s.type === 'railroad')) {
    assert.equal(space.price, 200);
    assert.equal(space.mortgage, 100);
    assert.deepEqual(space.rent, [25, 50, 100, 200]);
  }
  for (const space of board.filter((s) => s.type === 'utility')) {
    assert.equal(space.price, 150);
    assert.equal(space.mortgage, 75);
    assert.deepEqual(space.rentMultipliers, [4, 10]);
  }
});

test('les taxes et les coins sont aux bons emplacements', () => {
  assert.equal(getSpace(EDITION, 4).amount, 200);
  assert.equal(getSpace(EDITION, 38).amount, 100);
  assert.equal(getSpace(EDITION, 0).type, 'go');
  assert.equal(getSpace(EDITION, 10).type, 'jail');
  assert.equal(getSpace(EDITION, 20).type, 'free_parking');
  assert.equal(getSpace(EDITION, 30).type, 'go_to_jail');
});

test('les deux piles comptent 16 cartes avec des identifiants uniques', () => {
  for (const deck of ['chance', 'community_chest']) {
    assert.equal(cards[deck].length, 16, `pile ${deck}`);
    const ids = new Set(cards[deck].map((c) => c.id));
    assert.equal(ids.size, 16, `pile ${deck} : ids dupliqués`);
    for (const card of cards[deck]) {
      assert.ok(card.text.length > 0, `${card.id} : texte manquant`);
      assert.ok(card.action?.type, `${card.id} : action manquante`);
    }
  }
  const jailCards = [...cards.chance, ...cards.community_chest].filter((c) => c.keepable);
  assert.equal(jailCards.length, 2, 'une carte « libérée de prison » par pile');
});

test('toutes les cases ciblées par une carte existent', () => {
  const targets = [...cards.chance, ...cards.community_chest]
    .flatMap((c) => (c.action.type === 'choice' ? c.action.options.map((o) => o.action) : [c.action]))
    .filter((a) => a.type === 'move_to');
  for (const action of targets) {
    assert.ok(action.target >= 0 && action.target < 40, `cible hors plateau : ${action.target}`);
  }
});

test('le stock de la banque et les constantes de règles sont ceux du jeu officiel', () => {
  assert.equal(edition.currency.startingAmount, 1500);
  assert.equal(edition.currency.goBonus, 200);
  assert.equal(edition.jail.bail, 50);
  assert.equal(edition.bank.houses, 32);
  assert.equal(edition.bank.hotels, 12);
  assert.equal(edition.mortgage.interestRate, 0.1);
  assert.ok(edition.tokens.length >= edition.playerCount.max);
});

test('forwardDistance et passesGo gèrent le tour du plateau', () => {
  assert.equal(forwardDistance(EDITION, 0, 5), 5);
  assert.equal(forwardDistance(EDITION, 38, 2), 4);
  assert.equal(passesGo(EDITION, 38, 2), true);
  assert.equal(passesGo(EDITION, 5, 15), false);
  assert.equal(passesGo(EDITION, 22, 15), true, 'Chance 22 → Gare de Lyon repasse par Départ');
  assert.equal(passesGo(EDITION, 7, 39), false, 'Chance 7 → Rue de la Paix ne repasse pas par Départ');
  assert.equal(passesGo(EDITION, 10, 10), false, 'un déplacement nul ne paie pas le salaire');
});

test('l\'état initial couvre les 28 propriétés et le stock de la banque', () => {
  const state = createGameState('PARIS7', 'p1');
  assert.equal(Object.keys(state.properties).length, 28);
  assert.ok(Object.values(state.properties).every((p) => p.ownerId === null && !p.mortgaged));
  // Le classique n'a pas de gratte-ciel : le stock existe, il reste à zéro.
  assert.deepEqual(state.bank, { houses: 32, hotels: 12, skyscrapers: 0 });
  assert.equal(state.phase, 'lobby');
  assert.equal(state.settings.freeParkingPot, false);
});

test('une joueuse démarre avec 1500 € sur la case Départ', () => {
  const player = createPlayer({ id: 'p1', name: 'Julie', token: 'chat', color: '#2A5CAA', order: 0 });
  assert.equal(player.cash, 1500);
  assert.equal(player.position, 0);
  assert.equal(player.inJail, false);
  assert.equal(player.getOutOfJailCards, 0);
});

test('spacesOfGroup renvoie les terrains dans l\'ordre du plateau', () => {
  assert.deepEqual(
    spacesOfGroup(EDITION, 'orange').map((s) => s.shortName),
    ['Mozart', 'Saint-Michel', 'Pigalle'],
  );
});
