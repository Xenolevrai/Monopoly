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
    `${name} a passé ${max} tours en prison : elle paie la caution.`,
  jailBail: ({ name, amount }) => `${name} paie ${amount} de caution et sort de prison.`,
  jailCard: ({ name }) => `${name} utilise sa carte « libérée de prison ».`,
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

  // Motifs de paiement, cités entre parenthèses dans les phrases ci-dessus.
  reasonBail: () => 'caution de sortie de prison',
  reasonCard: () => 'carte',
  reasonBirthday: () => 'anniversaire',
  reasonGo: () => 'passage par la case Départ',
  reasonParking: () => 'cagnotte du Parc Gratuit',
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
  jailMaxed: ({ name, max }) => `${name} has spent ${max} turns in jail and pays the fine.`,
  jailBail: ({ name, amount }) => `${name} pays ${amount} and leaves jail.`,
  jailCard: ({ name }) => `${name} uses a "get out of jail free" card.`,
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

  reasonBail: () => 'bail to leave jail',
  reasonCard: () => 'card',
  reasonBirthday: () => 'birthday',
  reasonGo: () => 'passing GO',
  reasonParking: () => 'Free Parking pot',
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
