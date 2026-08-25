/**
 * Les quatre niveaux, en chiffres.
 *
 * Un principe : **un seul cerveau, quatre réglages**. Il n'y a pas de code
 * « facile » et de code « expert » — ce serait quatre fois plus à maintenir et
 * à corriger. Toute la différence tient dans ces nombres, plus deux leviers
 * d'imperfection (`noise`, `blunderRate`) qui font qu'un bot faible se trompe
 * comme se trompe une joueuse débutante : il voit la bonne action et en joue
 * une autre.
 *
 * Ces valeurs ne sont pas inventées : elles sortent de `scripts/train-bots.mjs`,
 * qui fait s'affronter les profils sur des milliers de parties et retient les
 * réglages qui creusent l'écart entre les niveaux. Relancer l'entraînement
 * après avoir touché à l'évaluation.
 */

/** Les leviers, avec ce qu'ils veulent dire — pour pouvoir les régler à la main. */
export const PARAMETERS = {
  yieldToPrice: 'convertit un gain par tour de plateau en valeur d\'actif',
  completesGroup: 'multiplicateur du terrain qui ferme un groupe',
  nearlyGroup: 'multiplicateur du terrain qui met à un du groupe',
  deadGroup: 'multiplicateur d\'un groupe que personne ne peut plus compléter',
  blockRival: 'valeur accordée au fait de priver une adversaire de son groupe',
  cashReserve: 'combien de fois son exposition au loyer on garde en liquide',
  buildTarget: 'niveau de construction visé (3 maisons = le palier rentable)',
  mortgagePenalty: 'pénalité de score par hypothèque dormante',
  bidCeiling: 'part de la valeur estimée qu\'on accepte de mettre aux enchères',
  tradeMargin: 'gain de score minimal exigé pour accepter un échange',
  proposesTrades: 'propose des échanges de lui-même',
  noise: 'bruit relatif sur les évaluations (imprécision de jugement)',
  blunderRate: 'probabilité de jouer un coup franchement moins bon',
};

/**
 * @typedef {Object} BotProfile
 * @property {string} id
 * @property {string} label
 */

/** @type {Record<string, BotProfile>} */
export const PROFILES = {
  facile: {
    id: 'facile',
    label: 'Facile',
    summary: 'Achète ce qui passe, ne voit pas les groupes, accepte presque tout.',
    // Ne convertit presque pas le rendement en valeur : il regarde le prix
    // affiché, comme une débutante.
    yieldToPrice: 30,
    completesGroup: 1.15,
    nearlyGroup: 1.0,
    deadGroup: 1.0,
    blockRival: 0,
    cashReserve: 0.5,
    buildTarget: 2,
    mortgagePenalty: 0,
    bidCeiling: 0.75,
    tradeMargin: -0.25, // accepte des échanges qui le desservent
    proposesTrades: false,
    noise: 0.55,
    blunderRate: 0.22,
  },

  moyen: {
    id: 'moyen',
    label: 'Moyen',
    summary: 'Comprend les groupes, garde un peu de liquide, échange sans finesse.',
    yieldToPrice: 55,
    completesGroup: 1.7,
    nearlyGroup: 1.25,
    deadGroup: 0.85,
    blockRival: 0.25,
    cashReserve: 1.2,
    buildTarget: 3,
    mortgagePenalty: 0.15,
    bidCeiling: 0.95,
    tradeMargin: 0.02,
    proposesTrades: true,
    noise: 0.25,
    blunderRate: 0.07,
  },

  difficile: {
    id: 'difficile',
    label: 'Difficile',
    summary: 'Vise les groupes rentables, bloque, garde de quoi encaisser, négocie.',
    // Également réglé par auto-jeu (16 rondes de 40 parties). Il apprend la
    // même leçon que l'expert sur le rendement, mais reste volontairement plus
    // tiède sur le blocage : c'est ce qui laisse un écart entre les deux.
    yieldToPrice: 97,
    completesGroup: 2.59,
    nearlyGroup: 2.34,
    deadGroup: 0.7,
    blockRival: 0.62,
    cashReserve: 1.8,
    buildTarget: 3,
    mortgagePenalty: 0.31,
    bidCeiling: 1.05,
    tradeMargin: 0.06,
    proposesTrades: true,
    noise: 0.08,
    blunderRate: 0.015,
  },

  expert: {
    id: 'expert',
    label: 'Expert',
    summary: "Joue les probabilités du plateau, bloque sans pitié, ne se trompe pas.",
    // Réglages issus de `scripts/tune-bots.mjs`, deux campagnes successives
    // (22 rondes de 44 parties, puis 14 rondes de 40, 5 améliorations de plus).
    // La leçon que la mesure répète, et qui va contre l'intuition : **le
    // rendement locatif pèse bien plus que le prix affiché**. `yieldToPrice`
    // est passé de 90 à 169 à la première campagne, puis à 218 à la seconde —
    // à chaque fois le réglage qui a rapporté le plus. Autre acquis : priver
    // une adversaire de son groupe vaut plus cher que de compléter le sien
    // (`blockRival` 0,95 → 1,24).
    yieldToPrice: 217.951,
    completesGroup: 2.74,
    nearlyGroup: 2.508,
    deadGroup: 0.58,
    blockRival: 1.238,
    cashReserve: 2.0,
    buildTarget: 3,
    mortgagePenalty: 0.425,
    bidCeiling: 1.2,
    tradeMargin: 0.08,
    proposesTrades: true,
    noise: 0,
    blunderRate: 0,
  },
};

export const DIFFICULTIES = Object.keys(PROFILES);
export const DEFAULT_DIFFICULTY = 'moyen';

/**
 * Le profil demandé, ou le niveau moyen si l'identifiant est inconnu.
 *
 * Accepte aussi un profil déjà constitué : c'est ce qui permet à
 * `scripts/tune-bots.mjs` de faire jouer une variante qui n'existe pas encore
 * dans le catalogue, sans dupliquer le cerveau pour l'occasion.
 */
export function profileOf(difficulty) {
  if (difficulty && typeof difficulty === 'object') return difficulty;
  return PROFILES[difficulty] ?? PROFILES[DEFAULT_DIFFICULTY];
}
