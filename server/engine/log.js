/** Journal de partie : une phrase française prête à afficher + les données brutes. */
import { rulesOf } from '../../shared/index.js';

/**
 * L'identifiant vient d'un compteur porté par la partie elle-même, pas du
 * processus serveur : un redémarrage (mise à jour, reprise d'une partie
 * sauvegardée un autre jour) ne doit jamais réutiliser un identifiant déjà
 * présent dans le journal, sous peine de collision de clé React qui fige
 * l'affichage jusqu'au rechargement complet de la page.
 */
export function log(state, type, text, data = {}) {
  state.logSeq = (state.logSeq ?? 0) + 1;
  const entry = { id: `e${state.logSeq}`, at: Date.now(), type, text, data };
  state.log.push(entry);
  if (state.log.length > 500) state.log.splice(0, state.log.length - 500);
  return entry;
}

/**
 * Formate un montant dans la monnaie de l'édition : 1 500 €, 310 pts, 200 M$…
 * Le journal doit parler la langue de la boîte qu'on a sortie.
 */
export function amountText(state, amount) {
  const currency = rulesOf(state).currency;
  return `${Math.round(amount).toLocaleString('fr-FR')} ${currency.label}`;
}
