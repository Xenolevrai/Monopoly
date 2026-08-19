/**
 * Parties complètes jouées au hasard.
 *
 * C'est le filet de sécurité du moteur : une joueuse artificielle enchaîne des
 * milliers d'actions et on vérifie après chacune qu'aucun invariant n'est cassé
 * et que la partie n'est jamais bloquée (toujours quelqu'un à qui jouer).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame, addPlayer, startGame, dispatch } from '../server/engine/index.js';
import { createRng } from '../server/engine/rng.js';
import { activePlayers, buildingLevel, maxRaisable, canBuild } from '../server/engine/queries.js';
import { log } from '../server/engine/log.js';
import { getEdition } from '../shared/index.js';

const edition = getEdition('classic-fr');

/** Vérifie les invariants qui doivent tenir après chaque action. */
function checkInvariants(state, step) {
  for (const player of state.players) {
    assert.ok(player.cash >= 0, `étape ${step} : ${player.name} a un solde négatif (${player.cash})`);
    assert.ok(player.position >= 0 && player.position < 40, `étape ${step} : position hors plateau`);
    assert.ok(player.getOutOfJailCards >= 0, `étape ${step} : cartes de prison négatives`);
  }

  // Le stock de la banque plus ce qui est posé sur le plateau doit rester constant.
  let housesOnBoard = 0;
  let hotelsOnBoard = 0;
  for (const prop of Object.values(state.properties)) {
    if (prop.hotel) hotelsOnBoard += 1;
    else housesOnBoard += prop.houses;
    if (prop.ownerId) {
      const owner = state.players.find((p) => p.id === prop.ownerId);
      assert.ok(owner && !owner.bankrupt, `étape ${step} : propriété détenue par une joueuse éliminée`);
    }
    assert.ok(!(prop.hotel && prop.houses > 0), `étape ${step} : hôtel ET maisons sur la même case`);
    assert.ok(!(prop.mortgaged && buildingLevel(prop) > 0), `étape ${step} : terrain construit et hypothéqué`);
  }
  assert.equal(
    housesOnBoard + state.bank.houses,
    edition.bank.houses,
    `étape ${step} : maisons perdues ou dupliquées`,
  );
  assert.equal(
    hotelsOnBoard + state.bank.hotels,
    edition.bank.hotels,
    `étape ${step} : hôtels perdus ou dupliqués`,
  );

  // Pas de blocage : tant que la partie tourne, quelqu'un doit pouvoir agir.
  if (state.phase === 'playing') {
    assert.ok(state.pending.kind, `étape ${step} : plus personne n'a la main`);
    assert.ok(state.pending.playerIds.length > 0, `étape ${step} : décision attendue de personne`);
  }
}

/** Choisit une action plausible pour la joueuse qui doit décider. */
function pickAction(state, playerId, rng) {
  const { kind, payload } = state.pending;
  const player = state.players.find((p) => p.id === playerId);

  switch (kind) {
    case 'roll':
      if (player.inJail && player.getOutOfJailCards > 0 && rng.next() < 0.5)
        return { type: 'USE_JAIL_CARD' };
      if (player.inJail && player.cash >= edition.jail.bail && rng.next() < 0.3) return { type: 'PAY_BAIL' };
      return { type: 'ROLL_DICE' };

    case 'buy_or_auction':
      return payload.canAfford && rng.next() < 0.8 ? { type: 'BUY_PROPERTY' } : { type: 'DECLINE_PROPERTY' };

    case 'auction_bid': {
      const bid = Math.floor(rng.next() * Math.min(player.cash, 200));
      const highest = state.auction.highestBid;
      return bid > highest && rng.next() < 0.6
        ? { type: 'AUCTION_BID', amount: bid }
        : { type: 'AUCTION_PASS' };
    }

    case 'draw_card':
      return { type: 'DRAW_CARD' };

    case 'card_reveal':
      return { type: 'ACKNOWLEDGE_CARD' };

    case 'card_choice':
      return { type: 'CARD_CHOICE', optionIndex: rng.int(payload.options.length) };

    case 'pay_debt':
      return raiseFundsOrFold(state, player);

    case 'end_turn': {
      // De temps en temps, on construit avant de finir son tour.
      if (rng.next() < 0.35) {
        const buildable = Object.values(state.properties)
          .filter((p) => p.ownerId === playerId && canBuild(state, playerId, p.spaceId).ok)
          .map((p) => p.spaceId);
        if (buildable.length) return { type: 'BUILD_HOUSE', spaceId: buildable[rng.int(buildable.length)] };
      }
      return { type: 'END_TURN' };
    }

    default:
      return null;
  }
}

