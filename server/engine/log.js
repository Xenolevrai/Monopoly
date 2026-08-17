/** Journal de partie : une phrase française prête à afficher + les données brutes. */
let counter = 0;

export function log(state, type, text, data = {}) {
  const entry = { id: `e${++counter}`, at: Date.now(), type, text, data };
  state.log.push(entry);
  if (state.log.length > 500) state.log.splice(0, state.log.length - 500);
  return entry;
}

/** Formate un montant à la française : 1 500 €. */
export function euros(amount) {
  return `${Math.round(amount).toLocaleString('fr-FR')} €`;
}
