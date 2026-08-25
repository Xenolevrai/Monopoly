/**
 * Passerelle Socket.io ↔ moteur de jeu.
 *
 * Cette couche ne connaît aucune règle du Monopoly : elle identifie la joueuse,
 * appelle `dispatch`, et rediffuse l'état. Toute la validation reste dans le
 * moteur — un client bricolé ne peut donc rien faire d'illégal.
 *
 * Une connexion peut porter PLUSIEURS joueuses : c'est le mode « même
 * ordinateur ». La session garde donc une liste d'identifiants, et chaque
 * action précise pour qui elle est jouée.
 */
import {
  addPlayer,
  dispatch,
  publicState,
  reconnectPlayer,
  removePlayer,
  startGame,
  endGame,
  updateSettings,
  playerById,
} from './engine/index.js';
import { createRoom, getRoom, newPlayerId, scheduleSave } from './rooms.js';
import { scheduleBots, stopBots } from './bots/runner.js';
import { archiveGame } from './archive.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, PROFILES } from './bots/profiles.js';
import { listEditions, DEFAULT_EDITION } from '../shared/index.js';

/** Nettoie un pseudo saisi par une joueuse. */
function cleanName(name) {
  return String(name ?? '').trim().slice(0, 20);
}

/**
 * Diffuse l'état à toute la salle et programme la sauvegarde.
 *
 * C'est aussi le point où les bots reprennent la main : après chaque
 * changement d'état, si la décision attendue est celle d'une joueuse
 * artificielle, son coup est programmé. Une partie entre bots se déroule donc
 * toute seule, sans que le moteur ait à connaître leur existence.
 */
