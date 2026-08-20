/**
 * Invariants valables pour TOUTE édition du catalogue.
 *
 * C'est le filet de sécurité de la plateforme : si ajouter une édition revient
 * bien à déposer un dossier, alors ces tests doivent passer sur la nouvelle sans
 * qu'une seule ligne de moteur ne bouge. Une erreur de saisie dans un plateau
 * (prix manquant, groupe incohérent, carte pointant hors du plateau) est
 * attrapée ici plutôt qu'en pleine partie.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { EDITIONS, OWNABLE_TYPES } from '../shared/editions.js';
import { createGame, addPlayer, startGame, dispatch } from '../server/engine/index.js';
import { createRng } from '../server/engine/rng.js';

const ALL = Object.entries(EDITIONS);

/** Les types d'action que le moteur sait appliquer (cf. `applyCardAction`). */
const KNOWN_ACTIONS = new Set([
  'collect', 'pay', 'move_to', 'move_relative', 'go_to_jail', 'pay_per_building',
  'collect_from_each', 'pay_to_each', 'get_out_of_jail_free', 'draw_card',
  'nearest', 'choice', 'sequence',
  // Pion hostile autonome et pouvoirs qui vont avec (`mechanics.hazardPawn`).
  'place_hazard', 'clear_hazard', 'move_hazard', 'grant_rent_waiver',
  'nearest_unowned', 'steal_from_richest', 'rival_move_relative', 'free_building',
]);

test('chaque édition déclare une identité et des bornes de joueuses cohérentes', () => {
  for (const [id, edition] of ALL) {
    assert.equal(edition.id, id, `${id} : l'id du fichier doit correspondre à la clé`);
    assert.ok(edition.name?.length, `${id} : nom manquant`);
    assert.ok(edition.playerCount.min >= 2, `${id} : minimum de joueuses`);
    assert.ok(edition.playerCount.max >= edition.playerCount.min, `${id} : bornes inversées`);
    assert.equal(
      edition.tokens.length,
      edition.playerCount.max,
      `${id} : il faut autant de pions que de joueuses maximum`,
    );
    const tokenIds = new Set(edition.tokens.map((t) => t.id));
    assert.equal(tokenIds.size, edition.tokens.length, `${id} : deux pions partagent un id`);
  }
});

test('chaque pion déclaré a une silhouette dessinée côté client', async () => {
  // On lit le fichier plutôt que de l'importer : c'est du JSX, que Node ne sait
  // pas charger tel quel. Ce test évite qu'une édition affiche six pions
  // identiques faute de dessin — un défaut invisible côté serveur.
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../client/src/components/TokenIcon.jsx', import.meta.url), 'utf8');
  const drawn = new Set([...source.matchAll(/^ {2}([a-z]+):\s*\(/gm)].map((m) => m[1]));

  for (const [id, edition] of ALL) {
    for (const token of edition.tokens) {
      assert.ok(drawn.has(token.id), `${id} : le pion « ${token.id} » n'a pas de silhouette`);
    }
  }
});

test('chaque pictogramme et chaque couleur réclamés par une édition existent', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../client/src/components/SpaceIcons.jsx', import.meta.url), 'utf8');
  // Les entrées de la bibliothèque associent un nom court à un composant :
  // `crest: Crest`. Plusieurs par ligne, d'où la recherche non ancrée.
  const library = new Set([...source.matchAll(/\b([a-z]+): [A-Z]\w+[,\s}]/g)].map((m) => m[1]));

  for (const [id, edition] of ALL) {
    for (const [type, entry] of Object.entries(edition.theming?.icons ?? {})) {
      for (const name of [entry].flat()) {
        assert.ok(library.has(name), `${id} : pictogramme « ${name} » (${type}) absent de la bibliothèque`);
      }
    }
    // La palette doit être complète : une variable manquante laisserait la
    // couleur de l'édition précédente à l'écran.
    for (const key of ['table', 'board', 'space', 'ink', 'panel', 'accent', 'boardInk']) {
      assert.ok(edition.theming?.palette?.[key], `${id} : couleur « ${key} » manquante`);
    }
  }
});

test('chaque illustration de case réclamée par une édition existe', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../client/src/components/SpaceArt.jsx', import.meta.url), 'utf8');
  // Les entrées de la bibliothèque : `cauldron: Cauldron`, plusieurs par ligne.
  const library = new Set([...source.matchAll(/\b([a-zA-Z]+): [A-Z]\w+[,\s}]/g)].map((m) => m[1]));

  for (const [id, edition] of ALL) {
    const art = edition.theming?.art ?? {};
    for (const [spaceId, name] of Object.entries(art)) {
      assert.ok(library.has(name), `${id} : illustration « ${name} » (case ${spaceId}) absente`);
      assert.ok(
        edition.board[Number(spaceId)],
        `${id} : illustration posée sur la case ${spaceId}, hors plateau`,
      );
    }
  }
});

