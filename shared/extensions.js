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

/**
 * Les 8 secteurs de la roulette Parc Gratuit Jackpot (Hasbro G0718).
 * 4 secteurs rouges (pénalités vers la cagnotte) et 4 secteurs verts (gains).
 */
export const FREE_PARKING_SPINNER_SECTORS = [
  { id: 'red-50', color: 'red', type: 'pay_to_pot', amount: 50, labelFr: '-50 €', labelEn: '-50' },
  { id: 'green-free-house', color: 'green', type: 'free_house', labelFr: 'Maison offerte', labelEn: 'Free House' },
  { id: 'red-100', color: 'red', type: 'pay_to_pot', amount: 100, labelFr: '-100 €', labelEn: '-100' },
  { id: 'green-jackpot', color: 'green', type: 'jackpot', labelFr: 'JACKPOT !', labelEn: 'JACKPOT!' },
  { id: 'red-150', color: 'red', type: 'pay_to_pot', amount: 150, labelFr: '-150 €', labelEn: '-150' },
  { id: 'green-deal-mobile', color: 'green', type: 'deal_mobile', labelFr: 'Deal Mobile', labelEn: 'Deal Mobile' },
  { id: 'red-200', color: 'red', type: 'pay_to_pot', amount: 200, labelFr: '-200 €', labelEn: '-200' },
  { id: 'green-buy-any', color: 'green', type: 'buy_any_1', labelFr: 'Titre au choix', labelEn: 'Buy Any 1' },
];

/** Les 32 cartes physiques du paquet Free Parking Bonus Cards. */
export const FREE_PARKING_BONUS_CARDS = [
  // Upgrade! (3 cartes)
  { id: 'fp-upgrade-01', title: 'Surclassement !', text: 'Prenez le Deal Mobile immédiatement. Toute propriété libre où vous atterrissez est gratuite, et vous ne payez aucun loyer !', action: { type: 'deal_mobile' } },
  { id: 'fp-upgrade-02', title: 'Surclassement !', text: 'Prenez le Deal Mobile immédiatement. Toute propriété libre où vous atterrissez est gratuite, et vous ne payez aucun loyer !', action: { type: 'deal_mobile' } },
  { id: 'fp-upgrade-03', title: 'Surclassement !', text: 'Prenez le Deal Mobile immédiatement. Toute propriété libre où vous atterrissez est gratuite, et vous ne payez aucun loyer !', action: { type: 'deal_mobile' } },

  // Take a shortcut! (5 cartes)
  { id: 'fp-shortcut-01', title: 'Prendre un raccourci !', text: 'Déplacez-vous sur n’importe quelle propriété. Si elle est libre, vous pouvez l’acheter. Si vous passez par Départ, touchez 200 €.', action: { type: 'shortcut' } },
  { id: 'fp-shortcut-02', title: 'Prendre un raccourci !', text: 'Déplacez-vous sur n’importe quelle propriété. Si elle est libre, vous pouvez l’acheter. Si vous passez par Départ, touchez 200 €.', action: { type: 'shortcut' } },
  { id: 'fp-shortcut-03', title: 'Prendre un raccourci !', text: 'Déplacez-vous sur n’importe quelle propriété. Si elle est libre, vous pouvez l’acheter. Si vous passez par Départ, touchez 200 €.', action: { type: 'shortcut' } },
  { id: 'fp-shortcut-04', title: 'Prendre un raccourci !', text: 'Déplacez-vous sur n’importe quelle propriété. Si elle est libre, vous pouvez l’acheter. Si vous passez par Départ, touchez 200 €.', action: { type: 'shortcut' } },
  { id: 'fp-shortcut-05', title: 'Prendre un raccourci !', text: 'Déplacez-vous sur n’importe quelle propriété. Si elle est libre, vous pouvez l’acheter. Si vous passez par Départ, touchez 200 €.', action: { type: 'shortcut' } },

  // Hit the brakes! (2 cartes)
  { id: 'fp-brakes-01', title: 'Coup de frein !', text: 'Annule la carte Bonus d’une autre joueuse. Peut être jouée hors de votre tour.', action: { type: 'cancel_bonus' } },
  { id: 'fp-brakes-02', title: 'Coup de frein !', text: 'Annule la carte Bonus d’une autre joueuse. Peut être jouée hors de votre tour.', action: { type: 'cancel_bonus' } },

  // VrrrrrOOOOM! (2 cartes)
  { id: 'fp-vroom-01', title: 'VrrrrrOOOOM !', text: 'Ajoutez 1 à votre déplacement de dés.', action: { type: 'modify_roll', offset: 1 } },
  { id: 'fp-vroom-02', title: 'VrrrrrOOOOM !', text: 'Ajoutez 1 à votre déplacement de dés.', action: { type: 'modify_roll', offset: 1 } },

  // Put it in reverse! (2 cartes)
  { id: 'fp-reverse-01', title: 'Marche arrière !', text: 'Retranchez 1 à votre déplacement de dés.', action: { type: 'modify_roll', offset: -1 } },
  { id: 'fp-reverse-02', title: 'Marche arrière !', text: 'Retranchez 1 à votre déplacement de dés.', action: { type: 'modify_roll', offset: -1 } },

  // Green light! (2 cartes)
  { id: 'fp-greenlight-01', title: 'Feu vert !', text: 'Lorsque vous tombez sur un secteur rouge, vous pouvez déplacer l’aiguille sur l’un des secteurs verts adjacents.', action: { type: 'green_light' } },
  { id: 'fp-greenlight-02', title: 'Feu vert !', text: 'Lorsque vous tombez sur un secteur rouge, vous pouvez déplacer l’aiguille sur l’un des secteurs verts adjacents.', action: { type: 'green_light' } },

  // Take two! (2 cartes)
  { id: 'fp-taketwo-01', title: 'Coup double !', text: 'Lorsque vous achetez une propriété, vous pouvez également acheter la prochaine propriété libre du plateau.', action: { type: 'take_two' } },
  { id: 'fp-taketwo-02', title: 'Coup double !', text: 'Lorsque vous achetez une propriété, vous pouvez également acheter la prochaine propriété libre du plateau.', action: { type: 'take_two' } },

  // Spin it! (2 cartes)
  { id: 'fp-spin-01', title: 'Tournez !', text: 'Tournez la roulette du Parc Gratuit ! Vous ne dépensez pas de jeton Spin.', action: { type: 'spin_it' } },
  { id: 'fp-spin-02', title: 'Tournez !', text: 'Tournez la roulette du Parc Gratuit ! Vous ne dépensez pas de jeton Spin.', action: { type: 'spin_it' } },

  // JACKPOT! (2 cartes)
  { id: 'fp-jackpot-01', title: 'JACKPOT !', text: 'Remportez la totalité de la cagnotte du Jackpot du Parc Gratuit !', action: { type: 'collect_jackpot' } },
  { id: 'fp-jackpot-02', title: 'JACKPOT !', text: 'Remportez la totalité de la cagnotte du Jackpot du Parc Gratuit !', action: { type: 'collect_jackpot' } },

  // Free House! (2 cartes)
  { id: 'fp-freehouse-01', title: 'Maison offerte !', text: 'Construisez gratuitement une maison sur n’importe quelle propriété que vous possédez, même si le groupe n’est pas complet.', action: { type: 'free_house' } },
  { id: 'fp-freehouse-02', title: 'Maison offerte !', text: 'Construisez gratuitement une maison sur n’importe quelle propriété que vous possédez, même si le groupe n’est pas complet.', action: { type: 'free_house' } },

  // Free property! (2 cartes)
  { id: 'fp-freeprop-01', title: 'Titre gratuit !', text: 'Prenez gratuitement n’importe quel titre de propriété encore libre sur le plateau !', action: { type: 'free_property' } },
  { id: 'fp-freeprop-02', title: 'Titre gratuit !', text: 'Prenez gratuitement n’importe quel titre de propriété encore libre sur le plateau !', action: { type: 'free_property' } },

  // Go green! (2 cartes)
  { id: 'fp-gogreen-01', title: 'Plein vert !', text: 'Lorsque vous tombez sur un secteur vert, déplacez l’aiguille sur n’importe quel autre secteur vert.', action: { type: 'go_green' } },
  { id: 'fp-gogreen-02', title: 'Plein vert !', text: 'Lorsque vous tombez sur un secteur vert, déplacez l’aiguille sur n’importe quel autre secteur vert.', action: { type: 'go_green' } },

  // Do-over! (2 cartes)
  { id: 'fp-doover-01', title: 'On rejoue !', text: 'Relancez la roulette du Parc Gratuit.', action: { type: 'do_over' } },
  { id: 'fp-doover-02', title: 'On rejoue !', text: 'Relancez la roulette du Parc Gratuit.', action: { type: 'do_over' } },

  // Trade in! (2 cartes)
  { id: 'fp-tradein-01', title: 'Reprise !', text: 'Échangez une propriété que vous possédez contre n’importe quelle propriété encore libre.', action: { type: 'trade_in' } },
  { id: 'fp-tradein-02', title: 'Reprise !', text: 'Échangez une propriété que vous possédez contre n’importe quelle propriété encore libre.', action: { type: 'trade_in' } },
];