/** Face à une dette : payer si on peut, sinon liquider, sinon faire faillite. */
function raiseFundsOrFold(state, player) {
  if (player.cash >= state.debt.amount) return { type: 'PAY_DEBT' };
  if (maxRaisable(state, player.id) < state.debt.amount) return { type: 'DECLARE_BANKRUPTCY' };

  const owned = Object.values(state.properties).filter((p) => p.ownerId === player.id);
  const built = owned.find((p) => buildingLevel(p) > 0);
  if (built) return { type: 'SELL_BUILDING', spaceId: built.spaceId };
  const mortgageable = owned.find((p) => !p.mortgaged && buildingLevel(p) === 0);
  if (mortgageable) return { type: 'MORTGAGE', spaceId: mortgageable.spaceId };
  return { type: 'DECLARE_BANKRUPTCY' };
}

/** Joue une partie complète (ou jusqu'à `maxSteps`) et vérifie tout au long. */
function playGame(seed, playerCount = 4, maxSteps = 4000) {
  const game = createGame(`SIM${seed}`, 'p0', { seed });
  for (let i = 0; i < playerCount; i++) addPlayer(game, { id: `p${i}`, name: `J${i}`, token: null });
  const started = startGame(game, 'p0');
  assert.equal(started.ok, true, started.error);

  const rng = createRng(seed + 7);
  let steps = 0;
  while (game.state.phase === 'playing' && steps < maxSteps) {
    const playerId = game.state.pending.playerIds[0];
    const action = pickAction(game.state, playerId, rng);
    assert.ok(action, `étape ${steps} : aucune action possible pour ${game.state.pending.kind}`);

    const result = dispatch(game, playerId, action);
    // Une action peut être légitimement refusée (mise trop basse, construction
    // impossible) : on tolère le refus, mais pas le blocage.
    if (
      !result.ok &&
      ['ROLL_DICE', 'END_TURN', 'DECLARE_BANKRUPTCY', 'DRAW_CARD', 'ACKNOWLEDGE_CARD', 'PAY_DEBT'].includes(
        action.type,
      )
    ) {
      assert.fail(`étape ${steps} : action essentielle refusée (${action.type} → ${result.error})`);
    }
    checkInvariants(game.state, steps);
    steps += 1;
  }
  return { game, steps };
}

test('20 parties aléatoires se déroulent sans blocage ni invariant cassé', () => {
  let finished = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const { game } = playGame(seed);
    if (game.state.phase === 'finished') {
      finished += 1;
      assert.ok(game.state.winnerId, 'une partie terminée doit avoir une gagnante');
      assert.equal(activePlayers(game.state).length, 1);
    }
  }
  assert.ok(finished > 0, 'aucune partie ne va au bout : le moteur tourne probablement en rond');
});

test('une partie à 6 joueuses tient la distance', () => {
  const { game, steps } = playGame(99, 6, 6000);
  assert.ok(steps > 100, 'la partie s\'arrête bien trop tôt');
  assert.ok(game.state.log.length > 0);
});

test('le journal reste borné même sur une longue partie', () => {
  const { game } = playGame(5, 4, 4000);
  assert.ok(game.state.log.length <= 500, 'le journal doit être tronqué');
});

test('une partie reprise après redémarrage ne réutilise aucun identifiant de journal', () => {
  // Le compteur vit dans la partie, pas dans le processus : sinon un redémarrage
  // du serveur repart de « e1 » et le journal restauré se retrouve avec des clés
  // React en double, ce qui fige son affichage jusqu'au rechargement de la page.
  const { game } = playGame(11, 3, 400);

  // Aller-retour par le disque, comme le fait `restoreRooms`.
  const revived = JSON.parse(JSON.stringify(game.state));
  log(revived, 'turn', 'après redémarrage');
  log(revived, 'turn', 'et encore une');

  const ids = new Set(revived.log.map((entry) => entry.id));
  assert.equal(ids.size, revived.log.length, 'identifiants dupliqués dans le journal restauré');
  assert.equal(revived.log.at(-1).text, 'et encore une');
});