test('chaque édition déclare la matière de son plateau', () => {
  const SKINS = ['table', 'parchment', 'night', 'tech', 'web'];
  for (const [id, edition] of ALL) {
    assert.ok(
      SKINS.includes(edition.theming?.skin),
      `${id} : matière « ${edition.theming?.skin} » inconnue`,
    );
  }
});

test('le plateau est numéroté sans trou et annoncé à la bonne taille', () => {
  for (const [id, edition] of ALL) {
    assert.equal(edition.board.length, edition.board.size ?? edition.board.length);
    edition.board.forEach((space, i) => {
      assert.equal(space.id, i, `${id} : case ${i} mal numérotée`);
      assert.ok(space.name?.length, `${id} : case ${i} sans nom`);
      assert.ok(space.shortName?.length, `${id} : case ${i} sans nom court`);
    });
    // Le rendu suppose un plateau carré : 4 côtés de même longueur.
    assert.equal(edition.board.length % 4, 0, `${id} : plateau non carré`);
  }
});

test('la case prison déclarée existe vraiment et est du bon type', () => {
  for (const [id, edition] of ALL) {
    const jail = edition.board[edition.jail.space];
    assert.ok(jail, `${id} : case prison hors plateau`);
    assert.equal(jail.type, 'jail', `${id} : la case ${edition.jail.space} n'est pas une prison`);
  }
});

test('toute case achetable a un prix, une hypothèque et un groupe déclaré', () => {
  for (const [id, edition] of ALL) {
    for (const space of edition.board.filter((s) => OWNABLE_TYPES.includes(s.type))) {
      assert.ok(space.price > 0, `${id} : ${space.name} sans prix`);
      assert.ok(space.mortgage > 0, `${id} : ${space.name} sans valeur hypothécaire`);
      const group = edition.groups[space.group];
      assert.ok(group, `${id} : groupe « ${space.group} » absent pour ${space.name}`);
      assert.ok(group.spaces.includes(space.id), `${id} : ${space.name} absente de son groupe`);
    }
    for (const group of Object.values(edition.groups)) {
      assert.equal(group.spaces.length, group.size, `${id} : taille du groupe ${group.id}`);
    }
  }
});

test('les loyers des terrains sont croissants sur les six paliers', () => {
  for (const [id, edition] of ALL) {
    for (const space of edition.board.filter((s) => s.type === 'property')) {
      assert.equal(space.rent.length, 6, `${id} : ${space.name} n'a pas 6 paliers`);
      for (let i = 1; i < 6; i++) {
        assert.ok(space.rent[i] > space.rent[i - 1], `${id} : ${space.name}, palier ${i} non croissant`);
      }
    }
  }
});

test('chaque pile compte des cartes uniques, applicables, et visant le plateau', () => {
  for (const [id, edition] of ALL) {
    for (const [deck, list] of Object.entries(edition.cards)) {
      const ids = new Set(list.map((c) => c.id));
      assert.equal(ids.size, list.length, `${id}/${deck} : identifiants dupliqués`);

      for (const card of list) {
        assert.ok(card.text?.length, `${id}/${deck} : ${card.id} sans texte`);
        // Une carte peut enchaîner plusieurs effets (`sequence`) ou en proposer
        // au choix (`choice`) : on vérifie chaque effet, pas seulement le premier.
        const actions =
          card.action.type === 'choice'
            ? card.action.options.map((o) => o.action)
            : card.action.type === 'sequence'
              ? card.action.actions
              : [card.action];
        for (const action of actions) {
          assert.ok(KNOWN_ACTIONS.has(action.type), `${id}/${deck} : action inconnue « ${action.type} »`);
          if (action.type === 'move_to') {
            assert.ok(
              action.target >= 0 && action.target < edition.board.length,
              `${id}/${deck} : ${card.id} vise la case ${action.target}, hors plateau`,
            );
          }
          if (action.type === 'nearest') {
            assert.ok(
              edition.board.some((s) => s.type === action.spaceType),
              `${id}/${deck} : ${card.id} cherche une case « ${action.spaceType} » que le plateau n'a pas`,
            );
          }
        }
      }
    }
    // Une carte « libérée de prison » par pile, comme dans la boîte. Les
    // éditions classiques en ont deux (deux piles) ; celle qui fusionne ses
    // piles en une seule n'en a qu'une, et c'est juste.
    const keepable = Object.values(edition.cards).flat().filter((c) => c.keepable);
    const deckCount = Object.keys(edition.cards).length;
    assert.equal(
      keepable.length,
      deckCount,
      `${id} : il faut une carte de sortie de prison par pile (${deckCount} pile(s))`,
    );
  }
});

/**
 * Le test décisif : une partie complète tourne sur chaque édition sans que le
 * moteur ait la moindre connaissance de son thème.
 */
