/**
 * Tests d'intégration de la couche temps réel : deux clients Socket.io réels
 * créent une partie, jouent, se déconnectent et reviennent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';

import { registerSocketHandlers } from '../server/sockets.js';
import { resetRooms } from '../server/rooms.js';

/** Démarre un serveur Socket.io sur un port libre. */
async function startServer() {
  resetRooms();
  const server = http.createServer();
  const io = new Server(server, { cors: { origin: true } });
  registerSocketHandlers(io);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    async close() {
      io.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

/** Connecte un client et expose des aides d'attente. */
function connect(url) {
  const socket = ioClient(url, { transports: ['websocket'], forceNew: true });
  const states = [];
  socket.on('game:state', (state) => states.push(state));

  return {
    socket,
    states,
    /** Attend le prochain événement `event` (ou le suivant satisfaisant `predicate`). */
    once(event, predicate = () => true) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout sur ${event}`)), 3000);
        const handler = (payload) => {
          if (!predicate(payload)) return;
          clearTimeout(timer);
          socket.off(event, handler);
          resolve(payload);
        };
        socket.on(event, handler);
      });
    },
    /**
     * Attend un état satisfaisant `predicate`, en regardant d'abord ceux déjà
     * reçus : le serveur diffuse l'état juste après `game:joined`, et un test
     * qui s'abonne ensuite le manquerait.
     */
    waitState(predicate = () => true) {
      const already = states.filter(predicate).at(-1);
      if (already) return Promise.resolve(already);
      return this.once('game:state', predicate);
    },
    close() {
      socket.close();
    },
  };
}

test('une partie se crée, se rejoint par code et se lance', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  const guest = connect(server.url);
  t.after(async () => {
    host.close();
    guest.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie', token: 'chat' });
  const joined = await host.once('game:joined');
  assert.match(joined.code, /^[A-Z2-9]{6}$/, 'le code est dictable à voix haute');

  guest.socket.emit('game:join', { code: joined.code, name: 'Sophie', token: 'bateau' });
  const guestJoined = await guest.once('game:joined');
  assert.equal(guestJoined.code, joined.code);

  // Les deux écrans voient les deux joueuses.
  const shared = await host.once('game:state', (s) => s.players.length === 2);
  assert.deepEqual(
    shared.players.map((p) => p.name),
    ['Julie', 'Sophie'],
  );

  host.socket.emit('game:start');
  const playing = await guest.once('game:state', (s) => s.phase === 'playing');
  assert.equal(playing.pending.kind, 'roll');
  assert.equal(playing.players.every((p) => p.cash === 1500), true);
});

test('seule la joueuse dont c\'est le tour peut agir', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  const guest = connect(server.url);
  t.after(async () => {
    host.close();
    guest.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie' });
  const { code, playerId: hostId } = await host.once('game:joined');
  guest.socket.emit('game:join', { code, name: 'Sophie' });
  await guest.once('game:joined');
  host.socket.emit('game:start');
  const playing = await host.once('game:state', (s) => s.phase === 'playing');

  // L'ordre de jeu est tiré aux dés : c'est lui qui décide qui doit attendre.
  const currentId = playing.players[playing.currentPlayerIndex].id;
  const waiting = currentId === hostId ? guest : host;

  waiting.socket.emit('game:action', { type: 'ROLL_DICE' });
  const error = await waiting.once('game:error');
  assert.match(error.message, /pas à vous/i);
});

test('un lancer se propage aux deux écrans', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  const guest = connect(server.url);
  t.after(async () => {
    host.close();
    guest.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie' });
  const { code, playerId } = await host.once('game:joined');
  guest.socket.emit('game:join', { code, name: 'Sophie' });
  await guest.once('game:joined');
  host.socket.emit('game:start');
  const playing = await host.once('game:state', (s) => s.phase === 'playing');

  const current = playing.players[playing.currentPlayerIndex];
  const mover = current.id === playerId ? host : guest;
  mover.socket.emit('game:action', { type: 'ROLL_DICE' });

  const seen = await guest.once('game:state', (s) => s.dice.values !== null);
  assert.equal(seen.dice.values.length, 2);
  assert.ok(seen.log.some((entry) => entry.type === 'roll'), 'le journal est partagé');
});

test('fermer l\'onglet ne perd pas la place, la reconnexion la retrouve', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  let guest = connect(server.url);
  t.after(async () => {
    host.close();
    guest.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie' });
  const { code } = await host.once('game:joined');
  guest.socket.emit('game:join', { code, name: 'Sophie' });
  const { playerId: guestId } = await guest.once('game:joined');
  host.socket.emit('game:start');
  await host.once('game:state', (s) => s.phase === 'playing');

  guest.close();
  const afterLeave = await host.once('game:state', (s) => s.players.some((p) => !p.connected));
  const gone = afterLeave.players.find((p) => p.id === guestId);
  assert.equal(gone.connected, false, 'la joueuse est marquée absente');
  assert.equal(afterLeave.players.length, 2, 'mais sa place est conservée');

  guest = connect(server.url);
  guest.socket.emit('game:rejoin', { code, playerId: guestId });
  const back = await guest.once('game:state', (s) => s.players.every((p) => p.connected));
  assert.equal(back.players.find((p) => p.id === guestId).cash, 1500);
});

test('rejoindre avec le même pseudo reprend la place laissée vacante', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  let guest = connect(server.url);
  t.after(async () => {
    host.close();
    guest.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie' });
  const { code } = await host.once('game:joined');
  guest.socket.emit('game:join', { code, name: 'Sophie' });
  const { playerId: guestId } = await guest.once('game:joined');
  host.socket.emit('game:start');
  await host.once('game:state', (s) => s.phase === 'playing');

  guest.close();
  await host.once('game:state', (s) => s.players.some((p) => !p.connected));

  // Sophie revient sans son identifiant (nouveau navigateur, même pseudo).
  guest = connect(server.url);
  guest.socket.emit('game:join', { code, name: 'Sophie' });
  const rejoined = await guest.once('game:joined');
  assert.equal(rejoined.playerId, guestId, 'elle retrouve son identité, pas une nouvelle place');
});

test('un code inconnu est refusé proprement', async (t) => {
  const server = await startServer();
  const client = connect(server.url);
  t.after(async () => {
    client.close();
    await server.close();
  });

  client.socket.emit('game:join', { code: 'ZZZZZZ', name: 'Julie' });
  const error = await client.once('game:error');
  assert.match(error.message, /Aucune partie/);
});

test('n\'importe quelle joueuse peut lancer la partie', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  const guest = connect(server.url);
  t.after(async () => {
    host.close();
    guest.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie' });
  const { code } = await host.once('game:joined');
  guest.socket.emit('game:join', { code, name: 'Sophie' });
  await guest.once('game:joined');

  // Sophie n'a pas créé la partie, et elle peut quand même la lancer : le
  // groupe se met d'accord en vocal, la première qui a la souris clique.
  guest.socket.emit('game:start');
  const playing = await guest.once('game:state', (s) => s.phase === 'playing');
  assert.equal(playing.players.length, 2);
});

test('n\'importe quelle joueuse peut arrêter la partie', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  const guest = connect(server.url);
  t.after(async () => {
    host.close();
    guest.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie' });
  const { code } = await host.once('game:joined');
  guest.socket.emit('game:join', { code, name: 'Sophie' });
  await guest.once('game:joined');
  host.socket.emit('game:start');
  await guest.once('game:state', (s) => s.phase === 'playing');

  guest.socket.emit('game:end');
  const finished = await host.once('game:state', (s) => s.phase === 'finished');
  assert.equal(finished.standings.length, 2, 'le classement est établi');
  assert.ok(finished.winnerId);
});

test('les règles maison se changent par n\'importe qui dans le salon', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  const guest = connect(server.url);
  t.after(async () => {
    host.close();
    guest.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie' });
  const { code } = await host.once('game:joined');
  guest.socket.emit('game:join', { code, name: 'Sophie' });
  await guest.once('game:joined');

  guest.socket.emit('game:settings', { settings: { freeParkingPot: true } });
  const state = await host.once('game:state', (s) => s.settings.freeParkingPot === true);
  assert.equal(state.settings.freeParkingPot, true);
});

test('le départ de la créatrice ne bloque pas le salon', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  const guest = connect(server.url);
  const third = connect(server.url);
  t.after(async () => {
    host.close();
    guest.close();
    third.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie' });
  const { code } = await host.once('game:joined');
  guest.socket.emit('game:join', { code, name: 'Sophie' });
  await guest.once('game:joined');
  third.socket.emit('game:join', { code, name: 'Marc' });
  await third.once('game:joined');

  host.close();
  const afterLeave = await guest.once('game:state', (s) => s.players.length === 2);
  assert.equal(afterLeave.players.length, 2, 'les deux autres restent dans le salon');

  guest.socket.emit('game:start');
  const playing = await guest.once('game:state', (s) => s.phase === 'playing');
  assert.equal(playing.players.length, 2);
});

test('le chat circule entre les joueuses', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  const guest = connect(server.url);
  t.after(async () => {
    host.close();
    guest.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie' });
  const { code } = await host.once('game:joined');
  guest.socket.emit('game:join', { code, name: 'Sophie' });
  await guest.once('game:joined');

  guest.socket.emit('game:action', { type: 'CHAT', text: 'on commence ?' });
  const seen = await host.once('game:state', (s) => s.chat.length > 0);
  assert.equal(seen.chat.at(-1).text, 'on commence ?');
});

test('une partie sauvegardée se recharge après un redémarrage', async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monopoly-'));
  process.env.MONOPOLY_DATA_DIR = dataDir;

  // `rooms.js` lit MONOPOLY_DATA_DIR à l'import : on recharge le module.
  const rooms = await import(`../server/rooms.js?data=${encodeURIComponent(dataDir)}`);
  const { createRoom, scheduleSave } = rooms;
  t.after(async () => {
    rooms.resetRooms();
    await fs.rm(dataDir, { recursive: true, force: true });
    delete process.env.MONOPOLY_DATA_DIR;
  });

  const room = createRoom('p0');
  room.state.players.push({ id: 'p0', name: 'Julie', cash: 1234, connected: true });
  scheduleSave(room);
  await new Promise((resolve) => setTimeout(resolve, 600));

  rooms.resetRooms();
  const restored = await rooms.restoreRooms();
  assert.ok(restored >= 1, 'au moins une partie relue depuis le disque');
  const reloaded = rooms.getRoom(room.state.code);
  assert.equal(reloaded.state.players[0].cash, 1234);
  assert.equal(reloaded.state.players[0].connected, false, 'tout le monde est à reconnecter');
});

// ————————————————————————————————————— Mode « même ordinateur »

test('plusieurs joueuses partagent une même connexion', async (t) => {
  const server = await startServer();
  const poste = connect(server.url);
  const distant = connect(server.url);
  t.after(async () => {
    poste.close();
    distant.close();
    await server.close();
  });

  poste.socket.emit('game:create', { name: 'Julie', token: 'bateau' });
  const { code, playerIds } = await poste.once('game:joined');
  assert.equal(playerIds.length, 1);

  poste.socket.emit('game:add-local', { name: 'Marc', token: 'chat' });
  const withMarc = await poste.once('game:joined', (p) => p.playerIds.length === 2);
  assert.equal(withMarc.playerIds.length, 2, 'les deux joueuses sont sur ce poste');

  distant.socket.emit('game:join', { code, name: 'Sophie', token: 'chapeau' });
  await distant.once('game:joined');

  const lobby = await poste.once('game:state', (s) => s.players.length === 3);
  assert.deepEqual(
    lobby.players.map((p) => p.token).sort(),
    ['bateau', 'chapeau', 'chat'],
    'un pion différent par joueuse',
  );

  poste.socket.emit('game:start');
  const playing = await poste.once('game:state', (s) => s.phase === 'playing');

  // Le poste joue pour celle qui a la main, sans avoir à préciser laquelle.
  const currentId = playing.players[playing.currentPlayerIndex].id;
  const holder = withMarc.playerIds.includes(currentId) ? poste : distant;
  holder.socket.emit('game:action', { type: 'ROLL_DICE' });
  const rolled = await poste.once('game:state', (s) => s.dice.values !== null);
  assert.equal(rolled.dice.values.length, 2);
});

test('un poste ne peut pas jouer pour une joueuse qui n\'est pas la sienne', async (t) => {
  const server = await startServer();
  const poste = connect(server.url);
  const distant = connect(server.url);
  t.after(async () => {
    poste.close();
    distant.close();
    await server.close();
  });

  poste.socket.emit('game:create', { name: 'Julie' });
  const { code } = await poste.once('game:joined');
  distant.socket.emit('game:join', { code, name: 'Sophie' });
  const { playerId: sophieId } = await distant.once('game:joined');
  poste.socket.emit('game:start');
  await poste.once('game:state', (s) => s.phase === 'playing');

  poste.socket.emit('game:action', { type: 'ROLL_DICE', playerId: sophieId });
  const error = await poste.once('game:error');
  assert.match(error.message, /pas sur ce poste/i);
});

test('deux joueuses ne partagent jamais le même pion', async (t) => {
  const server = await startServer();
  const poste = connect(server.url);
  t.after(async () => {
    poste.close();
    await server.close();
  });

  poste.socket.emit('game:create', { name: 'Julie', token: 'chat' });
  await poste.once('game:joined');

  // Le pion est déjà pris : plutôt que de refuser Marc, on lui en donne un autre.
  poste.socket.emit('game:add-local', { name: 'Marc', token: 'chat' });
  await poste.once('game:joined', (p) => p.playerIds.length === 2);
  const state = await poste.waitState((s) => s.players.length === 2);
  assert.equal(state.players[0].token, 'chat');
  assert.notEqual(state.players[1].token, 'chat');
});

test('retirer une joueuse du poste libère sa place et son pion', async (t) => {
  const server = await startServer();
  const poste = connect(server.url);
  t.after(async () => {
    poste.close();
    await server.close();
  });

  poste.socket.emit('game:create', { name: 'Julie', token: 'chat' });
  await poste.once('game:joined');
  poste.socket.emit('game:add-local', { name: 'Marc', token: 'bateau' });
  const two = await poste.once('game:joined', (p) => p.playerIds.length === 2);
  const marcId = two.playerIds[1];

  poste.socket.emit('game:remove-local', { playerId: marcId });
  const after = await poste.once('game:joined', (p) => p.playerIds.length === 1);
  assert.equal(after.playerIds.length, 1);

  const state = await poste.waitState((s) => s.players.length === 1);
  assert.equal(state.players[0].name, 'Julie');
});

test('la reconnexion ramène toutes les joueuses du poste', async (t) => {
  const server = await startServer();
  let poste = connect(server.url);
  const distant = connect(server.url);
  t.after(async () => {
    poste.close();
    distant.close();
    await server.close();
  });

  poste.socket.emit('game:create', { name: 'Julie' });
  const { code } = await poste.once('game:joined');
  poste.socket.emit('game:add-local', { name: 'Marc' });
  const two = await poste.once('game:joined', (p) => p.playerIds.length === 2);
  distant.socket.emit('game:join', { code, name: 'Sophie' });
  await distant.once('game:joined');
  poste.socket.emit('game:start');
  await distant.once('game:state', (s) => s.phase === 'playing');

  poste.close();
  await distant.once('game:state', (s) => s.players.filter((p) => !p.connected).length === 2);

  poste = connect(server.url);
  poste.socket.emit('game:rejoin', { code, playerIds: two.playerIds });
  const back = await poste.once('game:joined');
  assert.deepEqual(back.playerIds.sort(), [...two.playerIds].sort(), 'les deux places sont reprises');

  const state = await poste.waitState((s) => s.players.length === 3 && s.players.every((p) => p.connected));
  assert.equal(state.players.length, 3);
});

test('deux joueuses qui gardent le pion par défaut entrent quand même', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  const guest = connect(server.url);
  t.after(async () => {
    host.close();
    guest.close();
    await server.close();
  });

  // Personne ne touche au sélecteur : les deux demandent le même pion.
  host.socket.emit('game:create', { name: 'Julie', token: 'chapeau' });
  const { code } = await host.once('game:joined');
  guest.socket.emit('game:join', { code, name: 'Sophie', token: 'chapeau' });
  await guest.once('game:joined');

  const lobby = await host.once('game:state', (s) => s.players.length === 2);
  assert.equal(lobby.players.length, 2, 'Sophie entre malgré tout');
  assert.notEqual(lobby.players[0].token, lobby.players[1].token, 'et reçoit un autre pion');
});

test('un bot ajouté au salon joue tout seul une fois la partie lancée', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  t.after(async () => {
    host.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie', token: 'chat' });
  await host.once('game:joined');

  host.socket.emit('game:add-bot', { difficulty: 'expert' });
  const withBot = await host.once('game:state', (s) => s.players.length === 2);
  const bot = withBot.players.find((p) => p.bot);
  assert.ok(bot, 'le bot doit apparaître dans la partie');
  assert.equal(bot.bot, 'expert', 'son niveau est celui demandé');
  assert.equal(bot.connected, true, "un bot n'a pas de navigateur à attendre");

  host.socket.emit('game:start');
  await host.once('game:state', (s) => s.phase === 'playing');

  // L'ordre de jeu est tiré au sort, et le tour de Julie peut s'étirer (carte à
  // piocher, achat à trancher). On joue donc *sa* part le plus platement
  // possible jusqu'à ce que la main revienne au bot — et à partir de là on ne
  // touche plus à rien : s'il reste immobile, la partie se fige et l'attente
  // expire, ce qui est exactement le défaut qu'on veut attraper.
  const humanId = bot.id === withBot.players[0].id ? withBot.players[1].id : withBot.players[0].id;
  const plainMoves = {
    roll: { type: 'ROLL_DICE' },
    reroll: { type: 'KEEP_ROLL' },
    draw_card: { type: 'DRAW_CARD' },
    card_reveal: { type: 'ACKNOWLEDGE_CARD' },
    card_choice: { type: 'CARD_CHOICE', optionIndex: 0 },
    buy_or_auction: { type: 'DECLINE_PROPERTY' },
    auction_bid: { type: 'AUCTION_PASS' },
    end_turn: { type: 'END_TURN' },
    pay_debt: { type: 'PAY_DEBT' },
  };
  // Le journal porte l'autrice dans `data`, pas à la racine de l'entrée.
  const botHasRolled = () =>
    host.states.at(-1)?.log?.some((entry) => entry.type === 'roll' && entry.data?.playerId === bot.id);

  // Une seule boucle, sans course entre deux attentes : à chaque passage on
  // joue la part de Julie si on la lui demande, et l'on regarde si le bot a
  // bougé. S'il reste immobile, la boucle s'épuise — c'est précisément le
  // défaut qu'on veut attraper.
  for (let i = 0; i < 120 && !botHasRolled(); i++) {
    const now = host.states.at(-1);
    const move = now?.pending?.playerIds?.includes(humanId) ? plainMoves[now.pending.kind] : null;
    if (move) host.socket.emit('game:action', { ...move, playerId: humanId });
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  assert.ok(botHasRolled(), 'le bot doit lancer les dés de lui-même');
});

test('un bot se retire du salon, mais plus une fois la partie lancée', async (t) => {
  const server = await startServer();
  const host = connect(server.url);
  t.after(async () => {
    host.close();
    await server.close();
  });

  host.socket.emit('game:create', { name: 'Julie', token: 'chat' });
  await host.once('game:joined');
  host.socket.emit('game:add-bot', { difficulty: 'facile' });
  const withBot = await host.once('game:state', (s) => s.players.length === 2);
  const botId = withBot.players.find((p) => p.bot).id;

  host.socket.emit('game:remove-bot', { playerId: botId });
  const without = await host.once('game:state', (s) => s.players.length === 1);
  assert.equal(without.players.some((p) => p.bot), false);

  // Deux bots pour pouvoir lancer, puis on vérifie que le retrait est refusé.
  host.socket.emit('game:add-bot', { difficulty: 'moyen' });
  const again = await host.once('game:state', (s) => s.players.length === 2);
  host.socket.emit('game:start');
  await host.once('game:state', (s) => s.phase === 'playing');

  host.socket.emit('game:remove-bot', { playerId: again.players.find((p) => p.bot).id });
  const refus = await host.once('game:error');
  assert.match(refus.message, /commenc/i, 'on ne retire pas un bot en pleine partie');
});