export const ESCAPE_DIE_FACES = [
  { id: 'escape-card-1a', type: 'cards', count: 1, labelFr: '+1 Carte', labelEn: '+1 Card', isGreen: true },
  { id: 'escape-card-1b', type: 'cards', count: 1, labelFr: '+1 Carte', labelEn: '+1 Card', isGreen: true },
  { id: 'escape-card-2', type: 'cards', count: 2, labelFr: '+2 Cartes', labelEn: '+2 Cards', isGreen: true },
  { id: 'escape-card-3', type: 'cards', count: 3, labelFr: '+3 Cartes', labelEn: '+3 Cards', isGreen: true },
  { id: 'escape-police-1', type: 'go_to_jail', labelFr: 'Police !', labelEn: 'Police!', isPolice: true },
  { id: 'escape-police-2', type: 'go_to_jail', labelFr: 'Police !', labelEn: 'Police!', isPolice: true },
];

export const HEIST_DIE_FACES = [
  { id: 'heist-cash-50', type: 'cash', amount: 50, labelFr: '+50 €', labelEn: '+$50', isCash: true },
  { id: 'heist-cash-100', type: 'cash', amount: 100, labelFr: '+100 €', labelEn: '+$100', isCash: true },
  { id: 'heist-cash-150', type: 'cash', amount: 150, labelFr: '+150 €', labelEn: '+$150', isCash: true },
  { id: 'heist-cash-200', type: 'cash', amount: 200, labelFr: '+200 €', labelEn: '+$200', isCash: true },
  { id: 'heist-police-1', type: 'go_to_jail', labelFr: 'Police !', labelEn: 'Police!', isPolice: true },
  { id: 'heist-police-2', type: 'go_to_jail', labelFr: 'Police !', labelEn: 'Police!', isPolice: true },
];

