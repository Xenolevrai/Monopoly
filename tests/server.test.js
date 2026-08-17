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
import { resetRooms, restoreRooms, getRoom } from '../server/rooms.js';

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

test('seule l\'hôte peut lancer la partie', async (t) => {
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

  guest.socket.emit('game:start');
  const error = await guest.once('game:error');
  assert.match(error.message, /hôte/);
});

test('si l\'hôte quitte le lobby, une autre joueuse reprend la main', async (t) => {
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
  assert.equal(afterLeave.hostId, afterLeave.players[0].id, 'Sophie devient hôte');

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
