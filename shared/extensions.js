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
 * @property {Record<string, object>} [addsGroups] - groupes ajoutés à `edition.groups`
 *   (une extension qui pose de nouveaux titres a besoin d'un groupe pour les porter)
 * @property {Record<string, unknown>} [addsMechanics]
 * @property {number[]} [touchesPositions] - cases sur lesquelles elle agit, pour
 *   détecter les conflits entre deux extensions activées ensemble
 * @property {Object} [jail]           - fusion superficielle sur `edition.jail` (caution, case…)
 * @property {Object} [dice]           - fusion superficielle sur `edition.dice` (doublesToJail…)
 * @property {Object} [houseRules]     - fusion superficielle sur `edition.houseRules`
 * @property {Record<string, object>} [deckTheming] - étiquettes/couleurs ajoutées à
 *   `edition.theming.decks` pour les nouveaux paquets (générique : le moteur ne lit jamais ceci,
 *   seul l'écran de règles/le thème client s'en sert)
 */

/** @type {Record<string, Extension>} */
export const EXTENSIONS = {
  'free-parking-jackpot': {
    id: 'free-parking-jackpot',
    name: 'Parc Gratuit Jackpot',
    summary:
      "Chance et Caisse de communauté deviennent des cases Spin ; les pénalités vont dans une cagnotte gagnée en tombant pile sur le Parc Gratuit.",
    requires: ['chanceDeck', 'communityChestDeck', 'freeParkingSpace', 'sequentialTurns'],
    // NB : les noms de case (« Chance », « Parc Gratuit »…) restent ceux de
    // l'édition de base — les renommer en « Spin »/« Jackpot » demanderait une
    // surcouche par langue que ce système de fusion ne porte pas encore
    // (`boardOverrides` s'applique après la traduction). Le paquet et son
    // thème (`deckTheming`) portent le nom Spin ; seule l'étiquette de la case
    // elle-même n'est pas encore renommée.
    boardOverrides: [
      { position: 2, changes: { type: 'spin' } },
      { position: 7, changes: { type: 'spin' } },
      { position: 17, changes: { type: 'spin' } },
      { position: 22, changes: { type: 'spin' } },
      { position: 33, changes: { type: 'spin' } },
      { position: 36, changes: { type: 'spin' } },
    ],
    removesDecks: ['chance', 'community_chest'],
    addsDecks: {
      spin: [
        // 4 secteurs rouges : payer un montant précis à la cagnotte plutôt qu'à la banque.
        { id: 'spin-red-01', text: 'Secteur rouge : versez 50 € à la cagnotte du Jackpot.', action: { type: 'pay_to_pot', amount: 50 } },
        { id: 'spin-red-02', text: 'Secteur rouge : versez 75 € à la cagnotte du Jackpot.', action: { type: 'pay_to_pot', amount: 75 } },
        { id: 'spin-red-03', text: 'Secteur rouge : versez 100 € à la cagnotte du Jackpot.', action: { type: 'pay_to_pot', amount: 100 } },
        { id: 'spin-red-04', text: 'Secteur rouge : versez 150 € à la cagnotte du Jackpot.', action: { type: 'pay_to_pot', amount: 150 } },
        // 3 secteurs verts : effet positif.
        { id: 'spin-green-01', text: 'Secteur vert : la banque vous verse 100 €.', action: { type: 'collect', amount: 100 } },
        { id: 'spin-green-02', text: 'Secteur vert : avancez de 3 cases.', action: { type: 'move_relative', offset: 3 } },
        { id: 'spin-green-03', text: 'Secteur vert : remportez la cagnotte du Jackpot.', action: { type: 'collect_from_pot' } },
        // 1 secteur « Jackpot ! » : toute la cagnotte, plus un bonus fixe (représente
        // l'achat gratuit d'une propriété libre au choix, simplifié en espèces).
        { id: 'spin-jackpot', text: 'JACKPOT ! Remportez toute la cagnotte, plus 200 € de bonus.', action: { type: 'jackpot', bonus: 200 } },
      ],
    },
    addsMechanics: { jackpotPot: true },
    houseRules: { freeParkingPot: true },
    deckTheming: { spin: { label: 'Spin', color: '#c9962c', glyph: '★' } },
    touchesPositions: [2, 7, 17, 20, 22, 33, 36],
  },

  'go-to-jail': {
    id: 'go-to-jail',
    name: 'Prison',
    summary:
      "Les deux cases taxes envoient en prison ; l'ancienne case « Allez en prison » devient une geôle plus sévère (Super Jail). Trois doubles n'envoient plus en prison.",
    // ⚠️ Détails relevés sur des sources secondaires (pas le livret Hasbro
    // officiel) : caution à 100 €, geôle « Super Jail » à la case 30 avec un
    // paquet Super Corruption, cases Chance/Caisse de communauté remplacées
    // par des tirages Évasion/Casse. À vérifier contre une boîte physique si
    // l'utilisateur en possède une — voir CLAUDE.md §10.
    requires: ['chanceDeck', 'communityChestDeck', 'taxSpaces', 'jailSpace', 'sequentialTurns'],
    boardOverrides: [
      { position: 4, changes: { type: 'go_to_jail' } },
      { position: 38, changes: { type: 'go_to_jail' } },
      { position: 30, changes: { type: 'super_jail' } },
      { position: 7, changes: { type: 'escape' } },
      { position: 22, changes: { type: 'escape' } },
      { position: 36, changes: { type: 'escape' } },
      { position: 2, changes: { type: 'heist' } },
      { position: 17, changes: { type: 'heist' } },
      { position: 33, changes: { type: 'heist' } },
    ],
    removesDecks: ['chance', 'community_chest'],
    addsDecks: {
      // Piochées en case « Évasion » : tenter d'échapper à une conséquence.
      escape: [
        { id: 'escape-01', text: 'Vous semez la police : rien à payer cette fois.', action: { type: 'collect', amount: 0 } },
        { id: 'escape-02', text: 'Fausse alerte : la banque vous verse 25 €.', action: { type: 'collect', amount: 25 } },
        { id: 'escape-03', text: 'Course-poursuite ratée : direction la prison.', action: { type: 'go_to_jail' } },
        { id: 'escape-04', text: 'Vous glissez une carte « libérée de prison » dans votre manche.', action: { type: 'get_out_of_jail_free' }, keepable: true },
        { id: 'escape-05', text: 'Amende pour excès de vitesse : payez 40 €.', action: { type: 'pay', amount: 40 } },
        { id: 'escape-06', text: 'Vous filez : avancez de 2 cases.', action: { type: 'move_relative', offset: 2 } },
      ],
      // Piochées en case « Casse » : voler de l'argent, à la banque ou à une autre joueuse.
      heist: [
        { id: 'heist-01', text: 'Casse réussie : la banque vous verse 75 €.', action: { type: 'collect', amount: 75 } },
        { id: 'heist-02', text: 'Casse ratée : payez 60 € de dommages.', action: { type: 'pay', amount: 60 } },
        { id: 'heist-03', text: 'Chacune des autres joueuses vous verse 20 €.', action: { type: 'collect_from_each', amount: 20 } },
        { id: 'heist-04', text: 'Vous êtes repérée : direction la prison.', action: { type: 'go_to_jail' } },
        { id: 'heist-05', text: 'Butin partagé : versez 25 € à chaque joueuse.', action: { type: 'pay_to_each', amount: 25 } },
        { id: 'heist-06', text: 'Casse discrète : la banque vous verse 50 €.', action: { type: 'collect', amount: 50 } },
      ],
      // Piochées en Jail, quand on choisit de rester plutôt que de payer 100 €.
      corruption: [
        { id: 'corruption-01', text: 'Vous graissez une patte : sortez de prison gratuitement.', action: { type: 'pay_bail' } },
        { id: 'corruption-02', text: 'Un gardien vous surveille de plus près : payez 30 € d’amende.', action: { type: 'pay', amount: 30 } },
        { id: 'corruption-03', text: 'Rien à signaler : vous restez en cellule.', action: { type: 'collect', amount: 0 } },
        { id: 'corruption-04', text: 'Un complice glisse 40 € sous la porte.', action: { type: 'collect', amount: 40 } },
      ],
      // Piochées en Super Jail : effets plus lourds, plus rares.
      super_corruption: [
        { id: 'super-corruption-01', text: 'Le juge est clément : sortez de prison gratuitement.', action: { type: 'pay_bail' } },
        { id: 'super-corruption-02', text: 'Fouille de cellule : payez 100 € d’amende.', action: { type: 'pay', amount: 100 } },
        { id: 'super-corruption-03', text: 'Isolement : rien ne se passe, vous restez enfermée.', action: { type: 'collect', amount: 0 } },
        { id: 'super-corruption-04', text: 'Un ancien complice vous fait parvenir 80 €.', action: { type: 'collect', amount: 80 } },
      ],
    },
    addsMechanics: { doublesNeverJail: true },
    jail: { bail: 100, deck: 'corruption', superSpace: 30, superBail: 200, superDeck: 'super_corruption' },
    deckTheming: {
      escape: { label: 'Évasion', color: '#3d7a4f', glyph: '⚡' },
      heist: { label: 'Casse', color: '#5a3d7a', glyph: '⛓' },
      corruption: { label: 'Corruption', color: '#7a3d3d', glyph: '⚖' },
      super_corruption: { label: 'Super Corruption', color: '#4a1414', glyph: '⚖' },
    },
    touchesPositions: [2, 4, 7, 17, 22, 30, 33, 36, 38],
  },

  'buy-everything': {
    id: 'buy-everything',
    name: 'Tout Acheter',
    summary:
      "Départ, Prison et Parc Gratuit deviennent achetables ; un dé d'Achat donne accès au coffre des cartes Vente, et une case dépassée part aux enchères.",
    // ⚠️ Comme l'extension Prison, les chiffres (prix des titres spéciaux,
    // faces du dé d'Achat, effets des cartes Vente) viennent de sources
    // secondaires et non du livret Hasbro : ils sont cohérents entre eux et
    // équilibrés pour jouer, mais méritent une relecture contre la boîte
    // physique. Voir CLAUDE.md §10.
    requires: ['goSpace', 'jailSpace', 'freeParkingSpace', 'sequentialTurns', 'fortySpaceBoard'],
    // Trois titres de propriété là où il n'y en avait pas. La « Banque » de la
    // boîte physique n'est pas une case du plateau mais un présentoir central :
    // notre modèle n'ayant que 40 cases, elle n'est pas représentée — les trois
    // coins achetables suffisent à porter la mécanique.
    boardOverrides: [
      // `icon` garde le pictogramme d'origine : devenue achetable, la case reste
      // reconnaissable comme Départ, Prison ou Parc Gratuit.
      { position: 0, changes: { type: 'landmark', group: 'landmark', price: 400, rent: [75], mortgage: 200, icon: 'arrow' } },
      { position: 10, changes: { type: 'landmark', group: 'landmark', price: 300, rent: [50], mortgage: 150, icon: 'bars' } },
      { position: 20, changes: { type: 'landmark', group: 'landmark', price: 350, rent: [60], mortgage: 175, icon: 'car' } },
    ],
    addsGroups: {
      landmark: {
        id: 'landmark',
        label: 'Titres spéciaux',
        color: '#b08d3f',
        size: 3,
        spaces: [0, 10, 20],
      },
    },
    addsDecks: {
      // Le coffre des ventes. Trois cartes restent visibles ; on les gagne au dé
      // d'Achat. Rouge = pouvoir à usage unique, jaune = revenu permanent,
      // verte = condition de victoire immédiate.
      sale: [
        { id: 'sale-red-01', color: 'red', text: 'Coup de chance : la banque vous verse 200 €.', action: { type: 'collect', amount: 200 } },
        { id: 'sale-red-02', color: 'red', text: 'Racket : chaque adversaire vous verse 50 €.', action: { type: 'collect_from_each', amount: 50 } },
        { id: 'sale-red-03', color: 'red', text: 'Passe-droit : gardez une carte « libérée de prison ».', action: { type: 'get_out_of_jail_free' } },
        { id: 'sale-red-04', color: 'red', text: 'Raccourci : avancez de 5 cases.', action: { type: 'move_relative', offset: 5 } },
        { id: 'sale-red-05', color: 'red', text: 'Liquidation : la banque vous verse 150 €.', action: { type: 'collect', amount: 150 } },
        { id: 'sale-yellow-01', color: 'yellow', text: 'Rente foncière : touchez 50 € au début de chacun de vos tours.', perTurn: { type: 'collect', amount: 50 } },
        { id: 'sale-yellow-02', color: 'yellow', text: 'Péage privé : touchez 30 € au début de chacun de vos tours.', perTurn: { type: 'collect', amount: 30 } },
        { id: 'sale-yellow-03', color: 'yellow', text: 'Dividendes : touchez 40 € au début de chacun de vos tours.', perTurn: { type: 'collect', amount: 40 } },
        { id: 'sale-green-01', color: 'green', text: 'Objectif : réunir 2 500 € en liquide. Vous gagnez sur-le-champ.', victory: { type: 'cash_at_least', amount: 2500 } },
        { id: 'sale-green-02', color: 'green', text: 'Objectif : détenir 10 titres de propriété. Vous gagnez sur-le-champ.', victory: { type: 'own_at_least', count: 10 } },
        { id: 'sale-green-03', color: 'green', text: 'Objectif : bâtir 8 constructions. Vous gagnez sur-le-champ.', victory: { type: 'buildings_at_least', count: 8 } },
      ],
    },
    addsMechanics: {
      saleVault: { deck: 'sale', visible: 3 },
      // Le dé d'Achat, facultatif, lancé une fois par tour après la case résolue.
      buyDie: { sides: 6, gainFrom: 5, stealOn: 1 },
      auctionOnPass: true,
      saleVictory: true,
    },
    deckTheming: { sale: { label: 'Vente', color: '#3c6e9f', glyph: '§' } },
    touchesPositions: [0, 10, 20],
  },
};

/** Ce que chaque `requires` vérifie sur une édition donnée. */
const REQUIREMENT_CHECKS = {
  chanceDeck: (edition) => Boolean(edition.cards?.chance?.length),
  communityChestDeck: (edition) => Boolean(edition.cards?.community_chest?.length),
  taxSpaces: (edition) => edition.board.some((space) => space.type === 'tax'),
  jailSpace: (edition) => edition.board.some((space) => space.type === 'jail'),
  freeParkingSpace: (edition) => edition.board.some((space) => space.type === 'free_parking'),
  goSpace: (edition) => edition.board.some((space) => space.type === 'go'),
  // Les titres supplémentaires sont posés à des positions fixes du plateau
  // classique 40 cases : une édition plus courte ne peut pas les accueillir.
  fortySpaceBoard: (edition) => edition.board.length === 40,
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
    groups: { ...edition.groups, ...(extension.addsGroups ?? {}) },
    mechanics: { ...edition.mechanics, ...(extension.addsMechanics ?? {}) },
    jail: { ...edition.jail, ...(extension.jail ?? {}) },
    dice: { ...edition.dice, ...(extension.dice ?? {}) },
    houseRules: { ...edition.houseRules, ...(extension.houseRules ?? {}) },
    theming: {
      ...edition.theming,
      decks: { ...edition.theming?.decks, ...(extension.deckTheming ?? {}) },
    },
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