export const CORRUPTION_CARDS = [
  // Trespass (x4)
  { id: 'corr-trespass-01', type: 'trespass', title: 'Violation de propriété', text: 'À utiliser à la place de votre lancer de dés. Avancez jusqu’à la prochaine propriété libre (vous pouvez l’acheter). Si vous passez par la case Départ, recevez 200 €.', action: { type: 'trespass' } },
  { id: 'corr-trespass-02', type: 'trespass', title: 'Violation de propriété', text: 'À utiliser à la place de votre lancer de dés. Avancez jusqu’à la prochaine propriété libre (vous pouvez l’acheter). Si vous passez par la case Départ, recevez 200 €.', action: { type: 'trespass' } },
  { id: 'corr-trespass-03', type: 'trespass', title: 'Violation de propriété', text: 'À utiliser à la place de votre lancer de dés. Avancez jusqu’à la prochaine propriété libre (vous pouvez l’acheter). Si vous passez par la case Départ, recevez 200 €.', action: { type: 'trespass' } },
  { id: 'corr-trespass-04', type: 'trespass', title: 'Violation de propriété', text: 'À utiliser à la place de votre lancer de dés. Avancez jusqu’à la prochaine propriété libre (vous pouvez l’acheter). Si vous passez par la case Départ, recevez 200 €.', action: { type: 'trespass' } },

  // Framed (x2)
  { id: 'corr-framed-01', type: 'framed', title: 'Piégé !', text: 'À utiliser au moment où vous seriez envoyé en Prison ou en Super Prison. Envoyez une autre joueuse à votre place.', action: { type: 'framed' }, reaction: true },
  { id: 'corr-framed-02', type: 'framed', title: 'Piégé !', text: 'À utiliser au moment où vous seriez envoyé en Prison ou en Super Prison. Envoyez une autre joueuse à votre place.', action: { type: 'framed' }, reaction: true },

  // Loan Shark (x1)
  { id: 'corr-loanshark-01', type: 'loan_shark', title: 'Usurier', text: 'Jouez cette carte lorsqu’une autre joueuse quitte la Prison ou la Super Prison. Elle doit vous verser 150 € (en plus de sa caution).', action: { type: 'loan_shark' }, reaction: true },

  // Pickpocket (x2)
  { id: 'corr-pickpocket-01', type: 'pickpocket', title: 'Pickpocket', text: 'Chaque autre joueuse tend son argent. Tirez un billet au hasard dans la main de chaque joueuse.', action: { type: 'pickpocket' } },
  { id: 'corr-pickpocket-02', type: 'pickpocket', title: 'Pickpocket', text: 'Chaque autre joueuse tend son argent. Tirez un billet au hasard dans la main de chaque joueuse.', action: { type: 'pickpocket' } },

  // Petty Theft (x1)
  { id: 'corr-pettytheft-01', type: 'petty_theft', title: 'Larcin', text: 'Jouez lorsqu’une autre joueuse achète une propriété. Volez-la immédiatement.', action: { type: 'petty_theft' }, reaction: true },

  // Bank Fraud (x1)
  { id: 'corr-bankfraud-01', type: 'bank_fraud', title: 'Fraude bancaire', text: 'Achetez n’importe quelle propriété possédée pour la moitié de son prix d’achat imprimé. La propriété ne doit pas faire partie d’un groupe complet.', action: { type: 'bank_fraud' } },

  // Creative Zoning (x2)
  { id: 'corr-zoning-01', type: 'creative_zoning', title: 'Zonage créatif', text: 'Construisez jusqu’à deux maisons gratuites sur une propriété que vous possédez, même sans groupe complet.', action: { type: 'creative_zoning' } },
  { id: 'corr-zoning-02', type: 'creative_zoning', title: 'Zonage créatif', text: 'Construisez jusqu’à deux maisons gratuites sur une propriété que vous possédez, même sans groupe complet.', action: { type: 'creative_zoning' } },

  // Money Laundering (x2)
  { id: 'corr-laundering-01', type: 'money_laundering', title: 'Blanchiment d’argent', text: 'Achetez n’importe quelle propriété libre pour seulement 50 €.', action: { type: 'money_laundering' } },
  { id: 'corr-laundering-02', type: 'money_laundering', title: 'Blanchiment d’argent', text: 'Achetez n’importe quelle propriété libre pour seulement 50 €.', action: { type: 'money_laundering' } },

  // On the lam (x3)
  { id: 'corr-onthelam-01', type: 'on_the_lam', title: 'En cavale', text: 'À utiliser à la place de votre lancer de dés. Déplacez-vous sur n’importe quelle case et appliquez sa règle. Si vous passez par Départ, recevez 200 €.', action: { type: 'on_the_lam' } },
  { id: 'corr-onthelam-02', type: 'on_the_lam', title: 'En cavale', text: 'À utiliser à la place de votre lancer de dés. Déplacez-vous sur n’importe quelle case et appliquez sa règle. Si vous passez par Départ, recevez 200 €.', action: { type: 'on_the_lam' } },
  { id: 'corr-onthelam-03', type: 'on_the_lam', title: 'En cavale', text: 'À utiliser à la place de votre lancer de dés. Déplacez-vous sur n’importe quelle case et appliquez sa règle. Si vous passez par Départ, recevez 200 €.', action: { type: 'on_the_lam' } },

  // Bribe (x2)
  { id: 'corr-bribe-01', type: 'bribe', title: 'Pot-de-vin', text: 'Chaque joueuse vous verse 10 € pour chaque propriété que vous possédez.', action: { type: 'bribe' } },
  { id: 'corr-bribe-02', type: 'bribe', title: 'Pot-de-vin', text: 'Chaque joueuse vous verse 10 € pour chaque propriété que vous possédez.', action: { type: 'bribe' } },

  // Citizen's Arrest (x2)
  { id: 'corr-arrest-01', type: 'citizens_arrest', title: 'Arrestation citoyenne', text: 'Jouez lorsqu’une autre joueuse joue une carte Corruption pour annuler son effet ET l’envoyer en Super Prison.', action: { type: 'citizens_arrest' }, reaction: true },
  { id: 'corr-arrest-02', type: 'citizens_arrest', title: 'Arrestation citoyenne', text: 'Jouez lorsqu’une autre joueuse joue une carte Corruption pour annuler son effet ET l’envoyer en Super Prison.', action: { type: 'citizens_arrest' }, reaction: true },

  // Evict THAT (x1)
  { id: 'corr-evict-01', type: 'evict_that', title: 'Expulsez-MOI ÇA !', text: 'À utiliser au moment où vous devriez un loyer. Ne payez rien et envoyez la propriétaire en Super Prison.', action: { type: 'evict_that' }, reaction: true },

  // Bait & Switch (x2)
  { id: 'corr-baitswitch-01', type: 'bait_switch', title: 'Ruse de vente', text: 'Échangez l’une de vos propriétés contre la propriété de votre choix appartenant à une autre joueuse (hors groupe complet).', action: { type: 'bait_switch' } },
  { id: 'corr-baitswitch-02', type: 'bait_switch', title: 'Ruse de vente', text: 'Échangez l’une de vos propriétés contre la propriété de votre choix appartenant à une autre joueuse (hors groupe complet).', action: { type: 'bait_switch' } },

  // Rent Hike (x1)
  { id: 'corr-renthike-01', type: 'rent_hike', title: 'Hausse de loyer', text: 'À utiliser au moment de réclamer un loyer pour en doubler le montant.', action: { type: 'rent_hike' }, reaction: true },

  // Swindle (x1)
  { id: 'corr-swindle-01', type: 'swindle', title: 'Arnaque', text: 'Échangez l’une de vos propriétés contre n’importe quelle propriété encore libre.', action: { type: 'swindle' } },

  // Insider Trading (x1)
  { id: 'corr-insidertrading-01', type: 'insider_trading', title: 'Délit d’initié', text: 'Échangez deux de vos propriétés contre deux propriétés au choix d’une autre joueuse (hors groupe complet).', action: { type: 'insider_trading' } },

  // Train Heist (x1)
  { id: 'corr-trainheist-01', type: 'train_heist', title: 'Attaque de train', text: 'À utiliser à la place de votre lancer de dés. Avancez jusqu’à la prochaine gare. Si libre, prenez-la gratuitement. Si possédée, la propriétaire vous verse le loyer ! Si passage par Départ, recevez 200 €.', action: { type: 'train_heist' } },

  // Stick Up (x2)
  { id: 'corr-stickup-01', type: 'stick_up', title: 'Braquage', text: 'À utiliser lorsque vous devez un loyer à une autre joueuse : elle vous verse le loyer à la place !', action: { type: 'stick_up' }, reaction: true },
  { id: 'corr-stickup-02', type: 'stick_up', title: 'Braquage', text: 'À utiliser lorsque vous devez un loyer à une autre joueuse : elle vous verse le loyer à la place !', action: { type: 'stick_up' }, reaction: true },

  // Snitch (x1)
  { id: 'corr-snitch-01', type: 'snitch', title: 'Balance', text: 'Envoyez une autre joueuse en Super Prison.', action: { type: 'snitch' } },
];

