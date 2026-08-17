/**
 * Passerelle Socket.io ↔ moteur de jeu.
 *
 * Cette couche ne connaît aucune règle du Monopoly : elle identifie la joueuse,
 * appelle `dispatch`, et rediffuse l'état. Toute la validation reste dans le
 * moteur — un client bricolé ne peut donc rien faire d'illégal.
 */
import {
  addPlayer,
  dispatch,
  publicState,
  reconnectPlayer,
  removePlayer,
  startGame,
  updateSettings,
  playerById,
} from './engine/index.js';
import { createRoom, getRoom, newPlayerId, scheduleSave } from './rooms.js';
import { rules } from '../shared/index.js';

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
    /** Contexte de cette connexion, rempli à la première entrée dans une partie. */
    let session = null;

    const fail = (message) => socket.emit('game:error', { message });

    const enterRoom = (room, playerId) => {
      session = { code: room.state.code, playerId };
      socket.join(room.state.code);
      socket.emit('game:joined', { code: room.state.code, playerId });
      broadcast(io, room);
    };

    // — Créer une partie ————————————————————————————————————
    socket.on('game:create', ({ name, token, settings } = {}) => {
      const pseudo = cleanName(name);
      if (!pseudo) return fail('Choisissez un pseudo.');

      const playerId = newPlayerId();
      const room = createRoom(playerId);
      const added = addPlayer(room, { id: playerId, name: pseudo, token });
      if (!added.ok) return fail(added.error);
      if (settings) updateSettings(room, playerId, settings);
      enterRoom(room, playerId);
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
        return enterRoom(room, existing.id);
      }

      const playerId = newPlayerId();
      const added = addPlayer(room, { id: playerId, name: pseudo, token });
      if (!added.ok) return fail(added.error);
      enterRoom(room, playerId);
    });

    // — Reconnexion silencieuse (rafraîchissement de la page) ————————————
    socket.on('game:rejoin', ({ code, playerId } = {}) => {
      const room = getRoom(code);
      if (!room) return fail('Cette partie n\'existe plus.');
      const result = reconnectPlayer(room, playerId);
      if (!result.ok) return fail(result.error);
      enterRoom(room, playerId);
    });

    // — Réglages et lancement (hôte) ————————————————————————————
    socket.on('game:settings', ({ settings } = {}) => {
      const room = session && getRoom(session.code);
      if (!room) return fail('Vous n\'êtes dans aucune partie.');
      const result = updateSettings(room, session.playerId, settings ?? {});
      if (!result.ok) return fail(result.error);
      broadcast(io, room);
    });

    socket.on('game:start', () => {
      const room = session && getRoom(session.code);
      if (!room) return fail('Vous n\'êtes dans aucune partie.');
      const result = startGame(room, session.playerId);
      if (!result.ok) return fail(result.error);
      broadcast(io, room);
    });

    // — Actions de jeu ————————————————————————————————————
    socket.on('game:action', (action = {}) => {
      const room = session && getRoom(session.code);
      if (!room) return fail('Vous n\'êtes dans aucune partie.');
      const result = dispatch(room, session.playerId, action);
      if (!result.ok) return fail(result.error);
      broadcast(io, room);
    });

    // — Quitter ————————————————————————————————————————
    socket.on('game:leave', () => {
      const room = session && getRoom(session.code);
      if (room) {
        removePlayer(room, session.playerId);
        socket.leave(room.state.code);
        broadcast(io, room);
      }
      session = null;
    });

    socket.on('disconnect', () => {
      const room = session && getRoom(session.code);
      if (!room) return;
      // On ne retire personne d'une partie lancée : la place et les biens
      // attendent la reconnexion.
      removePlayer(room, session.playerId);
      const player = playerById(room.state, session.playerId);
      if (player) player.connected = false;
      broadcast(io, room);
    });
  });
}

/** Métadonnées utiles au client avant même d'entrer dans une partie. */
export function lobbyInfo() {
  return {
    tokens: rules.tokens,
    minPlayers: rules.minPlayers,
    maxPlayers: rules.maxPlayers,
    houseRules: rules.houseRules,
  };
}
