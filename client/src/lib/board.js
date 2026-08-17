/**
 * Données du plateau côté client et placement dans la grille 11 × 11.
 *
 * Le plateau est importé directement depuis `shared/` : le client et le serveur
 * lisent exactement les mêmes prix et les mêmes loyers.
 */
import board from '../../../shared/data/board.json';
import groups from '../../../shared/data/groups.json';

export { board, groups };

export const SIZE = 11;

/**
 * Position d'une case dans la grille CSS.
 * Départ en bas à droite, on tourne dans le sens du jeu (sens anti-horaire).
 * @returns {{ col: number, row: number, side: string }}
 */
export function gridPosition(id) {
  if (id <= 10) return { col: SIZE - id, row: SIZE, side: 'bottom' };
  if (id <= 20) return { col: 1, row: SIZE - (id - 10), side: 'left' };
  if (id <= 30) return { col: 1 + (id - 20), row: 1, side: 'top' };
  return { col: SIZE, row: 1 + (id - 30), side: 'right' };
}

/** Couleur du groupe d'une case, ou null. */
export function groupColor(space) {
  return space.group ? groups[space.group]?.color ?? null : null;
}

/** Les cases achetables d'une joueuse, regroupées par couleur. */
export function propertiesByGroup(state, playerId) {
  const owned = Object.values(state.properties ?? {}).filter((p) => p.ownerId === playerId);
  const byGroup = new Map();
  for (const prop of owned) {
    const space = board[prop.spaceId];
    const list = byGroup.get(space.group) ?? [];
    list.push({ ...prop, space });
    byGroup.set(space.group, list);
  }
  // Ordre du plateau, pour que l'affichage soit stable.
  return [...byGroup.entries()]
    .sort((a, b) => groups[a[0]].spaces[0] - groups[b[0]].spaces[0])
    .map(([groupId, items]) => ({
      group: groups[groupId],
      items: items.sort((a, b) => a.spaceId - b.spaceId),
      complete: groups[groupId].spaces.every((id) => state.properties[id].ownerId === playerId),
    }));
}

/** Formate un montant : 1 500 €. */
export function euros(amount) {
  return `${Math.round(amount ?? 0).toLocaleString('fr-FR')} €`;
}

/** Nom court d'une case, pour les listes serrées. */
export function shortName(spaceId) {
  return board[spaceId]?.shortName ?? '';
}