export const SUPER_CORRUPTION_CARDS = [
  // Auction Hoax (x1)
  { id: 'scorr-auctionhoax-01', type: 'auction_hoax', title: 'Canular aux enchères', text: 'Prenez n’importe quelle propriété libre ET recevez sa valeur d’achat en argent de la Banque.', action: { type: 'auction_hoax' } },

  // Identity Theft (x1)
  { id: 'scorr-identitytheft-01', type: 'identity_theft', title: 'Usurpation d’identité', text: 'Échangez l’intégralité de votre argent liquide avec celui d’une autre joueuse.', action: { type: 'identity_theft' } },

  // Good Ol'-Fashioned Scam (x1)
  { id: 'scorr-goodolscam-01', type: 'good_ol_scam', title: 'Arnaque à l’ancienne', text: 'Achetez une propriété à une autre joueuse pour seulement 1 €. La propriété ne doit pas faire partie d’un groupe complet.', action: { type: 'good_ol_scam' } },

  // Caper (x1)
  { id: 'scorr-caper-01', type: 'caper', title: 'Casse du siècle', text: 'Prenez 100 € à chaque joueuse. Celles qui ne paient pas sont envoyées en Super Prison.', action: { type: 'caper' } },

  // Blackmail (x1)
  { id: 'scorr-blackmail-01', type: 'blackmail', title: 'Chantage', text: 'Volez 50 € à chaque joueuse OU volez 150 € à une joueuse de votre choix.', action: { type: 'blackmail' } },

  // Shoplift (x2)
  { id: 'scorr-shoplift-01', type: 'shoplift', title: 'Vol à l’étalage', text: 'Toutes les autres joueuses montrent leurs cartes Corruption. Volez-en une au hasard dans la main de chaque joueuse.', action: { type: 'shoplift' } },
  { id: 'scorr-shoplift-02', type: 'shoplift', title: 'Vol à l’étalage', text: 'Toutes les autres joueuses montrent leurs cartes Corruption. Volez-en une au hasard dans la main de chaque joueuse.', action: { type: 'shoplift' } },

  // Greasy Palms (x1)
  { id: 'scorr-greasypalms-01', type: 'greasy_palms', title: 'Mains graissées', text: 'Achetez un groupe de propriétés complet à une autre joueuse pour 500 €.', action: { type: 'greasy_palms' } },

  // Obstructing Injustice (x1)
  { id: 'scorr-obstructing-01', type: 'obstructing_injustice', title: 'Obstruction à l’injustice', text: 'Jouez lorsqu’une autre joueuse joue une carte Corruption ou Super Corruption pour annuler son effet.', action: { type: 'obstructing_injustice' }, reaction: true },

  // Robbery (x1)
  { id: 'scorr-robbery-01', type: 'robbery', title: 'Pillage de cellules', text: 'Volez une propriété à chaque joueuse actuellement en Prison ou en Super Prison.', action: { type: 'robbery' } },

  // Long Con (x1)
  { id: 'scorr-longcon-01', type: 'long_con', title: 'Gros coup', text: 'Construisez un hôtel gratuit sur n’importe quelle propriété que vous possédez, même sans maison et sans groupe complet.', action: { type: 'long_con' } },

  // Cook the Books (x1)
  { id: 'scorr-cookbooks-01', type: 'cook_the_books', title: 'Falsification de comptes', text: 'Échangez 1 € de votre liquide contre 500 € de la Banque.', action: { type: 'cook_the_books' } },

  // Forgery (x1)
  { id: 'scorr-forgery-01', type: 'forgery', title: 'Faux en écriture', text: 'Jouez cette carte pour voler une propriété à une autre joueuse.', action: { type: 'forgery' } },
];

export const BUY_DIE_FACES = [
  { id: 'buy-card-1', type: 'buy_card', labelFr: 'Acheter', labelEn: 'Buy Card', icon: 'arrow', color: '#16a34a' },
  { id: 'buy-card-2', type: 'buy_card', labelFr: 'Acheter', labelEn: 'Buy Card', icon: 'arrow', color: '#16a34a' },
  { id: 'buy-card-3', type: 'buy_card', labelFr: 'Acheter', labelEn: 'Buy Card', icon: 'arrow', color: '#16a34a' },
  { id: 'force-discard-1', type: 'force_discard', labelFr: 'Défausse', labelEn: 'Discard', icon: 'x', color: '#dc2626' },
  { id: 'force-discard-2', type: 'force_discard', labelFr: 'Défausse', labelEn: 'Discard', icon: 'x', color: '#dc2626' },
  { id: 'refresh-vault-1', type: 'refresh_vault', labelFr: 'Renouveler', labelEn: 'Refresh', icon: 'recycle', color: '#ca8a04' },
];

