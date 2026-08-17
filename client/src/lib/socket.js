/**
 * Connexion temps réel + mémoire locale de la session.
 *
 * Le client garde `code` et `playerId` dans le localStorage : rafraîchir la page
 * ou fermer l'onglet par erreur ne fait pas perdre sa place.
 */
import { io } from 'socket.io-client';

const STORAGE_KEY = 'monopoly-paris:session';

export const socket = io({ autoConnect: true, transports: ['websocket', 'polling'] });

export function saveSession(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* navigation privée : on continue sans reprise automatique */
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* rien à nettoyer */
  }
}

/** Raccourci : envoyer une action de jeu au serveur. */
export function sendAction(action) {
  socket.emit('game:action', action);
}
