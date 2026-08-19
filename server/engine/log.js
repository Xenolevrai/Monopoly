/** Journal de partie : une phrase prête à afficher, dans la langue de la partie. */
import { rulesOf } from '../../shared/index.js';
import { msg } from '../../shared/messages.js';

/**
 * La phrase d'un événement, dans la langue de la partie. Le journal est rendu
 * au moment où l'événement se produit puis stocké tel quel : une partie reprise
 * des jours plus tard se relit exactement comme elle a été jouée.
 */
export function say(state, key, params = {}) {
  return msg(state.locale ?? 'fr', key, params);
}

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
  const locale = state.locale === 'en' ? 'en-GB' : 'fr-FR';
  return `${Math.round(amount).toLocaleString(locale)} ${currency.label}`;
}