export const SALE_CARDS = [
  // — Cartes à usage unique (Gris / Argent) —————————————————
  {
    id: 'sale-windfall-01',
    cardType: 'single_use',
    color: 'grey',
    price: 150,
    title: 'Coup de chance',
    text: 'La Banque vous verse 300 €.',
    action: { type: 'collect', amount: 300 },
  },
  {
    id: 'sale-extortion-01',
    cardType: 'single_use',
    color: 'grey',
    price: 200,
    title: 'Racket',
    text: 'Chaque autre joueuse vous verse 75 €.',
    action: { type: 'collect_from_each', amount: 75 },
  },
  {
    id: 'sale-jailpass-01',
    cardType: 'single_use',
    color: 'grey',
    price: 100,
    title: 'Passe-droit',
    text: 'Conservez cette carte comme carte « Libérée de prison ».',
    action: { type: 'get_out_of_jail_free' },
  },
  {
    id: 'sale-teleport-01',
    cardType: 'single_use',
    color: 'grey',
    price: 200,
    title: 'Téléportation',
    text: 'Avancez sur n’importe quelle case du plateau et appliquez ses règles.',
    action: { type: 'teleport' },
  },
  {
    id: 'sale-swap-01',
    cardType: 'single_use',
    color: 'grey',
    price: 250,
    title: 'Échange forcé',
    text: 'Échangez une de vos propriétés contre une propriété adverse hors groupe complet.',
    action: { type: 'swap_property' },
  },
  {
    id: 'sale-discount-01',
    cardType: 'single_use',
    color: 'grey',
    price: 100,
    title: 'Rabais bancaire',
    text: 'Achetez votre prochaine propriété avec 50 % de réduction.',
    action: { type: 'discount_property' },
  },
  {
    id: 'sale-shield-01',
    cardType: 'single_use',
    color: 'grey',
    price: 150,
    title: 'Immunité',
    text: 'Annulez le prochain loyer ou la prochaine taxe que vous devez.',
    action: { type: 'shield' },
  },
  {
    id: 'sale-double-01',
    cardType: 'single_use',
    color: 'grey',
    price: 150,
    title: 'Double loyer',
    text: 'Doublez le prochain loyer que vous encaissez auprès d’une joueuse.',
    action: { type: 'double_rent' },
  },

  // — Pouvoirs Permanents (Jaune / Or) ——————————————————————
  {
    id: 'sale-bank-01',
    cardType: 'ability',
    color: 'yellow',
    price: 350,
    title: 'La Banque',
    text: 'Vous possédez la Banque ! Tous vos paiements sont réglés avec l’argent de la Banque. Vos gains vont dans votre trésorerie personnelle.',
    ability: { type: 'the_bank' },
  },
  {
    id: 'sale-revenue-01',
    cardType: 'ability',
    color: 'yellow',
    price: 200,
    title: 'Rente foncière',
    text: 'Touchez 50 € de la Banque au début de chacun de vos tours.',
    ability: { type: 'per_turn_cash', amount: 50 },
  },
  {
    id: 'sale-dividends-01',
    cardType: 'ability',
    color: 'yellow',
    price: 150,
    title: 'Dividendes',
    text: 'Touchez 30 € de la Banque au début de chacun de vos tours.',
    ability: { type: 'per_turn_cash', amount: 30 },
  },
  {
    id: 'sale-toll-01',
    cardType: 'ability',
    color: 'yellow',
    price: 200,
    title: 'Péage privé',
    text: 'Chaque adversaire qui passe par la case Départ vous verse 25 €.',
    ability: { type: 'go_toll', amount: 25 },
  },
  {
    id: 'sale-architect-01',
    cardType: 'ability',
    color: 'yellow',
    price: 250,
    title: 'Maître d’œuvre',
    text: 'Toutes vos constructions de maisons et d’hôtels coûtent 50 % de moins.',
    ability: { type: 'half_price_build' },
  },
  {
    id: 'sale-landlord-01',
    cardType: 'ability',
    color: 'yellow',
    price: 200,
    title: 'Super Propriétaire',
    text: 'Ajoutez 50 € à tous les loyers que vous encaissez.',
    ability: { type: 'rent_boost', amount: 50 },
  },

  // — Victoire Immédiate (Vert) ————————————————————————————
  {
    id: 'sale-cash-01',
    cardType: 'instant_win',
    color: 'green',
    price: 300,
    title: 'Objectif Fortune',
    text: 'Réunissez 2 500 € en liquide. Vous gagnez la partie sur-le-champ !',
    victory: { type: 'cash_at_least', amount: 2500 },
  },
  {
    id: 'sale-properties-01',
    cardType: 'instant_win',
    color: 'green',
    price: 300,
    title: 'Objectif Monopole',
    text: 'Détenez au moins 10 titres de propriété. Vous gagnez sur-le-champ !',
    victory: { type: 'own_at_least', count: 10 },
  },
  {
    id: 'sale-buildings-01',
    cardType: 'instant_win',
    color: 'green',
    price: 300,
    title: 'Objectif Urbanisme',
    text: 'Bâtissez au moins 8 constructions. Vous gagnez sur-le-champ !',
    victory: { type: 'buildings_at_least', count: 8 },
  },
  {
    id: 'sale-railroads-01',
    cardType: 'instant_win',
    color: 'green',
    price: 300,
    title: 'Objectif Gares',
    text: 'Possédez les 4 gares du plateau. Vous gagnez sur-le-champ !',
    victory: { type: 'own_all_railroads' },
  },
  {
    id: 'sale-corners-01',
    cardType: 'instant_win',
    color: 'green',
    price: 300,
    title: 'Objectif Quatre Coins',
    text: 'Possédez au moins 3 des 4 cases Coins (Départ, Prison, Parc Gratuit, Allez en prison). Vous gagnez sur-le-champ !',
    victory: { type: 'own_corners_at_least', count: 3 },
  },
  {
    id: 'sale-palace-01',
    cardType: 'instant_win',
    color: 'green',
    price: 300,
    title: 'Objectif Palace',
    text: 'Bâtissez un Hôtel sur la Rue de la Paix (case 39). Vous gagnez sur-le-champ !',
    victory: { type: 'hotel_on_space', spaceId: 39 },
  },
];

