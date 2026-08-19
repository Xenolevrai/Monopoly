/**
 * Les règles propres à l'édition à points de maison.
 *
 * Ce n'est pas un reskin : la monnaie, la fin de partie et le sort d'une joueuse
 * sans le sou y sont différents. Ces tests vérifient exactement ces différences.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame, addPlayer, dispatch } from '../server/engine/index.js';
import { getEdition } from '../shared/editions.js';
import { charge } from '../server/engine/money.js';
import { resolveLanding } from '../server/engine/movement.js';
import { buildDecks } from '../server/engine/cards.js';
import { startTurn } from '../server/engine/turn.js';

const EDITION = 'poudlard-points';
const edition = getEdition(EDITION);

/** Une partie lancée sur l'édition à points, ordre de jeu figé. */
function newPointsGame(names = ['Alice', 'Bruno']) {
  const game = createGame('PTS001', 'p0', { seed: 99, editionId: EDITION });
  names.forEach((name, i) =>
    addPlayer(game, { id: `p${i}`, name, token: edition.tokens[i].id, faction: edition.factions.options[i].id }),
  );
  buildDecks(game.state, game.rng);
  game.state.phase = 'playing';
  game.state.turnCount = 1;
  game.state.currentPlayerIndex = 0;
  startTurn(game.state);
  return game;
}

test('on démarre avec 300 points de maison, pas avec de l\'argent', () => {
  const game = newPointsGame();
  assert.equal(edition.currency.type, 'points');
  assert.equal(game.state.players[0].cash, 300);
  assert.equal(edition.currency.goBonus, 20);
});

test('le plateau est bien celui relevé sur la boîte', () => {
  const at = (id) => edition.board[id];
  assert.equal(at(1).name, "Le Placard sous l'escalier");
  assert.equal(at(1).price, 60);
  assert.equal(at(5).name, 'Poudlard Express');
  assert.equal(at(5).price, 200);
  assert.equal(at(12).name, 'Réseau des Cheminées');
  assert.equal(at(12).price, 150);
  assert.equal(at(39).name, 'Banque des Sorciers Gringotts');
  assert.equal(at(39).price, 400);
  // Les deux malus de cette édition, différents du classique (200 et 100).
  assert.equal(at(4).amount, 100, 'Retenue avec Rogue');
  assert.equal(at(38).amount, 75, 'Fournitures scolaires');
  // Six cases Courrier par Hibou, et plus aucune Caisse de Communauté.
  assert.equal(edition.board.filter((s) => s.type === 'chance').length, 6);
  assert.equal(edition.board.filter((s) => s.type === 'community_chest').length, 0);
});

test('la boîte contient quatre pions dorés : quatre joueuses au maximum', () => {
  assert.equal(edition.playerCount.max, 4);
  assert.deepEqual(
    edition.tokens.map((t) => t.label),
    ['Harry Potter', 'Hermione Granger', 'Ron Weasley', 'Drago Malefoy'],
  );
});

test('44 blasons, 11 par maison, et pas un seul hôtel', () => {
  assert.equal(edition.bank.houses, 44);
  assert.equal(edition.bank.houses / edition.factions.options.length, 11);
  assert.equal(edition.bank.hotels, 0);
});

test('la caution de retenue est de 10 points', () => {
  assert.equal(edition.jail.bail, 10);
});

test('chaque joueuse reçoit une maison de Poudlard, distinctes tant qu\'il en reste', () => {
  const game = newPointsGame(['Alice', 'Bruno', 'Chloé', 'Dan']);
  const houses = game.state.players.map((p) => p.faction);
  assert.equal(new Set(houses).size, 4, 'quatre maisons différentes');
  for (const house of houses) {
    assert.ok(edition.factions.options.some((f) => f.id === house), `maison inconnue : ${house}`);
  }
});

test('le plateau de cette boîte ne rattache aucun fief aux maisons', () => {
  // L'inventaire des 40 cases ne comporte pas de salle commune : le privilège
  // « chez soi » n'a donc rien à quoi s'accrocher ici. Le moteur sait le faire
  // (cf. le test suivant), mais il ne doit pas l'inventer.
  for (const faction of edition.factions.options) {
    assert.equal(faction.homeSpace, undefined, `${faction.label} ne doit pas avoir de fief`);
  }
});

