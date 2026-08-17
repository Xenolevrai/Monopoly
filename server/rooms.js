/**
 * Registre des parties en cours.
 *
 * Les parties vivent en mémoire (c'est la source de vérité) et sont recopiées
 * sur disque après chaque mutation, avec un léger délai. Si le serveur redémarre
 * au milieu d'une soirée, on relit les fichiers et personne ne perd sa partie.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { createGame } from './engine/index.js';
import { createRng } from './engine/rng.js';

/** Alphabet sans caractères ambigus (ni O/0, ni I/1) : un code se dicte à voix haute. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const SAVE_DEBOUNCE_MS = 400;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const DATA_DIR = process.env.MONOPOLY_DATA_DIR ?? path.join(process.cwd(), 'server', 'data');

/** @type {Map<string, { state: object, rng: object, savedAt: number, timer: any }>} */
const games = new Map();

export function generateCode() {
  let code;
  do {
    code = Array.from(
      { length: CODE_LENGTH },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join('');
  } while (games.has(code));
  return code;
}

export function newPlayerId() {
  return randomUUID();
}

/** Crée une partie et son hôte. */
export function createRoom(hostId) {
  const code = generateCode();
  const game = createGame(code, hostId);
  games.set(code, { ...game, savedAt: 0, timer: null });
  return games.get(code);
}

export function getRoom(code) {
  return games.get(String(code ?? '').toUpperCase()) ?? null;
}

export function roomCount() {
  return games.size;
}

export function deleteRoom(code) {
  const room = games.get(code);
  if (room?.timer) clearTimeout(room.timer);
  games.delete(code);
  return fs.rm(filePath(code), { force: true }).catch(() => {});
}

function filePath(code) {
  return path.join(DATA_DIR, `${code}.json`);
}

/**
 * Programme une sauvegarde. Les actions arrivent en rafale (déplacement, loyer,
 * journal) : on regroupe les écritures plutôt que d'écrire dix fois par tour.
 */
export function scheduleSave(room) {
  if (room.timer) return;
  room.timer = setTimeout(() => {
    room.timer = null;
    save(room).catch((err) => console.error('[monopoly] sauvegarde impossible :', err.message));
  }, SAVE_DEBOUNCE_MS);
}

async function save(room) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const payload = JSON.stringify({ savedAt: Date.now(), state: room.state });
  await fs.writeFile(filePath(room.state.code), payload, 'utf8');
  room.savedAt = Date.now();
}

/**
 * Relit les parties sauvegardées au démarrage.
 * Le générateur aléatoire repart d'une graine neuve : seul l'état de la partie
 * est restauré, pas la suite des futurs jets (ce qui n'a aucune importance).
 */
export async function restoreRooms() {
  let files;
  try {
    files = await fs.readdir(DATA_DIR);
  } catch {
    return 0; // aucun dossier de données : premier démarrage
  }

  let restored = 0;
  for (const file of files.filter((f) => f.endsWith('.json'))) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf8'));
      if (!raw?.state?.code) continue;
      if (Date.now() - (raw.savedAt ?? 0) > MAX_AGE_MS) {
        await fs.rm(path.join(DATA_DIR, file), { force: true });
        continue;
      }
      // Tout le monde est déconnecté au redémarrage : on attend les reconnexions.
      for (const player of raw.state.players) player.connected = false;
      games.set(raw.state.code, {
        state: raw.state,
        rng: createRng(Date.now()),
        savedAt: raw.savedAt,
        timer: null,
      });
      restored += 1;
    } catch (err) {
      console.error(`[monopoly] partie illisible (${file}) :`, err.message);
    }
  }
  return restored;
}

/** Supprime les parties inactives depuis plus de 24 h. */
export async function purgeStaleRooms() {
  const now = Date.now();
  for (const [code, room] of games) {
    const lastActivity = room.state.log.at(-1)?.at ?? room.savedAt;
    if (now - lastActivity > MAX_AGE_MS) await deleteRoom(code);
  }
}

/** Vide le registre (tests). */
export function resetRooms() {
  for (const room of games.values()) if (room.timer) clearTimeout(room.timer);
  games.clear();
}
