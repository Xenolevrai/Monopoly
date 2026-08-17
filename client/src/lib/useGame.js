/** État partagé de la partie, alimenté par le serveur. */
import { useEffect, useRef, useState } from 'react';
import { socket, saveSession, loadSession, clearSession } from './socket.js';

export function useGame() {
  const [state, setState] = useState(null);
  const [session, setSession] = useState(() => loadSession());
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const rejoined = useRef(false);

  useEffect(() => {
    const onState = (next) => setState(next);
    const onJoined = (next) => {
      setSession(next);
      saveSession(next);
      setError(null);
    };
    const onError = ({ message }) => setError(message);
    const onConnect = () => {
      setConnected(true);
      // Reprise automatique après un rafraîchissement de page ou une coupure.
      const saved = loadSession();
      if (saved?.code && saved?.playerId) socket.emit('game:rejoin', saved);
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
  };

  const me = state && session ? state.players.find((p) => p.id === session.playerId) ?? null : null;

  return { state, me, session, error, connected, setError, leave };
}

/** Vrai si c'est à cette joueuse de répondre à ce qui est en attente. */
export function isMyTurn(state, me) {
  return Boolean(me && state?.pending?.playerIds?.includes(me.id));
}