test('une partie entière se joue sur chaque édition sans intervention du moteur', () => {
  for (const [id, edition] of ALL) {
    const game = createGame(`T${id.slice(0, 4).toUpperCase()}`, 'h', { seed: 20260819, editionId: id });
    const names = ['Alice', 'Bruno', 'Chloé'];
    names.forEach((name, i) => {
      const result = addPlayer(game, { id: `p${i}`, name, token: edition.tokens[i].id });
      assert.ok(result.ok, `${id} : ${name} n'a pas pu rejoindre — ${result.error}`);
    });
    assert.ok(startGame(game, 'p0').ok, `${id} : la partie n'a pas démarré`);

    const rng = createRng(7);
    const turnsAtStart = game.state.turnCount;
    for (let step = 0; step < 4000 && game.state.phase === 'playing'; step++) {
      const { kind, playerIds } = game.state.pending;
      if (!kind) break;
      const actor = playerIds[0];
      dispatch(game, actor, decide(game.state, kind, actor, rng));

      // Invariants après chaque action, sur toutes les éditions.
      for (const player of game.state.players) {
        assert.ok(player.cash >= 0, `${id} : solde négatif pour ${player.name}`);
        assert.ok(
          player.position >= 0 && player.position < edition.board.length,
          `${id} : ${player.name} hors plateau (${player.position})`,
        );
      }
      assert.ok(game.state.bank.houses >= 0 && game.state.bank.hotels >= 0, `${id} : stock négatif`);
    }

    // La partie doit avoir réellement avancé : sans ça, une boucle qui tourne
    // à vide sur un `pending` refusé passerait pour un succès.
    assert.ok(
      game.state.phase === 'finished' || game.state.turnCount > turnsAtStart + 10,
      `${id} : la partie n'a pas avancé (tour ${game.state.turnCount})`,
    );
  }
});

/** Une joueuse « raisonnable » : elle achète si elle peut, règle ses dettes, sinon renonce. */
function decide(state, kind, actor, rng) {
  const player = state.players.find((p) => p.id === actor);
  switch (kind) {
    case 'roll':
      return { type: 'ROLL_DICE' };
    case 'buy_or_auction':
      return player.cash >= state.pending.payload.price * 1.5
        ? { type: 'BUY_PROPERTY' }
        : { type: 'DECLINE_PROPERTY' };
    case 'auction_bid': {
      const bid = state.auction.highestBid + 10;
      return bid <= player.cash && rng.next() > 0.5
        ? { type: 'AUCTION_BID', amount: bid }
        : { type: 'AUCTION_PASS' };
    }
    case 'draw_card':
      return { type: 'DRAW_CARD' };
    case 'card_reveal':
      return { type: 'ACKNOWLEDGE_CARD' };
    case 'card_choice':
      return { type: 'CARD_CHOICE', optionIndex: 0 };
    case 'pay_debt':
      return player.cash >= state.debt.amount
        ? { type: 'PAY_DEBT' }
        : { type: 'DECLARE_BANKRUPTCY' };
    case 'end_turn':
      return { type: 'END_TURN' };
    // Relance offerte par un pouvoir de camp : on garde une fois sur deux.
    case 'reroll':
      return rng.next() > 0.5 ? { type: 'REROLL_DICE' } : { type: 'KEEP_ROLL' };
    default:
      // Surtout pas de repli silencieux : un `pending` que ce pilote ne connaît
      // pas ferait tourner la boucle à vide et le test passerait sans rien
      // jouer. On préfère qu'il tombe, en nommant ce qui manque.
      throw new Error(`pilote de test : « ${kind} » non géré`);
  }
}

/**
 * L'édition Spider-Man est un reskin exact du plateau classique : mêmes cases,
 * mêmes prix, mêmes loyers, seuls les noms changent. Ce test fige ce constat —
 * c'est lui qui a permis de reprendre les tables de loyers de l'édition
 * classique en confiance, la boîte ne donnant que les prix d'achat.
 */
test('Spider-Man reprend case pour case la géométrie et les prix du plateau classique', () => {
  const spiderman = EDITIONS['spiderman-fr'];
  const classic = EDITIONS['classic-fr'];
  assert.equal(spiderman.board.length, classic.board.length);

  for (let id = 0; id < classic.board.length; id++) {
    const sm = spiderman.board[id];
    const cl = classic.board[id];
    assert.equal(sm.type, cl.type, `case ${id} : type différent`);
    assert.equal(sm.group, cl.group, `case ${id} : groupe différent`);
    assert.equal(sm.price, cl.price, `case ${id} : prix différent`);
    assert.deepEqual(sm.rent, cl.rent, `case ${id} : loyers différents`);
    assert.equal(sm.amount, cl.amount, `case ${id} : montant de taxe différent`);
    // Le nom, lui, doit avoir changé partout sauf sur les cases neutres.
    if (sm.price) assert.notEqual(sm.name, cl.name, `case ${id} : nom non traduit`);
  }
});

test('Spider-Man déclare deux piles de seize cartes et ses six pions', () => {
  const spiderman = EDITIONS['spiderman-fr'];
  assert.equal(spiderman.cards.chance.length, 16);
  assert.equal(spiderman.cards.community_chest.length, 16);
  assert.equal(spiderman.tokens.length, 6);
  assert.equal(spiderman.currency.label, '$');
  assert.equal(spiderman.buildingLabels.house, 'Traceur');
});
