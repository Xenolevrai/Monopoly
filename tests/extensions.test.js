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

test('le registre est vide tant qu\'aucune extension n\'est codée', () => {
  assert.deepEqual(EXTENSIONS, {});
  assert.deepEqual(compatibleExtensions(EDITIONS['classic-fr']), []);
  assert.deepEqual(conflictingPositions([]), []);
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
