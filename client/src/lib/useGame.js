/**
 * État partagé de la partie, alimenté par le serveur.
 *
 * Une même connexion peut porter plusieurs joueuses (mode « même ordinateur ») :
 * `mine` est la liste de celles qui jouent sur ce poste, et `me` celle qui a la
 * main en ce moment — c'est elle qui agit quand on clique.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { socket, saveSession, loadSession, clearSession } from './socket.js';

export function useGame() {
  const [state, setState] = useState(null);
  const [session, setSession] = useState(() => loadSession());
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [focusId, setFocusId] = useState(null);
  const rejoined = useRef(false);

  useEffect(() => {
    const onState = (next) => setState(next);
    const onJoined = (next) => {
      const clean = { code: next.code, playerIds: next.playerIds ?? [next.playerId].filter(Boolean) };
      setSession(clean);
      saveSession(clean);
      setError(null);
    };
    const onError = ({ message }) => setError(message);
    const onConnect = () => {
      setConnected(true);
      // Reprise automatique après un rafraîchissement de page ou une coupure.
      const saved = loadSession();
      if (saved?.code && saved.playerIds?.length) socket.emit('game:rejoin', saved);
      rejoined.current = true;
    };
    const onDisconnect = () => setConnected(false);

    socket.on('game:state', onState);
    socket.on('game:joined', onJoined);
    socket.on('game:error', onError);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected && !rejoined.current) onConnect();

    return () => {
      socket.off('game:state', onState);
      socket.off('game:joined', onJoined);
      socket.off('game:error', onError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Un code invalide en mémoire ne doit pas coincer l'écran d'accueil.
  useEffect(() => {
    if (error && /n'existe plus|Aucune partie|inconnue/i.test(error) && !state) leave();
  }, [error, state]);

  const leave = () => {
    socket.emit('game:leave');
    clearSession();
    setSession(null);
    setState(null);
    setFocusId(null);
  };

  /** Les joueuses installées sur ce poste, dans l'ordre de jeu. */
  const mine = useMemo(() => {
    if (!state || !session?.playerIds) return [];
    return state.players.filter((p) => session.playerIds.includes(p.id));
  }, [state, session]);

  /**
   * La joueuse qui agit quand on clique : celle du poste à qui le jeu demande
   * quelque chose, sinon celle sélectionnée à la main, sinon la première.
   */
  const me = useMemo(() => {
    if (!mine.length) return null;
    const awaited = mine.find((p) => state?.pending?.playerIds?.includes(p.id) && !p.bankrupt);
    if (awaited) return awaited;
    const focused = mine.find((p) => p.id === focusId && !p.bankrupt);
    return focused ?? mine.find((p) => !p.bankrupt) ?? mine[0];
  }, [mine, state, focusId]);

  return {
    state,
    me,
    mine,
    session,
    error,
    connected,
    setError,
    leave,
    focusOn: setFocusId,
    /** Vrai si plusieurs joueuses partagent cet écran. */
    hotSeat: mine.length > 1,
  };
}