function broadcast(io, room) {
  io.to(room.state.code).emit('game:state', publicState(room.state));
  scheduleSave(room);
  // La diffusion suit chaque changement d'état : c'est donc le seul endroit
  // d'où l'on est sûr de voir toutes les fins de partie, quel qu'en soit le
  // chemin (faillite, exploration, carte verte, arrêt à la main).
  if (room.state.phase === 'finished') {
    stopBots(room.state.code);
    archiveGame(room);
  } else scheduleBots(room, (r) => {
    io.to(r.state.code).emit('game:state', publicState(r.state));
    scheduleSave(r);
    if (r.state.phase === 'finished') {
      stopBots(r.state.code);
      archiveGame(r);
    }
  });
}

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    /** Contexte de cette connexion : une partie, une ou plusieurs joueuses. */
    let session = null;

    const fail = (message) => socket.emit('game:error', { message });

    /** Confirme au client la liste de « ses » joueuses sur ce poste. */
    const announce = (room) => {
      socket.emit('game:joined', {
        code: room.state.code,
        playerIds: session.playerIds,
        // Compatibilité : la dernière joueuse ajoutée sur ce poste.
        playerId: session.playerIds.at(-1) ?? null,
      });
      broadcast(io, room);
    };

    const enterRoom = (room, playerIds) => {
      session = { code: room.state.code, playerIds: [...playerIds] };
      socket.join(room.state.code);
      announce(room);
    };

    /** La salle de cette session, ou null. */
    const currentRoom = () => (session ? getRoom(session.code) : null);

    // — Créer une partie ————————————————————————————————————
    socket.on('game:create', ({ name, token, settings, editionId, faction, locale, extensionIds } = {}) => {
      const pseudo = cleanName(name);
      if (!pseudo) return fail('Choisissez un pseudo.');

      const playerId = newPlayerId();
      const room = createRoom(playerId, editionId ?? DEFAULT_EDITION, locale, extensionIds);
      const added = addPlayer(room, { id: playerId, name: pseudo, token, faction });
      if (!added.ok) return fail(added.error);
      if (settings) updateSettings(room, playerId, settings);
      enterRoom(room, [playerId]);
    });

    // — Rejoindre avec un code ————————————————————————————————
    socket.on('game:join', ({ code, name, token, faction } = {}) => {
      const room = getRoom(code);
      if (!room) return fail('Aucune partie ne porte ce code.');
      const pseudo = cleanName(name);
      if (!pseudo) return fail('Choisissez un pseudo.');

      // Reprise d'une place déjà occupée par ce pseudo. On préfère une place
      // laissée vacante, mais on accepte aussi de reprendre la sienne depuis un
      // second appareil : entre nous, personne ne cherche à voler une partie, et
      // refuser bloquerait quelqu'un dehors pour rien.
      const sameName = room.state.players.filter(
        (p) => p.name.toLowerCase() === pseudo.toLowerCase(),
      );
      const existing = sameName.find((p) => !p.connected) ?? sameName[0];
      if (existing) {
        reconnectPlayer(room, existing.id);
        return enterRoom(room, [existing.id]);
      }

      const playerId = newPlayerId();
      const added = addPlayer(room, { id: playerId, name: pseudo, token, faction });
      if (!added.ok) return fail(added.error);
      enterRoom(room, [playerId]);
    });

    // — Ajouter une joueuse sur CE poste (mode même ordinateur) ————————
    socket.on('game:add-local', ({ name, token, faction } = {}) => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes dans aucune partie.");
      const pseudo = cleanName(name);
      if (!pseudo) return fail('Choisissez un pseudo.');

      const playerId = newPlayerId();
      const added = addPlayer(room, { id: playerId, name: pseudo, token, faction });
      if (!added.ok) return fail(added.error);
      session.playerIds.push(playerId);
      announce(room);
    });

    // — Retirer une joueuse de ce poste (lobby uniquement) ————————————
    // — Ajouter une joueuse artificielle ————————————————————
    socket.on('game:add-bot', ({ difficulty, token } = {}) => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes dans aucune partie.");
      if (room.state.phase !== 'lobby') return fail('La partie a déjà commencé.');

      const level = DIFFICULTIES.includes(difficulty) ? difficulty : DEFAULT_DIFFICULTY;
      // Un nom qui dit ce que c'est : à table, on doit savoir qui est un bot.
      const base = PROFILES[level].label;
      let name = base;
      let n = 2;
      while (room.state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        name = `${base} ${n++}`;
      }

      const added = addPlayer(room, { id: newPlayerId(), name, token, bot: level });
      if (!added.ok) return fail(added.error);
      announce(room);
    });

    socket.on('game:remove-bot', ({ playerId } = {}) => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes dans aucune partie.");
      if (room.state.phase !== 'lobby') return fail('La partie a déjà commencé.');
      const player = playerById(room.state, playerId);
      if (!player?.bot) return fail("Cette joueuse n'est pas un bot.");
      removePlayer(room, playerId);
      announce(room);
    });

    socket.on('game:remove-local', ({ playerId } = {}) => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes dans aucune partie.");
      if (!session.playerIds.includes(playerId)) return fail("Cette joueuse n'est pas sur ce poste.");
      if (room.state.phase !== 'lobby') return fail('La partie a déjà commencé.');
      if (session.playerIds.length === 1) return fail('Il doit rester au moins une joueuse sur ce poste.');

      removePlayer(room, playerId);
      session.playerIds = session.playerIds.filter((id) => id !== playerId);
      announce(room);
    });

    // — Reconnexion silencieuse (rafraîchissement de la page) ————————————
    socket.on('game:rejoin', ({ code, playerId, playerIds } = {}) => {
      const room = getRoom(code);
      if (!room) return fail("Cette partie n'existe plus.");

      const wanted = (playerIds ?? [playerId]).filter(Boolean);
      const found = wanted.filter((id) => reconnectPlayer(room, id).ok);
      if (!found.length) return fail('Joueuse inconnue dans cette partie.');
      enterRoom(room, found);
    });

    // — Réglages et lancement (hôte) ————————————————————————————
    socket.on('game:settings', ({ settings } = {}) => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes dans aucune partie.");
      const result = updateSettings(room, session.playerIds[0], settings ?? {});
      if (!result.ok) return fail(result.error);
      broadcast(io, room);
    });

    socket.on('game:end', () => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes dans aucune partie.");
      const result = endGame(room, session.playerIds[0]);
      if (!result.ok) return fail(result.error);
      broadcast(io, room);
    });

    socket.on('game:start', () => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes dans aucune partie.");
      const result = startGame(room, session.playerIds[0]);
      if (!result.ok) return fail(result.error);
      broadcast(io, room);
    });

    // — Actions de jeu ————————————————————————————————————
    socket.on('game:action', (action = {}) => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes dans aucune partie.");

      const actor = resolveActor(room.state, session.playerIds, action.playerId);
      if (!actor) return fail("Cette joueuse n'est pas sur ce poste.");

      const result = dispatch(room, actor, action);
      if (!result.ok) return fail(result.error);
      broadcast(io, room);
    });

    // — Quitter ————————————————————————————————————————
    socket.on('game:leave', () => {
      const room = currentRoom();
      if (room) {
        for (const playerId of session.playerIds) removePlayer(room, playerId);
        socket.leave(room.state.code);
        broadcast(io, room);
      }
      session = null;
    });

    socket.on('disconnect', () => {
      const room = currentRoom();
      if (!room) return;
      // On ne retire personne d'une partie lancée : la place et les biens
      // attendent la reconnexion.
      for (const playerId of session.playerIds) {
        removePlayer(room, playerId);
        const player = playerById(room.state, playerId);
        if (player) player.connected = false;
      }
      broadcast(io, room);
    });
  });
}

/**
 * Décide pour quelle joueuse du poste l'action est jouée.
 * Si le client précise `playerId`, on le respecte (à condition qu'il soit bien
 * sur ce poste). Sinon on prend celle à qui le jeu demande quelque chose —
 * c'est ce qui rend le mode « même ordinateur » naturel : on clique, et c'est
 * toujours la bonne joueuse qui agit.
 */
export function resolveActor(state, playerIds, requested) {
  if (requested) return playerIds.includes(requested) ? requested : null;
  const awaited = playerIds.find((id) => state.pending?.playerIds?.includes(id));
  return awaited ?? playerIds[0] ?? null;
}

/** Le catalogue des éditions, pour la galerie de sélection. */
export function lobbyInfo() {
  return { editions: listEditions(), defaultEdition: DEFAULT_EDITION };
}
