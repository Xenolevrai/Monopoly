/**
 * Les phrases du journal de partie, en français et en anglais.
 *
 * Le journal est écrit par le moteur, donc côté serveur : c'est ici qu'il
 * apprend à parler les deux langues. Chaque entrée est une fonction des données
 * de l'événement, ce qui garde les accords et les tournures naturels — on ne
 * recolle pas des morceaux de phrase.
 *
 * Le texte est rendu au moment où l'événement se produit, dans la langue de la
 * partie, puis stocké tel quel : une partie sauvegardée se relit exactement
 * comme elle a été jouée.
 */

const FR = {
  joins: ({ name }) => `${name} rejoint la partie.`,
  joinsSwapped: ({ name, token }) =>
    `${name} rejoint la partie — le pion demandé était pris, elle joue « ${token} ».`,
  starts: ({ name }) => `${name} lance la partie.`,
  orderRoll: ({ name, total }) => `${name} fait ${total} au tirage de l'ordre de jeu.`,
  turnOrder: ({ names }) => `Ordre de jeu : ${names}.`,
  turnOf: ({ name }) => `C'est au tour de ${name}.`,
  rolls: ({ name, values, total, isDouble }) =>
    `${name} fait ${values} (${total})${isDouble ? ' — double !' : ''}.`,
  playsAgain: ({ name }) => `${name} rejoue (double).`,
  lands: ({ name, space }) => `${name} arrive sur ${space}.`,

  buys: ({ name, space, amount }) => `${name} achète ${space} pour ${amount}.`,
  explores: ({ name, space, amount }) => `${name} explore ${space} pour ${amount}.`,
  homeFree: ({ name, space }) => `${name} est chez elle : ${space} lui revient sans rien payer.`,
  declines: ({ name }) => `${name} renonce à acheter cette propriété.`,

  rentDue: ({ name, amount, owner, space }) =>
    `${name} doit ${amount} de loyer à ${owner} pour ${space}.`,
  rentMortgaged: ({ space }) => `${space} est hypothéquée : aucun loyer n'est dû.`,
  rentHome: ({ space, name }) =>
    `${space} est la salle commune de ${name} : elle ne paie rien.`,

  credited: ({ name, amount, reason }) => `${name} reçoit ${amount}${reason ? ` (${reason})` : ''}.`,
  paysPlayer: ({ name, amount, creditor, reason }) =>
    `${name} paie ${amount} à ${creditor} (${reason}).`,
  paysBank: ({ name, amount, reason }) => `${name} paie ${amount} à la banque (${reason}).`,
  partialPay: ({ name, paid, amount, reason }) =>
    `${name} ne peut verser que ${paid} sur ${amount} (${reason}) : le reste est passé.`,
  hands: ({ name, paid, creditor, reason }) =>
    `${name} verse ${paid}${creditor ? ` à ${creditor}` : ''} (${reason}).`,
  owes: ({ name, amount, creditor, reason }) =>
    `${name} doit ${amount}${creditor ? ` à ${creditor}` : ' à la banque'} (${reason}).`,
  settles: ({ name, amount, creditor }) =>
    `${name} règle sa dette de ${amount}${creditor ? ` envers ${creditor}` : ' envers la banque'}.`,

  mortgages: ({ name, space, amount }) => `${name} hypothèque ${space} pour ${amount}.`,
  unmortgages: ({ name, space, amount }) => `${name} lève l'hypothèque de ${space} pour ${amount}.`,
  builds: ({ name, label, space, amount, count }) =>
    `${name} construit ${label} sur ${space} (${amount}) — ${count} au total.`,
  buildsTop: ({ name, label, space, amount }) =>
    `${name} construit ${label} sur ${space} (${amount}).`,
  sellsTop: ({ name, label, space, amount }) =>
    `${name} revend ${label} de ${space} pour ${amount} — 4 constructions restent.`,
  sellsTopRazed: ({ name, label, space, amount }) =>
    `${name} revend ${label} de ${space} pour ${amount} (la banque n'a plus de constructions).`,
  sells: ({ name, space, amount }) => `${name} revend une construction de ${space} pour ${amount}.`,

  toJail: ({ name }) => `${name} va en prison.`,
  jailDouble: ({ name }) => `${name} fait un double et sort de prison.`,
  jailStays: ({ name, turn, max }) => `${name} reste en prison (tentative ${turn}/${max}).`,
  jailMaxed: ({ name, max }) =>
    `${name} a purgé ses ${max} tours de prison : elle ressort libre.`,
  jailBail: ({ name, amount }) => `${name} paie ${amount} de caution et sort de prison.`,
  jailCard: ({ name }) => `${name} utilise sa carte « libérée de prison ».`,
  jailPayOption: ({ amount }) => `Payer ${amount} et sortir`,
  jailDrawOption: () => 'Rester et tirer une carte',
  thirdDouble: ({ name }) => `${name} fait un troisième double d'affilée.`,

  draws: ({ name, deck, text }) => `${name} pioche une carte ${deck} : « ${text} »`,
  keepsJailCard: ({ name }) => `${name} conserve une carte « libérée de prison ».`,
  cardChoice: ({ name, label }) => `${name} choisit : ${label}.`,
  nothingToRepair: ({ name }) => `${name} n'a aucune construction : rien à payer.`,
  noSuchSpace: () => `Aucune case de ce type sur ce plateau.`,
  unknownCard: ({ type }) => `Effet de carte inconnu : ${type}`,

  auctionOpens: ({ space }) => `${space} est mise aux enchères.`,
  auctionBid: ({ name, amount }) => `${name} mise ${amount}.`,
  auctionPass: ({ name }) => `${name} passe.`,
  auctionWon: ({ name, space, amount }) => `${name} remporte ${space} pour ${amount}.`,
  auctionUnsold: ({ space }) => `Personne n'a misé : ${space} reste à la banque.`,

  bankruptTo: ({ name, creditor, amount, count }) =>
    `${name} fait faillite. ${creditor} récupère ${amount} et ${count} propriété(s).`,
  bankruptBank: ({ name }) => `${name} fait faillite. Ses biens retournent à la banque.`,

  gameOver: ({ reason }) => `Fin de partie (${reason}).`,
  standingBankrupt: ({ name }) => `${name} avait fait faillite.`,
  standingPoints: ({ rank, name, worth, bonus }) =>
    `${rank}. ${name} — ${worth} points (dont ${bonus} de lieux explorés).`,
  standingWorth: ({ rank, name, worth }) => `${rank}. ${name} — ${worth} de patrimoine.`,
  endedBy: ({ name }) => `${name} arrête la partie`,
  lastStanding: ({ name }) => `${name} reste seule en jeu`,
  noneLeft: () => 'plus personne en jeu',
  allExplored: () => 'tous les lieux du plateau ont été explorés',
  allCaptured: () => 'tous les super-vilains du plateau ont été capturés',

  // Pion hostile autonome et dangers semés (`mechanics.hazardPawn`).
  hazardDropped: ({ label, space }) => `${label} pose un piège sur ${space}.`,
  hazardCleared: ({ space }) => `Le piège de ${space} est désamorcé.`,
  hazardChases: ({ label, name }) => `${label} fonce sur ${name} !`,
  hazardDefused: ({ name, space }) => `${name} neutralise le piège de ${space} sans une égratignure.`,
  hazardHits: ({ name, space, amount }) => `${name} déclenche le piège de ${space} : ${amount}.`,
  noHazard: () => 'Aucun piège à retirer sur le plateau.',
  rentBlocked: ({ space }) => `${space} était piégée : aucun loyer n'est dû.`,

  // Loyers épargnés, raccourcis, relances : pouvoirs de camp et cartes.
  rentWaived: ({ name, space }) => `${name} est exemptée du loyer de ${space}.`,
  rentWaiverGranted: ({ name }) => `${name} garde une exemption de loyer sous le coude.`,
  rivalPushed: ({ name, space }) => `${name} est repoussée jusqu'à ${space}.`,
  freeBuilding: ({ name, space }) => `${name} déploie une construction offerte sur ${space}.`,
  noFreeBuilding: ({ name }) => `${name} n'a aucun bien où déployer une construction.`,
  warpGo: ({ space, amount }) => `Se balancer jusqu'à ${space} (${amount})`,
  warpStay: () => 'Rester sur place',
  warped: ({ name, space }) => `${name} se balance jusqu'à ${space}.`,
  rerolls: ({ name }) => `${name} relance les dés.`,

  // Coffre de cartes visibles et dé d'Achat (extension qui les pose).
  vaultTakes: ({ name, text }) => `${name} prend une carte du coffre : ${text}`,
  vaultLoses: ({ name }) => `${name} perd une carte du coffre.`,
  playsSaleCard: ({ name, text }) => `${name} joue une carte du coffre : ${text}`,
  buyDieRoll: ({ name, value }) => `${name} lance le dé d'Achat et fait ${value}.`,
  buyDieNothing: ({ name }) => `Le dé d'Achat ne donne rien à ${name}.`,
  saleVictory: ({ name, text }) => `${name} remplit son objectif et gagne : ${text}`,

  // Parc Gratuit Jackpot (Hasbro G0718)
  spinsFreeParking: ({ name, label }) => `${name} tourne la roulette du Parc Gratuit : ${label}.`,
  drawsBonusCard: ({ name, title }) => `${name} pioche une carte Bonus : « ${title} »`,
  playsBonusCard: ({ name, title }) => `${name} joue la carte Bonus « ${title} ».`,
  bonusCancelled: ({ name, by }) => `${by} utilise « Coup de frein ! » et annule la carte de ${name} !`,
  takesDealMobile: ({ name }) => `${name} prend le volant du Deal Mobile !`,
  dealMobileClaim: ({ name, space }) => `${name} est au volant du Deal Mobile et prend ${space} gratuitement !`,
  dealMobileNoRent: ({ name, space }) => `${name} est au volant du Deal Mobile : aucun loyer n'est dû pour ${space}.`,
  landlordTakesChip: ({ name, tenant, space }) => `${name} prend 1 jeton Spin à la banque plutôt que le loyer de ${tenant} pour ${space}.`,
  spinsChipUsed: ({ name }) => `${name} utilise 1 jeton Spin pour tourner la roulette.`,
  bonusFreeHouse: ({ name, space }) => `${name} pose 1 maison offerte sur ${space}.`,
  bonusFreeProperty: ({ name, space }) => `${name} prend ${space} gratuitement.`,
  bonusTakeTwo: ({ name, space }) => `${name} achète également ${space} grâce à Coup double.`,
  bonusShortcut: ({ name, space }) => `${name} prend un raccourci jusqu'à ${space}.`,
  bonusTradeIn: ({ name, given, received }) => `${name} échange ${given} contre ${received}.`,

  drawsCorruptionCard: ({ name, title }) => `${name} pioche 1 carte Corruption : « ${title} ».`,
  drawsSuperCorruptionCard: ({ name, title }) => `${name} pioche 1 carte Super Corruption : « ${title} ».`,
  rollsEscapeSuccess: ({ name, count }) => `${name} lance le dé Évasion et s'échappe (+${count} carte(s) Corruption).`,
  rollsEscapeBusted: ({ name }) => `${name} lance le dé Évasion : la police l'arrête ! Direction la Prison.`,
  rollsHeistSuccess: ({ name, amount }) => `${name} lance le dé Casse et réussit le braquage (+${amount} de la Banque).`,
  rollsHeistBusted: ({ name }) => `${name} lance le dé Casse : pris sur le fait ! Direction la Prison.`,
  sentToSuperJail: ({ name, by }) => `${name} est envoyé(e) en Super Prison par ${by} !`,
  leavesSuperJailCash: ({ name, to, amount }) => `${name} sort de Super Prison en versant ${amount} de caution à ${to}.`,
  leavesSuperJailCards: ({ name, to, count }) => `${name} sort de Super Prison en donnant ${count} carte(s) Super Corruption à ${to}.`,
  corruptionPlay: ({ name, title }) => `${name} active sa carte Corruption « ${title} ».`,
  superCorruptionPlay: ({ name, title }) => `${name} active sa carte Super Corruption « ${title} ».`,

  // Extension Tout Acheter (Buy Everything)
  rollsBuyCard: ({ name }) => `${name} obtient « Acheter » au dé d'Achat (peut acheter une carte Vente).`,
  rollsForceDiscard: ({ name }) => `${name} obtient « Défausse » au dé d'Achat (peut forcer une défausse).`,
  rollsRefreshVault: ({ name }) => `${name} obtient « Renouveler » au dé d'Achat (renouvelle le Coffre-Fort).`,
  buysSaleCard: ({ name, title, amount }) => `${name} achète la carte Vente « ${title} » pour ${amount}.`,
  forcedDiscard: ({ name, target, title }) => `${name} force ${target} à défausser sa carte « ${title} » !`,
  refreshedVault: ({ name }) => `${name} renouvelle une carte du Coffre-Fort.`,
  instantWin: ({ name, title }) => `🏆 ${name} a accompli l'objectif de sa carte Vente « ${title} » et remporte la partie sur-le-champ !`,
  theBankPaid: ({ name, amount }) => `${name} possède la Banque : son paiement de ${amount} est couvert par la Banque !`,
  saleCardPlayed: ({ name, title }) => `${name} active sa carte Vente « ${title} ».`,

  // Motifs de paiement, cités entre parenthèses dans les phrases ci-dessus.
  reasonBail: () => 'caution de sortie de prison',
  reasonCard: () => 'carte',
  reasonBirthday: () => 'anniversaire',
  reasonGo: () => 'passage par la case Départ',
  reasonGoDouble: () => 'tombée pile sur la case Départ, salaire doublé',
  undone: ({ name }) => `${name} revient sur son dernier geste.`,
  reasonParking: () => 'cagnotte du Parc Gratuit',
  reasonHazard: () => 'piège déclenché',
  reasonWarp: () => 'raccourci de toile',
  reasonTheft: () => 'vol',
  reasonRent: ({ space }) => `loyer de ${space}`,
  reasonRepairs: ({ houses, hotels }) => `réparations (${houses} maison(s), ${hotels} hôtel(s))`,
  reasonPayTo: ({ name }) => `versement à ${name}`,

  tradeProposed: ({ from, to }) => `${from} propose un échange à ${to}.`,
  tradeSettlementProposed: ({ from, to, amount }) =>
    `${from} propose un arrangement à ${to} pour solder ${amount}.`,
  tradeDeclined: ({ from, to }) => `${to} refuse l'échange proposé par ${from}.`,
  tradeSettlementDeclined: ({ from, to }) =>
    `${to} refuse l'arrangement : ${from} doit toujours sa dette.`,
  tradeAccepted: ({ from, to, gives, receives }) =>
    `Échange accepté : ${from} donne ${gives} et reçoit ${receives} de ${to}.`,
  tradeCancelled: ({ from }) => `${from} annule sa proposition.`,
  tradeMoot: () => "L'arrangement n'a plus lieu d'être : la dette est réglée.",
  tradeImpossible: ({ error }) => `L'échange n'est plus réalisable : ${error}`,
  debtCleared: ({ from, to }) => `L'arrangement est accepté : ${to} efface la dette de ${from}.`,
  nothing: () => 'rien',

  // — Mega Edition : dépôts, dé rapide, tickets de bus, cases spéciales ——
  buildsDepot: ({ name, space, amount }) => `${name} construit un dépôt sur ${space} (${amount}).`,
  sellsDepot: ({ name, space, amount }) => `${name} revend le dépôt de ${space} pour ${amount}.`,
  speedDieNumber: ({ name, face, total }) => `Dé rapide : ${face} — ${name} avance de ${total} au total.`,
  speedDieMrMonopoly: ({ name }) => `Dé rapide : Mr Monopoly — ${name} rejouera après avoir résolu sa case.`,
  speedDieBus: ({ name }) => `Dé rapide : Bus — ${name} prend le car.`,
  speedDieTriple: ({ name, value }) => `Triple ${value} ! ${name} choisit sa case n'importe où sur le plateau.`,
  mrMonopolyMoves: ({ name, space }) => `Mr Monopoly emmène ${name} jusqu'à ${space}.`,
  mrMonopolyIdle: ({ name }) => `Mr Monopoly ne trouve rien à faire visiter à ${name}.`,
  busTicketTaken: ({ name }) => `${name} prend un ticket de bus.`,
  busTicketEmpty: () => 'Il ne reste plus de ticket de bus.',
  busTicketUsed: ({ name, space }) => `${name} descend du car à ${space}.`,
  busTicketsExpired: ({ count }) => `Ce ticket périme tous les autres : ${count} ticket(s) partent à la poubelle.`,
  busFallback: ({ name, space }) => `Sans ticket, ${name} continue jusqu'à ${space}.`,
  auctionSpacePick: ({ name }) => `${name} met une propriété de la banque aux enchères.`,
  auctionSpaceEmpty: ({ name, space }) =>
    `Plus rien à vendre : ${name} file jusqu'à ${space}, le loyer le plus cher devant elle.`,
  birthdayGiftCash: ({ name, amount }) => `${name} déballe son cadeau : ${amount}.`,
  birthdayTakeCash: ({ amount }) => `Prendre ${amount}`,
  birthdayTakeTicket: () => 'Prendre un ticket de bus',
};