/** @type {Record<string, Extension>} */
export const EXTENSIONS = {
  'free-parking-jackpot': {
    id: 'free-parking-jackpot',
    name: 'Parc Gratuit Jackpot',
    summary:
      'Chance et Caisse de communauté deviennent des cases Spin ; tous les paiements vers la banque vont au Jackpot. Prenez le Deal Mobile et jouez des cartes Bonus !',
    requires: ['chanceDeck', 'communityChestDeck', 'freeParkingSpace', 'sequentialTurns'],
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
      free_parking_bonus: FREE_PARKING_BONUS_CARDS,
    },
    addsMechanics: {
      jackpotPot: true,
      dealMobile: true,
      spinChips: true,
      rentChoiceChip: true,
      spinOnOwn: true,
      startSpinChips: 2,
      startBonusCards: 2,
      bonusCardsDeck: 'free_parking_bonus',
      spinnerSectors: FREE_PARKING_SPINNER_SECTORS,
      winCondition: 'allOwnedOrBankruptcy',
    },
    houseRules: { freeParkingPot: true },
    deckTheming: { free_parking_bonus: { label: 'Bonus Parc Gratuit', color: '#c93b2c', glyph: '★' } },
    touchesPositions: [2, 7, 17, 20, 22, 33, 36],
    locales: {
      en: {
        name: 'Free Parking Jackpot',
        summary:
          'Chance and Community Chest become Spin spaces; all money paid to the bank goes to the Jackpot. Win the Deal Mobile and play Bonus cards!',
        deckTheming: { free_parking_bonus: { label: 'Free Parking Bonus', color: '#c93b2c', glyph: '★' } },
        cardTitles: {
          'fp-upgrade-01': 'Upgrade!',
          'fp-upgrade-02': 'Upgrade!',
          'fp-upgrade-03': 'Upgrade!',
          'fp-shortcut-01': 'Take a shortcut!',
          'fp-shortcut-02': 'Take a shortcut!',
          'fp-shortcut-03': 'Take a shortcut!',
          'fp-shortcut-04': 'Take a shortcut!',
          'fp-shortcut-05': 'Take a shortcut!',
          'fp-brakes-01': 'Hit the brakes!',
          'fp-brakes-02': 'Hit the brakes!',
          'fp-vroom-01': 'VrrrrrOO0OM!',
          'fp-vroom-02': 'VrrrrrOO0OM!',
          'fp-reverse-01': 'Put it in reverse!',
          'fp-reverse-02': 'Put it in reverse!',
          'fp-greenlight-01': 'Green light!',
          'fp-greenlight-02': 'Green light!',
          'fp-taketwo-01': 'Take two!',
          'fp-taketwo-02': 'Take two!',
          'fp-spin-01': 'Spin it!',
          'fp-spin-02': 'Spin it!',
          'fp-jackpot-01': 'JACKPOT!',
          'fp-jackpot-02': 'JACKPOT!',
          'fp-freehouse-01': 'Free House!',
          'fp-freehouse-02': 'Free House!',
          'fp-freeprop-01': 'Free property!',
          'fp-freeprop-02': 'Free property!',
          'fp-gogreen-01': 'Go green!',
          'fp-gogreen-02': 'Go green!',
          'fp-doover-01': 'Do-over!',
          'fp-doover-02': 'Do-over!',
          'fp-tradein-01': 'Trade in!',
          'fp-tradein-02': 'Trade in!',
        },
        cards: {
          'fp-upgrade-01': "Swap your token for the Deal Mobile immediately. Any unowned property you land on is free, and you don't have to pay rent!",
          'fp-upgrade-02': "Swap your token for the Deal Mobile immediately. Any unowned property you land on is free, and you don't have to pay rent!",
          'fp-upgrade-03': "Swap your token for the Deal Mobile immediately. Any unowned property you land on is free, and you don't have to pay rent!",
          'fp-shortcut-01': 'Move to any property. If unowned, you may buy it. If you pass GO, collect 200.',
          'fp-shortcut-02': 'Move to any property. If unowned, you may buy it. If you pass GO, collect 200.',
          'fp-shortcut-03': 'Move to any property. If unowned, you may buy it. If you pass GO, collect 200.',
          'fp-shortcut-04': 'Move to any property. If unowned, you may buy it. If you pass GO, collect 200.',
          'fp-shortcut-05': 'Move to any property. If unowned, you may buy it. If you pass GO, collect 200.',
          'fp-brakes-01': 'Stop another player’s Bonus card. May be played out of turn.',
          'fp-brakes-02': 'Stop another player’s Bonus card. May be played out of turn.',
          'fp-vroom-01': 'Add 1 to your movement.',
          'fp-vroom-02': 'Add 1 to your movement.',
          'fp-reverse-01': 'Subtract 1 from your movement.',
          'fp-reverse-02': 'Subtract 1 from your movement.',
          'fp-greenlight-01': 'When you spin a red, you may move the spinner to one of the green spaces next to it instead.',
          'fp-greenlight-02': 'When you spin a red, you may move the spinner to one of the green spaces next to it instead.',
          'fp-taketwo-01': 'When you buy a property, you may also buy the next unowned property.',
          'fp-taketwo-02': 'When you buy a property, you may also buy the next unowned property.',
          'fp-spin-01': 'Spin the Free Parking spinner! You don’t have to spend a Spin chip.',
          'fp-spin-02': 'Spin the Free Parking spinner! You don’t have to spend a Spin chip.',
          'fp-jackpot-01': 'Collect the entire Free Parking Jackpot!',
          'fp-jackpot-02': 'Collect the entire Free Parking Jackpot!',
          'fp-freehouse-01': 'Build a House for free on any property you own, even if it is not part of a complete set.',
          'fp-freehouse-02': 'Build a House for free on any property you own, even if it is not part of a complete set.',
          'fp-freeprop-01': 'Take any one unowned property for free!',
          'fp-freeprop-02': 'Take any one unowned property for free!',
          'fp-gogreen-01': 'When you spin a green, you may move the spinner to any other green space instead.',
          'fp-gogreen-02': 'When you spin a green, you may move the spinner to any other green space instead.',
          'fp-doover-01': 'Re-spin the spinner.',
          'fp-doover-02': 'Re-spin the spinner.',
          'fp-tradein-01': 'Swap a property you own with any unowned property.',
          'fp-tradein-02': 'Swap a property you own with any unowned property.',
        },
      },
    },
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
      { position: 7, changes: { type: 'escape_die' } },
      { position: 22, changes: { type: 'escape_die' } },
      { position: 36, changes: { type: 'escape_die' } },
      { position: 2, changes: { type: 'heist_die' } },
      { position: 17, changes: { type: 'heist_die' } },
      { position: 33, changes: { type: 'heist_die' } },
    ],
    removesDecks: ['chance', 'community_chest'],
    addsDecks: {
      corruption: CORRUPTION_CARDS,
      super_corruption: SUPER_CORRUPTION_CARDS,
    },
    addsMechanics: {
      corruptionCards: true,
      superCorruptionCards: true,
      escapeDie: true,
      heistDie: true,
      superJail: true,
      jailPassBonus: true,
      jailTurnBonus: true,
      superJailTurnBonus: true,
      noDoublesOut: true,
      startCorruptionCards: 2,
      jailBail: 100,
      superJailBailCash: 300,
      disqualifyInJailAtEnd: true,
      winCondition: 'allOwnedOrBankruptcy',
    },
    jail: { bail: 100, deck: 'corruption', superSpace: 30, superBail: 200, superDeck: 'super_corruption' },
    deckTheming: {
      corruption: { label: 'Corruption', color: '#c2410c', glyph: '⚖' },
      super_corruption: { label: 'Super Corruption', color: '#1e3a8a', glyph: '⚡' },
    },
    touchesPositions: [2, 4, 7, 17, 22, 30, 33, 36, 38],
    locales: {
      en: {
        name: 'Go to Jail',
        summary:
          'Tax spaces send you to Jail; the old Go to Jail space becomes Super Jail. Roll Escape and Heist dice, and unleash Corruption cards!',
        deckTheming: {
          corruption: { label: 'Corruption', color: '#c2410c', glyph: '⚖' },
          super_corruption: { label: 'Super Corruption', color: '#1e3a8a', glyph: '⚡' },
        },
        cardTitles: {
          'corr-trespass-01': 'Trespass',
          'corr-trespass-02': 'Trespass',
          'corr-trespass-03': 'Trespass',
          'corr-trespass-04': 'Trespass',
          'corr-framed-01': 'Framed',
          'corr-framed-02': 'Framed',
          'corr-loanshark-01': 'Loan Shark',
          'corr-pickpocket-01': 'Pickpocket',
          'corr-pickpocket-02': 'Pickpocket',
          'corr-pettytheft-01': 'Petty Theft',
          'corr-bankfraud-01': 'Bank Fraud',
          'corr-zoning-01': 'Creative Zoning',
          'corr-zoning-02': 'Creative Zoning',
          'corr-laundering-01': 'Money Laundering',
          'corr-laundering-02': 'Money Laundering',
          'corr-onthelam-01': 'On the lam',
          'corr-onthelam-02': 'On the lam',
          'corr-onthelam-03': 'On the lam',
          'corr-bribe-01': 'Bribe',
          'corr-bribe-02': 'Bribe',
          'corr-arrest-01': "Citizen's Arrest",
          'corr-arrest-02': "Citizen's Arrest",
          'corr-evict-01': 'Evict THAT',
          'corr-baitswitch-01': 'Bait & Switch',
          'corr-baitswitch-02': 'Bait & Switch',
          'corr-renthike-01': 'Rent Hike',
          'corr-swindle-01': 'Swindle',
          'corr-insidertrading-01': 'Insider Trading',
          'corr-trainheist-01': 'Train Heist',
          'corr-stickup-01': 'Stick Up',
          'corr-stickup-02': 'Stick Up',
          'corr-snitch-01': 'Snitch',
          'scorr-auctionhoax-01': 'Auction Hoax',
          'scorr-identitytheft-01': 'Identity Theft',
          'scorr-goodolscam-01': "Good Ol'-Fashioned Scam",
          'scorr-caper-01': 'Caper',
          'scorr-blackmail-01': 'Blackmail',
          'scorr-shoplift-01': 'Shoplift',
          'scorr-shoplift-02': 'Shoplift',
          'scorr-greasypalms-01': 'Greasy Palms',
          'scorr-obstructing-01': 'Obstructing Injustice',
          'scorr-robbery-01': 'Robbery',
          'scorr-longcon-01': 'Long Con',
          'scorr-cookbooks-01': 'Cook the Books',
          'scorr-forgery-01': 'Forgery',
        },
        cards: {
          'corr-trespass-01': 'Use in place of your roll. Move to the next unowned property. You may buy it. If you pass GO, collect 200.',
          'corr-trespass-02': 'Use in place of your roll. Move to the next unowned property. You may buy it. If you pass GO, collect 200.',
          'corr-trespass-03': 'Use in place of your roll. Move to the next unowned property. You may buy it. If you pass GO, collect 200.',
          'corr-trespass-04': 'Use in place of your roll. Move to the next unowned property. You may buy it. If you pass GO, collect 200.',
          'corr-framed-01': 'Use when you would be sent to Jail or Super Jail. Send another player there in your place.',
          'corr-framed-02': 'Use when you would be sent to Jail or Super Jail. Send another player there in your place.',
          'corr-loanshark-01': 'Play this card when another player leaves Jail or Super Jail. They must pay you 150. They must still pay their fee to get out.',
          'corr-pickpocket-01': 'All other players hold up their cash. Draw a bill at random from each player’s hand.',
          'corr-pickpocket-02': 'All other players hold up their cash. Draw a bill at random from each player’s hand.',
          'corr-pettytheft-01': 'Play when another player buys a property. Steal it immediately.',
          'corr-bankfraud-01': 'Buy any owned property for 1/2 the purchase price. The property may not be part of a complete set.',
          'corr-zoning-01': 'Build up to two free houses on one property, even without a complete set.',
          'corr-zoning-02': 'Build up to two free houses on one property, even without a complete set.',
          'corr-laundering-01': 'Buy any one unowned property for 50.',
          'corr-laundering-02': 'Buy any one unowned property for 50.',
          'corr-onthelam-01': 'Use in place of your roll. Move to any space, then follow the rules of that space. If you pass GO, collect 200.',
          'corr-onthelam-02': 'Use in place of your roll. Move to any space, then follow the rules of that space. If you pass GO, collect 200.',
          'corr-onthelam-03': 'Use in place of your roll. Move to any space, then follow the rules of that space. If you pass GO, collect 200.',
          'corr-bribe-01': 'All players pay you 10 for each property you own.',
          'corr-bribe-02': 'All players pay you 10 for each property you own.',
          'corr-arrest-01': 'Play when another player plays a Corruption card to cancel the effect of their Corruption card AND send them to Super Jail.',
          'corr-arrest-02': 'Play when another player plays a Corruption card to cancel the effect of their Corruption card AND send them to Super Jail.',
          'corr-evict-01': 'Use when you would owe rent. Pay nothing and send the property owner to Super Jail.',
          'corr-baitswitch-01': 'Swap any one of your properties with your choice of one of another player’s properties. The property may not be part of a complete set.',
          'corr-baitswitch-02': 'Swap any one of your properties with your choice of one of another player’s properties. The property may not be part of a complete set.',
          'corr-renthike-01': 'Use when charging rent to double the rent.',
          'corr-swindle-01': 'Swap any one of your properties with any one unowned property.',
          'corr-insidertrading-01': 'Swap two of your properties with your choice of two of another player’s properties. The properties may not be part of a complete set.',
          'corr-trainheist-01': 'Use in place of your roll. Move to the next railroad. If unowned, get it for free. If owned, the owner pays you rent instead. If you pass GO, collect 200.',
          'corr-stickup-01': 'Use when you owe another player rent. They pay you rent instead!',
          'corr-stickup-02': 'Use when you owe another player rent. They pay you rent instead!',
          'corr-snitch-01': 'Send another player to Super Jail.',
          'scorr-auctionhoax-01': 'Take any one unowned property AND its purchase value from the Bank.',
          'scorr-identitytheft-01': 'Swap your entire cash pile with another player’s cash pile.',
          'scorr-goodolscam-01': 'Buy a property from another player for 1. The property may not be part of a complete set.',
          'scorr-caper-01': 'Take 100 from each player. If they don’t pay up, send them to Super Jail.',
          'scorr-blackmail-01': 'Steal 50 from each player or steal 150 from one player.',
          'scorr-shoplift-01': 'All other players hold up their Corruption Cards. Steal one at random from each player’s hand.',
          'scorr-shoplift-02': 'All other players hold up their Corruption Cards. Steal one at random from each player’s hand.',
          'scorr-greasypalms-01': 'Buy a complete property set from another player for 500.',
          'scorr-obstructing-01': 'Play when another player plays a Corruption card or Super Corruption card to cancel its effect.',
          'scorr-robbery-01': 'Steal one property from each player currently in Jail or Super Jail.',
          'scorr-longcon-01': 'Build a free Hotel on any one property, even without a complete set or any Houses.',
          'scorr-cookbooks-01': 'Swap 1 from your cash with 500 from the Bank.',
          'scorr-forgery-01': 'Play card to steal one property from another player.',
        },
      },
    },
  },

  'buy-everything': {
    id: 'buy-everything',
    name: 'Tout Acheter',
    summary:
      "Tout est à vendre ! Départ, Prison, Parc Gratuit, Taxes deviennent achetables. Lancez le dé d'Achat, achetez des pouvoirs au Coffre-Fort et tentez la victoire immédiate !",
    requires: ['goSpace', 'jailSpace', 'freeParkingSpace', 'sequentialTurns', 'fortySpaceBoard'],
    boardOverrides: [
      { position: 0, changes: { type: 'landmark', group: 'corners', price: 400, rent: [50, 100, 200, 400], mortgage: 0, icon: 'arrow' } },
      { position: 10, changes: { type: 'landmark', group: 'corners', price: 300, rent: [50, 100, 200, 400], mortgage: 0, icon: 'bars' } },
      { position: 20, changes: { type: 'landmark', group: 'corners', price: 350, rent: [50, 100, 200, 400], mortgage: 0, icon: 'car' } },
      { position: 30, changes: { type: 'landmark', group: 'corners', price: 300, rent: [50, 100, 200, 400], mortgage: 0, icon: 'police' } },
      { position: 4, changes: { type: 'landmark', group: 'special_taxes', price: 200, rent: [100], mortgage: 0, icon: 'diamond' } },
      { position: 38, changes: { type: 'landmark', group: 'special_taxes', price: 150, rent: [100], mortgage: 0, icon: 'ring' } },
    ],
    addsGroups: {
      corners: {
        id: 'corners',
        label: 'Coins',
        color: '#b08d3f',
        size: 4,
        spaces: [0, 10, 20, 30],
      },
      special_taxes: {
        id: 'special_taxes',
        label: 'Taxes',
        color: '#64748b',
        size: 2,
        spaces: [4, 38],
      },
    },
    addsDecks: {
      sale: SALE_CARDS,
    },
    addsMechanics: {
      saleVault: { deck: 'sale', visible: 3, maxHand: 3 },
      buyDie: true,
      startingCash: 2150,
      saleVictory: true,
      noMortgageSpecialDeeds: true,
      winCondition: 'allOwnedOrBankruptcy',
    },
    deckTheming: { sale: { label: 'Vente', color: '#15803d', glyph: '🗄' } },
    touchesPositions: [0, 4, 10, 20, 30, 38],
    locales: {
      en: {
        name: 'Buy Everything',
        summary:
          'Everything is for sale! GO, Jail, Free Parking, Taxes can all be owned. Roll the Buy Die, buy abilities from the Sale Vault and win instantly!',
        deckTheming: { sale: { label: 'Sale', color: '#15803d', glyph: '🗄' } },
        cardTitles: {
          'sale-windfall-01': 'Windfall',
          'sale-extortion-01': 'Extortion',
          'sale-jailpass-01': 'Jail Pass',
          'sale-teleport-01': 'Teleport',
          'sale-swap-01': 'Forced Swap',
          'sale-discount-01': 'Bank Discount',
          'sale-shield-01': 'Immunity Shield',
          'sale-double-01': 'Double Rent',
          'sale-bank-01': 'The Bank',
          'sale-revenue-01': 'Land Revenue',
          'sale-dividends-01': 'Dividends',
          'sale-toll-01': 'Toll Booth',
          'sale-architect-01': 'Master Builder',
          'sale-landlord-01': 'Super Landlord',
          'sale-cash-01': 'Fortune Goal',
          'sale-properties-01': 'Empire Goal',
          'sale-buildings-01': 'Urban Goal',
          'sale-railroads-01': 'Railroads Goal',
          'sale-corners-01': 'Four Corners Goal',
          'sale-palace-01': 'Palace Goal',
        },
        cards: {
          'sale-windfall-01': 'The Bank pays you $300.',
          'sale-extortion-01': 'Every other player pays you $75.',
          'sale-jailpass-01': 'Keep this card as a Get Out of Jail Free card.',
          'sale-teleport-01': 'Move to any space on the board and follow its rules.',
          'sale-swap-01': 'Swap 1 of your properties with 1 property from another player (outside complete sets).',
          'sale-discount-01': 'Buy your next property at 50% discount.',
          'sale-shield-01': 'Cancel the next rent or tax you owe.',
          'sale-double-01': 'Double the next rent you collect from a player.',
          'sale-bank-01': 'You own the Bank! Pay using Bank money. Keep all income in your personal cash pile.',
          'sale-revenue-01': 'Collect $50 from the Bank at the start of each of your turns.',
          'sale-dividends-01': 'Collect $30 from the Bank at the start of each of your turns.',
          'sale-toll-01': 'Each opponent passing GO pays you $25.',
          'sale-architect-01': 'All your house and hotel builds cost 50% less.',
          'sale-landlord-01': 'Add $50 to all rents you collect.',
          'sale-cash-01': 'Reach $2,500 in cash. You win the game immediately!',
          'sale-properties-01': 'Own at least 10 properties. You win the game immediately!',
          'sale-buildings-01': 'Build at least 8 houses/hotels. You win the game immediately!',
          'sale-railroads-01': 'Own all 4 railroads. You win the game immediately!',
          'sale-corners-01': 'Own at least 3 of the 4 corner spaces (GO, Jail, Free Parking, Go to Jail). You win immediately!',
          'sale-palace-01': 'Build a Hotel on Boardwalk (or Rue de la Paix). You win immediately!',
        },
      },
    },
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
export function compatibleExtensions(edition, locale = 'fr') {
  return Object.values(EXTENSIONS)
    .filter((ext) => isCompatible(edition, ext))
    .map((ext) => {
      if (locale === 'en' && ext.locales?.en) {
        return {
          ...ext,
          name: ext.locales.en.name ?? ext.name,
          summary: ext.locales.en.summary ?? ext.summary,
        };
      }
      return ext;
    });
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
function mergeOne(edition, extension, locale = 'fr') {
  let board = edition.board;
  for (const override of extension.boardOverrides ?? []) {
    board = board.map((space) =>
      space.id === override.position ? { ...space, ...override.changes } : space,
    );
  }

  const langPack = locale !== 'fr' ? extension.locales?.[locale] : null;

  const cards = { ...edition.cards };
  for (const deck of extension.removesDecks ?? []) delete cards[deck];
  for (const [deck, list] of Object.entries(extension.addsDecks ?? {})) {
    cards[deck] = list.map((card) => {
      if (langPack?.cards?.[card.id]) {
        return {
          ...card,
          text: langPack.cards[card.id],
          title: langPack.cardTitles?.[card.id] ?? card.title,
        };
      }
      return card;
    });
  }

  const deckTheming = { ...(extension.deckTheming ?? {}) };
  if (langPack?.deckTheming) {
    for (const [deck, theme] of Object.entries(langPack.deckTheming)) {
      deckTheming[deck] = { ...deckTheming[deck], ...theme };
    }
  }

  return {
    ...edition,
    winCondition: extension.winCondition ?? extension.addsMechanics?.winCondition ?? edition.winCondition,
    board,
    cards,
    groups: { ...edition.groups, ...(extension.addsGroups ?? {}) },
    mechanics: { ...edition.mechanics, ...(extension.addsMechanics ?? {}) },
    jail: { ...edition.jail, ...(extension.jail ?? {}) },
    dice: { ...edition.dice, ...(extension.dice ?? {}) },
    houseRules: { ...edition.houseRules, ...(extension.houseRules ?? {}) },
    theming: {
      ...edition.theming,
      decks: { ...(edition.theming?.decks ?? {}), ...deckTheming },
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
export function applyExtensions(edition, extensionIds, locale = null) {
  if (!extensionIds?.length) return edition;
  const lang = locale ?? edition?.locale ?? 'fr';

  const active = extensionIds
    .map((id) => EXTENSIONS[id])
    .filter(Boolean)
    .filter((ext) => isCompatible(edition, ext));

  if (!active.length) return edition;

  return active.reduce((acc, ext) => mergeOne(acc, ext, lang), edition);
}
