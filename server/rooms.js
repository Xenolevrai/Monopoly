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
import { fileURLToPath } from 'node:url';

import { createGame } from './engine/index.js';
import { createRng } from './engine/rng.js';

/** Alphabet sans caractères ambigus (ni O/0, ni I/1) : un code se dicte à voix haute. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const SAVE_DEBOUNCE_MS = 400;
// Une partie commencée un soir doit pouvoir se finir des jours plus tard : on ne
// jette que ce qui n'a plus été touché depuis un mois.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Ancré sur l'emplacement de ce fichier, pas sur le répertoire de lancement :
// `npm start` depuis un raccourci, un autre terminal ou un autre dossier ne
// doit jamais faire pointer vers un dossier de sauvegarde différent de celui
// d'hier — sans quoi les parties « disparaissent » sans la moindre erreur.
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.MONOPOLY_DATA_DIR ?? path.join(MODULE_DIR, 'data');

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
export function createRoom(hostId, editionId, locale, extensionIds) {
  const code = generateCode();
  const game = createGame(code, hostId, { editionId, locale, extensionIds });
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
      // Sauf les bots — ils n'ont pas de navigateur à rouvrir, et les marquer
      // absents ferait croire qu'on attend quelqu'un qui ne viendra jamais.
      for (const player of raw.state.players) player.connected = Boolean(player.bot);
      // Migration : les parties sauvegardées avant l'ajout du compteur de journal
      // n'en ont pas. On le fait repartir après le plus grand id déjà écrit, pour
      // qu'aucune nouvelle entrée ne réutilise une clé déjà affichée.
      if (raw.state.logSeq == null) {
        const maxId = raw.state.log.reduce((max, entry) => {
          const n = Number(String(entry.id).replace(/^e/, ''));
          return Number.isFinite(n) && n > max ? n : max;
        }, 0);
        raw.state.logSeq = maxId;
      }
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

/**
 * Les parties reprenables, les plus récemment jouées d'abord.
 * Sert à retrouver sa partie de la semaine dernière sans avoir noté le code.
 */
export function listRooms() {
  return [...games.values()]
    .map((room) => ({
      code: room.state.code,
      editionId: room.state.editionId,
      locale: room.state.locale,
      phase: room.state.phase,
      turnCount: room.state.turnCount,
      lastPlayed: room.state.log.at(-1)?.at ?? room.savedAt,
      players: room.state.players.map((p) => ({
        id: p.id,
        name: p.name,
        token: p.token,
        color: p.color,
        cash: p.cash,
        bankrupt: p.bankrupt,
        // Sert à montrer qui est déjà revenu : on reprend sa place en cliquant
        // son nom, sans avoir à retaper son pseudo ni à retrouver le code.
        connected: p.connected,
      })),
    }))
    .filter((room) => room.phase !== 'finished')
    .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
}

/** Supprime les parties inactives depuis plus d'un mois. */
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