const EN = {
  joins: ({ name }) => `${name} joins the game.`,
  joinsSwapped: ({ name, token }) =>
    `${name} joins the game — the requested token was taken, so they play "${token}".`,
  starts: ({ name }) => `${name} starts the game.`,
  orderRoll: ({ name, total }) => `${name} rolls ${total} for turn order.`,
  turnOrder: ({ names }) => `Turn order: ${names}.`,
  turnOf: ({ name }) => `It is ${name}'s turn.`,
  rolls: ({ name, values, total, isDouble }) =>
    `${name} rolls ${values} (${total})${isDouble ? ' — a double!' : ''}.`,
  playsAgain: ({ name }) => `${name} rolls again (double).`,
  lands: ({ name, space }) => `${name} lands on ${space}.`,

  buys: ({ name, space, amount }) => `${name} buys ${space} for ${amount}.`,
  explores: ({ name, space, amount }) => `${name} explores ${space} for ${amount}.`,
  homeFree: ({ name, space }) => `${name} is at home: ${space} is theirs for nothing.`,
  declines: ({ name }) => `${name} declines to buy this property.`,

  rentDue: ({ name, amount, owner, space }) => `${name} owes ${owner} ${amount} rent for ${space}.`,
  rentMortgaged: ({ space }) => `${space} is mortgaged: no rent is due.`,
  rentHome: ({ space, name }) => `${space} is ${name}'s own common room: nothing to pay.`,

  credited: ({ name, amount, reason }) => `${name} receives ${amount}${reason ? ` (${reason})` : ''}.`,
  paysPlayer: ({ name, amount, creditor, reason }) => `${name} pays ${creditor} ${amount} (${reason}).`,
  paysBank: ({ name, amount, reason }) => `${name} pays the bank ${amount} (${reason}).`,
  partialPay: ({ name, paid, amount, reason }) =>
    `${name} can only hand over ${paid} of ${amount} (${reason}): the rest is written off.`,
  hands: ({ name, paid, creditor, reason }) =>
    `${name} hands over ${paid}${creditor ? ` to ${creditor}` : ''} (${reason}).`,
  owes: ({ name, amount, creditor, reason }) =>
    `${name} owes ${amount}${creditor ? ` to ${creditor}` : ' to the bank'} (${reason}).`,
  settles: ({ name, amount, creditor }) =>
    `${name} settles a debt of ${amount}${creditor ? ` to ${creditor}` : ' to the bank'}.`,

  mortgages: ({ name, space, amount }) => `${name} mortgages ${space} for ${amount}.`,
  unmortgages: ({ name, space, amount }) => `${name} lifts the mortgage on ${space} for ${amount}.`,
  builds: ({ name, label, space, amount, count }) =>
    `${name} builds ${label} on ${space} (${amount}) — ${count} in total.`,
  buildsTop: ({ name, label, space, amount }) => `${name} builds ${label} on ${space} (${amount}).`,
  sellsTop: ({ name, label, space, amount }) =>
    `${name} sells the ${label} on ${space} for ${amount} — 4 buildings remain.`,
  sellsTopRazed: ({ name, label, space, amount }) =>
    `${name} sells the ${label} on ${space} for ${amount} (the bank has none left).`,
  sells: ({ name, space, amount }) => `${name} sells a building on ${space} for ${amount}.`,

  toJail: ({ name }) => `${name} goes to jail.`,
  jailDouble: ({ name }) => `${name} rolls a double and leaves jail.`,
  jailStays: ({ name, turn, max }) => `${name} stays in jail (attempt ${turn}/${max}).`,
  jailMaxed: ({ name, max }) => `${name} has served ${max} turns in jail and walks out free.`,
  jailBail: ({ name, amount }) => `${name} pays ${amount} and leaves jail.`,
  jailCard: ({ name }) => `${name} uses a "get out of jail free" card.`,
  jailPayOption: ({ amount }) => `Pay ${amount} and leave`,
  jailDrawOption: () => 'Stay and draw a card',
  thirdDouble: ({ name }) => `${name} rolls a third double in a row.`,

  draws: ({ name, deck, text }) => `${name} draws a ${deck} card: "${text}"`,
  keepsJailCard: ({ name }) => `${name} keeps a "get out of jail free" card.`,
  cardChoice: ({ name, label }) => `${name} chooses: ${label}.`,
  nothingToRepair: ({ name }) => `${name} has no buildings: nothing to pay.`,
  noSuchSpace: () => 'No space of that kind on this board.',
  unknownCard: ({ type }) => `Unknown card effect: ${type}`,

  auctionOpens: ({ space }) => `${space} goes up for auction.`,
  auctionBid: ({ name, amount }) => `${name} bids ${amount}.`,
  auctionPass: ({ name }) => `${name} passes.`,
  auctionWon: ({ name, space, amount }) => `${name} wins ${space} for ${amount}.`,
  auctionUnsold: ({ space }) => `Nobody bid: ${space} stays with the bank.`,

  bankruptTo: ({ name, creditor, amount, count }) =>
    `${name} goes bankrupt. ${creditor} takes ${amount} and ${count} propert${count === 1 ? 'y' : 'ies'}.`,
  bankruptBank: ({ name }) => `${name} goes bankrupt. Their holdings go back to the bank.`,

  gameOver: ({ reason }) => `Game over (${reason}).`,
  standingBankrupt: ({ name }) => `${name} had gone bankrupt.`,
  standingPoints: ({ rank, name, worth, bonus }) =>
    `${rank}. ${name} — ${worth} points (${bonus} of them from explored places).`,
  standingWorth: ({ rank, name, worth }) => `${rank}. ${name} — ${worth} in total worth.`,
  endedBy: ({ name }) => `${name} ended the game`,
  lastStanding: ({ name }) => `${name} is the last one left`,
  noneLeft: () => 'nobody left in the game',
  allExplored: () => 'every location on the board has been explored',
  allCaptured: () => 'every super-villain on the board has been captured',

  hazardDropped: ({ label, space }) => `${label} drops a trap on ${space}.`,
  hazardCleared: ({ space }) => `The trap on ${space} has been defused.`,
  hazardChases: ({ label, name }) => `${label} charges at ${name}!`,
  hazardDefused: ({ name, space }) => `${name} clears the trap on ${space} without a scratch.`,
  hazardHits: ({ name, space, amount }) => `${name} sets off the trap on ${space}: ${amount}.`,
  noHazard: () => 'No trap left on the board.',
  rentBlocked: ({ space }) => `${space} was trapped: no rent is due.`,

  rentWaived: ({ name, space }) => `${name} is exempt from the rent on ${space}.`,
  rentWaiverGranted: ({ name }) => `${name} keeps a rent exemption in hand.`,
  rivalPushed: ({ name, space }) => `${name} is pushed back to ${space}.`,
  freeBuilding: ({ name, space }) => `${name} deploys a free building on ${space}.`,
  noFreeBuilding: ({ name }) => `${name} has no property to build on.`,
  warpGo: ({ space, amount }) => `Swing across to ${space} (${amount})`,
  warpStay: () => 'Stay put',
  warped: ({ name, space }) => `${name} swings across to ${space}.`,
  rerolls: ({ name }) => `${name} rolls again.`,

  vaultTakes: ({ name, text }) => `${name} takes a card from the vault: ${text}`,
  vaultLoses: ({ name }) => `${name} loses a card from the vault.`,
  playsSaleCard: ({ name, text }) => `${name} plays a vault card: ${text}`,
  buyDieRoll: ({ name, value }) => `${name} rolls the Buy Die and gets ${value}.`,
  buyDieNothing: ({ name }) => `The Buy Die gives ${name} nothing.`,
  saleVictory: ({ name, text }) => `${name} meets the goal and wins: ${text}`,

  // Free Parking Jackpot (Hasbro G0718)
  spinsFreeParking: ({ name, label }) => `${name} spins the Free Parking spinner: ${label}.`,
  drawsBonusCard: ({ name, title }) => `${name} draws a Bonus card: "${title}"`,
  playsBonusCard: ({ name, title }) => `${name} plays Bonus card "${title}".`,
  bonusCancelled: ({ name, by }) => `${by} plays "Hit the brakes!" and stops ${name}'s card!`,
  takesDealMobile: ({ name }) => `${name} takes the wheel of the Deal Mobile!`,
  dealMobileClaim: ({ name, space }) => `${name} is driving the Deal Mobile and claims ${space} for free!`,
  dealMobileNoRent: ({ name, space }) => `${name} is driving the Deal Mobile: no rent is due for ${space}.`,
  landlordTakesChip: ({ name, tenant, space }) => `${name} takes 1 Spin chip from the bank instead of rent from ${tenant} for ${space}.`,
  spinsChipUsed: ({ name }) => `${name} uses 1 Spin chip to spin the spinner.`,
  bonusFreeHouse: ({ name, space }) => `${name} places a free house on ${space}.`,
  bonusFreeProperty: ({ name, space }) => `${name} claims ${space} for free.`,
  bonusTakeTwo: ({ name, space }) => `${name} also buys ${space} with Take two.`,
  bonusShortcut: ({ name, space }) => `${name} takes a shortcut to ${space}.`,
  bonusTradeIn: ({ name, given, received }) => `${name} swaps ${given} for ${received}.`,

  drawsCorruptionCard: ({ name, title }) => `${name} draws 1 Corruption card: "${title}".`,
  drawsSuperCorruptionCard: ({ name, title }) => `${name} draws 1 Super Corruption card: "${title}".`,
  rollsEscapeSuccess: ({ name, count }) => `${name} rolls the Escape die and gets away (+${count} Corruption card(s)).`,
  rollsEscapeBusted: ({ name }) => `${name} rolls the Escape die: busted by the police! Directly to Jail.`,
  rollsHeistSuccess: ({ name, amount }) => `${name} rolls the Heist die and pulls off the heist (+${amount} from the Bank).`,
  rollsHeistBusted: ({ name }) => `${name} rolls the Heist die: caught in the act! Directly to Jail.`,
  sentToSuperJail: ({ name, by }) => `${name} is sent to Super Jail by ${by}!`,
  leavesSuperJailCash: ({ name, to, amount }) => `${name} leaves Super Jail by paying ${amount} bail to ${to}.`,
  leavesSuperJailCards: ({ name, to, count }) => `${name} leaves Super Jail by giving ${count} Super Corruption card(s) to ${to}.`,
  corruptionPlay: ({ name, title }) => `${name} plays Corruption card "${title}".`,
  superCorruptionPlay: ({ name, title }) => `${name} plays Super Corruption card "${title}".`,

  // Buy Everything Expansion
  rollsBuyCard: ({ name }) => `${name} rolled "Buy Card" on the Buy Die (may buy a Sale card).`,
  rollsForceDiscard: ({ name }) => `${name} rolled "Force Discard" on the Buy Die (may force a discard).`,
  rollsRefreshVault: ({ name }) => `${name} rolled "Refresh" on the Buy Die (refreshes the Sale Vault).`,
  buysSaleCard: ({ name, title, amount }) => `${name} buys the Sale card "${title}" for ${amount}.`,
  forcedDiscard: ({ name, target, title }) => `${name} forces ${target} to discard their "${title}" card!`,
  refreshedVault: ({ name }) => `${name} refreshed a card in the Sale Vault.`,
  instantWin: ({ name, title }) => `🏆 ${name} completed the Sale card goal "${title}" and wins the game immediately!`,
  theBankPaid: ({ name, amount }) => `${name} owns the Bank: their payment of ${amount} is covered by the Bank!`,
  saleCardPlayed: ({ name, title }) => `${name} plays Sale card "${title}".`,

  reasonBail: () => 'bail to leave jail',
  reasonCard: () => 'card',
  reasonBirthday: () => 'birthday',
  reasonGo: () => 'passing GO',
  reasonGoDouble: () => 'landed exactly on GO, salary doubled',
  undone: ({ name }) => `${name} takes back their last move.`,
  reasonParking: () => 'Free Parking pot',
  reasonHazard: () => 'trap triggered',
  reasonWarp: () => 'web shortcut',
  reasonTheft: () => 'theft',
  reasonRent: ({ space }) => `rent for ${space}`,
  reasonRepairs: ({ houses, hotels }) => `repairs (${houses} house(s), ${hotels} hotel(s))`,
  reasonPayTo: ({ name }) => `payment to ${name}`,

  tradeProposed: ({ from, to }) => `${from} offers ${to} a trade.`,
  tradeSettlementProposed: ({ from, to, amount }) =>
    `${from} offers ${to} a deal to settle ${amount}.`,
  tradeDeclined: ({ from, to }) => `${to} declines ${from}'s trade.`,
  tradeSettlementDeclined: ({ from, to }) => `${to} refuses the deal: ${from} still owes the debt.`,
  tradeAccepted: ({ from, to, gives, receives }) =>
    `Trade accepted: ${from} gives ${gives} and receives ${receives} from ${to}.`,
  tradeCancelled: ({ from }) => `${from} withdraws their offer.`,
  tradeMoot: () => 'The deal is moot: the debt has been settled.',
  tradeImpossible: ({ error }) => `The trade is no longer possible: ${error}`,
  debtCleared: ({ from, to }) => `The deal is accepted: ${to} clears ${from}'s debt.`,
  nothing: () => 'nothing',

  // — Mega Edition: depots, Speed Die, Bus Tickets, new spaces ——————
  buildsDepot: ({ name, space, amount }) => `${name} builds a train depot on ${space} (${amount}).`,
  sellsDepot: ({ name, space, amount }) => `${name} sells the depot on ${space} for ${amount}.`,
  speedDieNumber: ({ name, face, total }) => `Speed Die: ${face} — ${name} moves ${total} in all.`,
  speedDieMrMonopoly: ({ name }) => `Speed Die: Mr Monopoly — ${name} will move again once this space is settled.`,
  speedDieBus: ({ name }) => `Speed Die: Bus — ${name} catches the coach.`,
  speedDieTriple: ({ name, value }) => `Triple ${value}! ${name} may move to any space on the board.`,
  mrMonopolyMoves: ({ name, space }) => `Mr Monopoly walks ${name} on to ${space}.`,
  mrMonopolyIdle: ({ name }) => `Mr Monopoly has nothing left to show ${name}.`,
  busTicketTaken: ({ name }) => `${name} takes a Bus Ticket.`,
  busTicketEmpty: () => 'There are no Bus Tickets left.',
  busTicketUsed: ({ name, space }) => `${name} gets off the coach at ${space}.`,
  busTicketsExpired: ({ count }) => `This ticket expires all the others: ${count} ticket(s) are discarded.`,
  busFallback: ({ name, space }) => `With no ticket, ${name} carries on to ${space}.`,
  auctionSpacePick: ({ name }) => `${name} puts one of the bank's properties up for auction.`,
  auctionSpaceEmpty: ({ name, space }) =>
    `Nothing left to sell: ${name} moves on to ${space}, the steepest rent ahead.`,
  birthdayGiftCash: ({ name, amount }) => `${name} unwraps their present: ${amount}.`,
  birthdayTakeCash: ({ amount }) => `Take ${amount}`,
  birthdayTakeTicket: () => 'Take a Bus Ticket',
};

const PACKS = { fr: FR, en: EN };

/**
 * Rend une phrase de journal dans la langue de la partie.
 * Une clé inconnue se rend telle quelle plutôt que de faire tomber le moteur.
 */
export function msg(locale, key, params = {}) {
  const pack = PACKS[locale] ?? FR;
  const entry = pack[key] ?? FR[key];
  return entry ? entry(params) : key;
}
