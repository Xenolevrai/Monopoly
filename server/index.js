/**
 * Serveur de jeu : un seul processus, un seul port.
 *
 * Express sert le client compilé et Socket.io partage le même serveur HTTP :
 * il n'y a qu'une commande à lancer et qu'une URL à partager aux joueuses.
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

import express from 'express';
import { Server } from 'socket.io';

import { registerSocketHandlers, lobbyInfo } from './sockets.js';
import { restoreRooms, purgeStaleRooms, getRoom, roomCount, listRooms } from './rooms.js';
import { getEdition, DEFAULT_EDITION } from '../shared/index.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(ROOT, '..', 'client', 'dist');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

// — API minimale ————————————————————————————————————————
app.get('/api/health', (req, res) => res.json({ ok: true, games: roomCount() }));

/** Données du plateau d'une édition. Le client les a déjà, c'est un point d'inspection. */
app.get('/api/board', (req, res) => {
  const edition = getEdition(req.query.edition ?? DEFAULT_EDITION);
  res.json({ board: edition.board, groups: edition.groups, rules: lobbyInfo() });
});

/** Les parties en cours, pour reprendre une soirée interrompue. */
app.get('/api/games', (req, res) => res.json({ games: listRooms() }));

/** Vérifie un code avant d'afficher l'écran de saisie du pseudo. */
app.get('/api/game/:code', (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ ok: false, error: 'Aucune partie ne porte ce code.' });
  res.json({
    ok: true,
    code: room.state.code,
    phase: room.state.phase,
    players: room.state.players.map((p) => ({ name: p.name, token: p.token, connected: p.connected })),
  });
});

// — Client compilé ————————————————————————————————————————
app.use(express.static(CLIENT_DIST));
app.get(/^\/(?!api\/|socket\.io\/).*/, (req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'), (err) => {
    if (err) res.status(503).send('Client non compilé : lancez `npm run build` dans client/.');
  });
});

registerSocketHandlers(io);

/** Adresses IP locales à partager aux autres joueuses du même wifi. */
function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => `http://${iface.address}:${PORT}`);
}

const restored = await restoreRooms();
if (restored) console.log(`[monopoly] ${restored} partie(s) restaurée(s) depuis le disque.`);
setInterval(purgeStaleRooms, 60 * 60 * 1000).unref();

server.listen(PORT, HOST, () => {
  console.log(`\n  Monopoly Paris — serveur démarré`);
  console.log(`  Sur cet ordinateur : http://localhost:${PORT}`);
  for (const address of localAddresses()) console.log(`  Pour les autres    : ${address}`);
  console.log('');
});

export { app, server, io };
