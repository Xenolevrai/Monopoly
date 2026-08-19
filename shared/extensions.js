/**
 * Les extensions : des modificateurs empilables, posés par-dessus une édition.
 *
 * Une édition est un plateau complet. Une extension n'en est pas un : c'est un
 * **delta** — quelles cases changent de nature, quels paquets sont retirés ou
 * ajoutés, quelles mécaniques s'activent — appliqué à l'édition choisie au
 * moment de créer la partie. On peut en activer zéro, une, ou plusieurs à la
 * fois (si elles ne se marchent pas dessus).
 *
 * Le principe qui compte : **le moteur ne connaît toujours aucune extension par
 * son nom.** Il continue de lire `edition.board`, `edition.cards`,
 * `edition.mechanics`, comme pour n'importe quelle édition — sauf que
 * l'édition qu'il lit est déjà fusionnée. Ajouter une extension, ce sera donc
 * ajouter une entrée à `EXTENSIONS`, jamais un `if` dans le moteur.
 */

/**
 * @typedef {Object} Extension
 * @property {string} id
 * @property {string} name
 * @property {string} [summary]        - une phrase, pour l'écran de sélection
 * @property {string[]} requires       - ce que l'édition doit posséder pour l'accueillir
 * @property {{position: number, changes: object}[]} [boardOverrides]
 * @property {string[]} [removesDecks]
 * @property {Record<string, object[]>} [addsDecks]
 * @property {Record<string, unknown>} [addsMechanics]
 * @property {number[]} [touchesPositions] - cases sur lesquelles elle agit, pour
 *   détecter les conflits entre deux extensions activées ensemble
 */

/** @type {Record<string, Extension>} */
export const EXTENSIONS = {
  // Remplies aux étapes suivantes : 'go-to-jail', 'free-parking-jackpot',
  // 'buy-everything'. Le registre reste vide tant qu'aucune n'est codée — c'est
  // ce qui permet de vérifier ici même, avant d'en coder une seule, que le
  // système de fusion ne change rien à une partie qui n'active rien.
};

/** Ce que chaque `requires` vérifie sur une édition donnée. */
const REQUIREMENT_CHECKS = {
  chanceDeck: (edition) => Boolean(edition.cards?.chance?.length),
  communityChestDeck: (edition) => Boolean(edition.cards?.community_chest?.length),
  taxSpaces: (edition) => edition.board.some((space) => space.type === 'tax'),
  jailSpace: (edition) => edition.board.some((space) => space.type === 'jail'),
  freeParkingSpace: (edition) => edition.board.some((space) => space.type === 'free_parking'),
  sequentialTurns: (edition) => edition.mechanics?.explorationMode !== true,
};

/** Une extension convient à une édition si celle-ci a tout ce qu'elle réclame. */
function isCompatible(edition, extension) {
  return (extension.requires ?? []).every((need) => REQUIREMENT_CHECKS[need]?.(edition) ?? false);
}

/** Les extensions du catalogue que cette édition peut accueillir. */
export function compatibleExtensions(edition) {
  return Object.values(EXTENSIONS).filter((ext) => isCompatible(edition, ext));
}

/**
 * Deux extensions activées ensemble ne doivent pas modifier la même case : on
 * ne devine pas de règle de priorité, on empêche la combinaison en amont, à la
 * sélection. Retourne la liste des cases où ça se chevauche (vide = aucun conflit).
 */
export function conflictingPositions(extensions) {
  const seen = new Map(); // position -> id de la première extension qui la touche
  const conflicts = new Set();
  for (const ext of extensions) {
    for (const position of ext.touchesPositions ?? []) {
      const owner = seen.get(position);
      if (owner && owner !== ext.id) conflicts.add(position);
      else seen.set(position, ext.id);
    }
  }
  return [...conflicts];
}

/** Applique une seule extension à une édition déjà résolue. */
function mergeOne(edition, extension) {
  let board = edition.board;
  for (const override of extension.boardOverrides ?? []) {
    board = board.map((space) =>
      space.id === override.position ? { ...space, ...override.changes } : space,
    );
  }

  const cards = { ...edition.cards };
  for (const deck of extension.removesDecks ?? []) delete cards[deck];
  for (const [deck, list] of Object.entries(extension.addsDecks ?? {})) cards[deck] = list;

  return {
    ...edition,
    board,
    cards,
    mechanics: { ...edition.mechanics, ...(extension.addsMechanics ?? {}) },
    // Trace de ce qui a été appliqué : utile à l'écran de règles et au débogage,
    // sans que le moteur n'ait besoin d'y regarder.
    activeExtensions: [...(edition.activeExtensions ?? []), extension.id],
  };
}

/**
 * Fusionne une édition avec les extensions actives d'une partie.
 *
 * Sans extension (le cas de toute partie créée avant l'existence de ce
 * système, et de toute partie qui n'en active aucune), retourne **la même
 * référence** que l'édition reçue : aucune copie, aucune allocation. C'est ce
 * qui garantit qu'activer ce système ne change rien à une partie existante —
 * et ce que `tests/extensions.test.js` vérifie.
 *
 * Un identifiant inconnu ou incompatible avec l'édition est silencieusement
 * ignoré : la validation d'avoir des combinaisons cohérentes se fait à la
 * création de la partie (écran de sélection), pas ici.
 */
export function applyExtensions(edition, extensionIds) {
  if (!extensionIds?.length) return edition;

  const active = extensionIds
    .map((id) => EXTENSIONS[id])
    .filter(Boolean)
    .filter((ext) => isCompatible(edition, ext));

  if (!active.length) return edition;

  return active.reduce(mergeOne, edition);
}
