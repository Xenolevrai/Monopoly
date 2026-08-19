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
import { listEditions, DEFAULT_EDITION } from '../shared/index.js';

/** Nettoie un pseudo saisi par une joueuse. */
function cleanName(name) {
  return String(name ?? '').trim().slice(0, 20);
}

/** Diffuse l'état à toute la salle et programme la sauvegarde. */
function broadcast(io, room) {
  io.to(room.state.code).emit('game:state', publicState(room.state));
  scheduleSave(room);
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
    socket.on('game:create', ({ name, token, settings, editionId } = {}) => {
      const pseudo = cleanName(name);
      if (!pseudo) return fail('Choisissez un pseudo.');

      const playerId = newPlayerId();
      const room = createRoom(playerId, editionId ?? DEFAULT_EDITION);
      const added = addPlayer(room, { id: playerId, name: pseudo, token });
      if (!added.ok) return fail(added.error);
      if (settings) updateSettings(room, playerId, settings);
      enterRoom(room, [playerId]);
    });

    // — Rejoindre avec un code ————————————————————————————————
    socket.on('game:join', ({ code, name, token } = {}) => {
      const room = getRoom(code);
      if (!room) return fail('Aucune partie ne porte ce code.');
      const pseudo = cleanName(name);
      if (!pseudo) return fail('Choisissez un pseudo.');

      // Reprise d'une place laissée vacante : même pseudo, partie déjà lancée.
      const existing = room.state.players.find(
        (p) => p.name.toLowerCase() === pseudo.toLowerCase() && !p.connected,
      );
      if (existing) {
        reconnectPlayer(room, existing.id);
        return enterRoom(room, [existing.id]);
      }

      const playerId = newPlayerId();
      const added = addPlayer(room, { id: playerId, name: pseudo, token });
      if (!added.ok) return fail(added.error);
      enterRoom(room, [playerId]);
    });

    // — Ajouter une joueuse sur CE poste (mode même ordinateur) ————————
    socket.on('game:add-local', ({ name, token } = {}) => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes dans aucune partie.");
      const pseudo = cleanName(name);
      if (!pseudo) return fail('Choisissez un pseudo.');

      const playerId = newPlayerId();
      const added = addPlayer(room, { id: playerId, name: pseudo, token });
      if (!added.ok) return fail(added.error);
      session.playerIds.push(playerId);
      announce(room);
    });

    // — Retirer une joueuse de ce poste (lobby uniquement) ————————————
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