test('un fief déclaré s\'explore gratuitement et ne se paie jamais', () => {
  // Le mécanisme lui-même, vérifié en rattachant un fief à la volée : c'est ce
  // qui servira dès qu'une boîte comportera de vraies salles communes.
  const game = newPointsGame();
  const [alice, bruno] = game.state.players;
  const home = 6;
  const options = getEdition(EDITION).factions.options;
  const original = options[0].homeSpace;
  options[0].homeSpace = home;
  alice.faction = options[0].id;

  try {
    // Libre : elle l'explore sans rien dépenser.
    alice.position = home;
    const before = alice.cash;
    resolveLanding(game.state, alice.id, { diceTotal: 5 });
    assert.equal(game.state.properties[home].ownerId, alice.id, 'le fief lui revient');
    assert.equal(alice.cash, before, 'sans rien dépenser');

    // Déjà exploré par une autre : elle n'y paie toujours rien.
    game.state.properties[home].ownerId = bruno.id;
    const before2 = alice.cash;
    resolveLanding(game.state, alice.id, { diceTotal: 5 });
    assert.equal(alice.cash, before2, 'elle est chez elle : rien à payer');
    assert.equal(game.state.debt, null);
  } finally {
    options[0].homeSpace = original;
  }
});

test('personne ne fait faillite : on verse ce qu\'on a, et la dette s\'éteint', () => {
  const game = newPointsGame();
  const [alice, bruno] = game.state.players;
  alice.cash = 30;

  const result = charge(game.state, alice.id, 100, 'droit de passage', bruno.id);

  assert.equal(result.paid, true, 'le paiement est considéré comme réglé');
  assert.equal(alice.cash, 0, 'elle a donné tout ce qu\'elle avait');
  assert.equal(bruno.cash, 330, 'et Bruno a reçu ces 30 points');
  assert.equal(game.state.debt, null, 'aucune dette ne traîne');
  assert.equal(alice.bankrupt, false, 'elle reste en jeu');
});

test('la partie s\'arrête dès que le dernier lieu est exploré', () => {
  const game = newPointsGame();
  const [alice] = game.state.players;
  const ownable = Object.values(game.state.properties);

  // Tout est exploré sauf un seul lieu.
  ownable.forEach((prop, i) => {
    prop.ownerId = i === 0 ? null : game.state.players[i % 2].id;
  });
  const last = ownable[0].spaceId;

  assert.equal(game.state.phase, 'playing', 'tant qu\'il reste un lieu, on joue');

  // Alice arrive sur le dernier lieu libre et l'explore.
  alice.cash = 1000;
  alice.position = last;
  resolveLanding(game.state, alice.id, { diceTotal: 5 });
  dispatch(game, alice.id, { type: 'BUY_PROPERTY' });

  assert.equal(game.state.phase, 'finished', 'le plateau est entièrement exploré');
  assert.ok(game.state.standings.length, 'un classement est publié');
});

test('le classement final ajoute le loyer courant de chaque lieu exploré', () => {
  const game = newPointsGame();
  const [alice] = game.state.players;
  Object.values(game.state.properties).forEach((prop) => {
    prop.ownerId = game.state.players[0].id;
  });
  alice.cash = 100;

  dispatch(game, alice.id, { type: 'ROLL_DICE' }); // fait avancer le flux
  const entry = game.state.standings.find((s) => s.playerId === alice.id);

  assert.ok(entry, 'Alice figure au classement');
  assert.ok(entry.bonus > 0, 'un bonus est versé pour les lieux explorés');
  assert.equal(entry.worth, entry.cash + entry.bonus, 'le total est bien liquide + bonus');
});

test('l\'hypothèque est refusée : cette édition ne la connaît pas', () => {
  const game = newPointsGame();
  const [alice] = game.state.players;
  const spaceId = 1;
  game.state.properties[spaceId].ownerId = alice.id;

  const result = dispatch(game, alice.id, { type: 'MORTGAGE', spaceId });
  assert.equal(result.ok, false);
  assert.match(result.error, /hypoth[èe]que/i);
});

test('les blasons plafonnent : il n\'y a pas d\'hôtel à Poudlard', () => {
  assert.equal(edition.mechanics.hotels, false);
  assert.equal(edition.bank.hotels, 0);
  assert.equal(edition.buildingLabels.house, 'Blason');
});

test('une seule pile de cartes : le Hibou Express remplace Chance et Caisse', () => {
  assert.equal(edition.cards.chance.length, 32);
  assert.equal(edition.cards.chance.filter((c) => c.variant === 'howler').length, 5, 'cinq Beuglantes');
  assert.equal(edition.cards.community_chest.length, 0);
  // Aucune case ne réclame la pile disparue, sinon on piocherait dans le vide.
  assert.equal(edition.board.filter((s) => s.type === 'community_chest').length, 0);
  assert.equal(edition.theming.decks.chance.label, 'Hibou Express');
});
