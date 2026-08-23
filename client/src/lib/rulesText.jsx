/**
 * Le texte des règles, en français et en anglais.
 *
 * Chaque entrée est une fonction qui reçoit le contexte de l'édition (ses
 * mécaniques, sa monnaie, son vocabulaire) et rend un paragraphe. Les règles ne
 * sont donc pas rédigées édition par édition : elles se **déduisent** de la
 * configuration, dans les deux langues. Une boîte sans hypothèque ne verra pas
 * le paragraphe sur l'hypothèque, et une boîte à points parlera de points.
 */

const FR = {
  goalTitle: 'Le but',
  goalExplore: (c) => (
    <>
      La partie s'arrête <strong>dès que le dernier lieu du plateau a été exploré</strong>. Chacune
      ajoute alors à sa réserve le {c.rentWord} courant de chaque lieu qu'elle possède : le plus
      grand total l'emporte. Personne n'est éliminée en cours de route.
    </>
  ),
  goalJackpot: () => (
    <>
      La partie s'arrête immédiatement <strong>dès que toutes les cases sont achetées</strong> ou{' '}
      <strong>dès qu'une joueuse fait faillite</strong>. Le classement est établi par la somme :{' '}
      argent en liquide + prix imprimé des propriétés + loyer courant de chaque propriété.
    </>
  ),
  goalLast: () => (
    <>
      Être la dernière encore solvable. Une joueuse qui ne peut plus payer fait faillite et quitte la
      partie ; celle qui reste gagne. On peut aussi arrêter d'un commun accord : le classement se
      fait alors au patrimoine.
    </>
  ),
  jackpotTitle: 'Parc Gratuit Jackpot',
  jackpotMain: () => (
    <>
      Tout versement à la Banque alimente la <strong>Cagnotte</strong>. Tomber pile sur le Parc
      Gratuit rapporte l'intégralité de la Cagnotte, 1 carte Bonus, et le <strong>Deal Mobile</strong>{' '}
      (terrains libres gratuits et dispense de loyers !).
    </>
  ),
  spinnerMain: () => (
    <>
      Chaque tour de roulette rapporte <strong>1 carte Bonus</strong>. Les propriétaires peuvent
      aussi choisir de prendre 1 jeton Spin à la Banque au lieu de réclamer un loyer.
    </>
  ),
  goToJailTitle: 'Extension Prison (Go to Jail)',
  goToJailMain: () => (
    <>
      Les cases Taxes envoient directement en <strong>Prison</strong>. Rester en cellule rapporte 1 carte Corruption
      par tour. Les dés <strong>Évasion</strong> (sur les cases Chance) et <strong>Casse</strong> (sur les cases Caisse de communauté)
      permettent de rafler des cartes et du liquide ou d'être envoyé derrière les barreaux.
    </>
  ),
  superJailMain: () => (
    <>
      La case 30 devient la <strong>Super Prison</strong>, où l'on ne peut être envoyé que par un adversaire.
      Elle rapporte de puissantes <strong>cartes Super Corruption</strong> chaque tour. Pour en sortir : payer 300 € ou donner ses cartes collectées au commanditaire.
      <strong>Attention :</strong> toute joueuse encore en cellule à la fin de partie ne peut pas gagner !
    </>
  ),
  buyEverythingTitle: 'Extension Tout Acheter',
  buyEverythingMain: () => (
    <>
      Tout est à vendre ! Les 4 cases Coins (<strong>Départ, Prison, Parc Gratuit, Allez en prison</strong>) forment
      le groupe des Coins (loyer de 50 € à 400 € selon le nombre détenu). Les cases Taxes et Spéciales deviennent également achetables.
    </>
  ),
  saleVaultRules: () => (
    <>
      Après votre déplacement, lancez le <strong>Dé d'Achat</strong> pour acheter une carte au <strong>Coffre-Fort</strong> (limite de 3 cartes en main),
      forcer une adversaire à défausser ou renouveler le présentoir. Les cartes <strong>Vertes</strong> déclenchent une <strong>victoire immédiate</strong> !
    </>
  ),

  turnTitle: 'Le tour de jeu',
  turnDice: (c) =>
    `On lance ${c.diceCount} dés, on avance d'autant de cases, et on résout la case d'arrivée. Un double rejoue ; ${c.doublesToJail} doubles d'affilée envoient directement en ${c.jailWord}.`,
  turnGo: (c) =>
    `Repasser par la case Départ rapporte ${c.goBonus}. On commence la partie avec ${c.start}.`,

  buyTitle: (c) => (c.explore ? 'Explorer un lieu' : 'Acheter une case'),
  buyMain: (c) =>
    `En arrivant sur une case libre, on peut ${c.explore ? "l'explorer" : "l'acheter"} au prix imprimé.` +
    (c.auctions ? ' Si on refuse, elle part aux enchères et tout le monde peut miser.' : ''),
  buyRent: (c) => (
    <>
      Une case occupée par une autre coûte un {c.rentWord}. Posséder{' '}
      <strong>tout un groupe de couleur</strong> double ce montant sur les cases nues.
    </>
  ),
  buyHome: () => (
    <>
      La salle commune de <strong>votre propre maison</strong> est à part : vous l'explorez
      gratuitement en y arrivant, et vous n'y payez jamais rien, même si une autre l'a prise avant
      vous.
    </>
  ),

  factionMain: (c) =>
    `Chacune choisit son camp au départ (${c.factionList}). Il donne la couleur de vos ${c.buildingsLower} et l'identité de votre score.`,

  buildMain: (c) =>
    `Avec un groupe de couleur complet, on pose des ${c.buildingsLower} pour faire monter le montant dû. La construction se répartit également sur le groupe : pas de second ${c.buildingLower} quelque part tant que les autres n'en ont pas un.`,
  buildHotel: (c) => `Quatre ${c.buildingsLower} sur une case permettent d'y bâtir un ${c.hotelLower}.`,
  buildCap: () => "Il n'y a pas d'échelon au-dessus : quatre par case, c'est le maximum.",

  mortgageTitle: 'Hypothèque',
  mortgageMain: (c) =>
    `À court de ${c.unit}, on peut hypothéquer une case libre de constructions : la banque verse sa valeur hypothécaire, et la case ne rapporte plus rien tant qu'elle l'est. On la dégage plus tard en remboursant cette valeur majorée de ${c.interest} %.`,
  mortgageHint: () =>
    'Une case hypothéquée est signalée en pointillés dans la liste de vos biens, avec le bouton « Lever » et son coût affiché.',

  jailMain: (c) =>
    `On y va sur la case prévue, sur une carte, ou après ${c.doublesToJail} doubles. Pour sortir : faire un double, payer ${c.bail}, ou utiliser une carte de sortie. Au bout de ${c.maxTurns} tours, la sortie est payante d'office.`,

  cardsTitle: (c) => (c.deckCount > 1 ? 'Les cartes' : `Les cartes ${c.deckNames}`),
  cardsMain: (c) =>
    (c.deckCount > 1 ? `Deux piles : ${c.deckNames}.` : `Une seule pile : ${c.deckNames}.`) +
    " On tire soi-même la carte du dessus du tas au centre du plateau, on la lit, puis on l'applique. Elle repart ensuite sous la pile.",

  tradeTitle: 'Négocier',
  tradeMain: (c) => (
    <>
      À tout moment, on propose ce qu'on veut à qui on veut : des cases, de la {c.unit}, des cartes
      de sortie. La réponse peut arriver <strong>sans attendre son tour</strong>.
    </>
  ),
  tradeRent: () =>
    "Un montant dû ne se prélève jamais tout seul : on peut payer, proposer un arrangement à la créancière — qui efface la dette si elle accepte, quel qu'en soit le contenu — ou vendre quelque chose d'abord.",

  brokeTitle: (c) => (c.eliminates ? 'Ne plus pouvoir payer' : 'Être à court'),
  brokeEliminates: () =>
    "Il faut réunir la somme : hypothéquer, revendre des constructions, négocier. Si vraiment rien n'est possible, on déclare faillite — les biens reviennent à la créancière, ou à la banque qui les remet aux enchères.",
  brokeSurvives: () =>
    "Aucune élimination dans cette édition : on verse ce qu'on a, et l'affaire est close. On continue de jouer même à zéro point.",

  devicesTitle: 'Sur plusieurs appareils',
  devicesMain: () =>
    "Plusieurs personnes peuvent jouer sur le même écran, et d'autres à distance avec le code de la partie. Tout est sauvegardé : on ferme, on revient le lendemain, et on reprend sa place depuis l'accueil — même si personne d'autre n'est connecté.",
};

const EN = {
  goalTitle: 'The goal',
  goalExplore: (c) => (
    <>
      The game stops <strong>the moment the last location on the board is explored</strong>. Everyone
      then adds the current {c.rentWord} of each place they own to their pile: the highest total
      wins. Nobody is knocked out along the way.
    </>
  ),
  goalJackpot: () => (
    <>
      The game ends immediately <strong>when all spaces are owned</strong> or{' '}
      <strong>when any player goes bankrupt</strong>. Final ranking is: cash + printed property space
      prices + current rent of all owned properties.
    </>
  ),
  goalLast: () => (
    <>
      Be the last one still solvent. A player who can no longer pay goes bankrupt and leaves the
      game; whoever remains wins. You can also stop by mutual agreement: the ranking then goes by
      total worth.
    </>
  ),
  jackpotTitle: 'Free Parking Jackpot',
  jackpotMain: () => (
    <>
      All payments to the Bank go into the <strong>Jackpot</strong>. Landing on Free Parking by exact
      count collects the entire Jackpot, 1 Bonus card, and the <strong>Deal Mobile</strong> (free
      unowned properties & skip paying rent!).
    </>
  ),
  spinnerMain: () => (
    <>
      Every spin of the spinner gives <strong>1 Bonus card</strong>. Landlords can also choose to
      take 1 Spin chip from the Bank instead of charging rent.
    </>
  ),
  goToJailTitle: 'Go to Jail Expansion',
  goToJailMain: () => (
    <>
      Tax spaces send you straight to <strong>Jail</strong>. Staying in your cell earns you 1 Corruption card
      per turn. The <strong>Escape Die</strong> (on Chance spaces) and <strong>Heist Die</strong> (on Community Chest spaces)
      let you score cards and cash or get thrown behind bars.
    </>
  ),
  superJailMain: () => (
    <>
      Space 30 becomes <strong>Super Jail</strong>, where you can only be sent by another player.
      It grants powerful <strong>Super Corruption cards</strong> each turn. To get out: pay $300 or give your collected cards to the sender.
      <strong>Important:</strong> any player still in Jail or Super Jail when the game ends cannot win!
    </>
  ),
  buyEverythingTitle: 'Buy Everything Expansion',
  buyEverythingMain: () => (
    <>
      Everything is for sale! The 4 Corner spaces (<strong>GO, Jail, Free Parking, Go to Jail</strong>) form
      the Corners group (rents from $50 to $400 depending on count owned). Taxes and Special spaces are also buyable.
    </>
  ),
  saleVaultRules: () => (
    <>
      After moving, roll the <strong>Buy Die</strong> to purchase abilities from the <strong>Sale Vault</strong> (hand limit of 3 cards),
      force an opponent to discard or refresh the vault. <strong>Green</strong> cards trigger an <strong>instant win</strong>!
    </>
  ),

  turnTitle: 'A turn',
  turnDice: (c) =>
    `Roll ${c.diceCount} dice, move that many spaces, and resolve where you land. A double rolls again; ${c.doublesToJail} doubles in a row send you straight to ${c.jailWord}.`,
  turnGo: (c) => `Passing GO pays ${c.goBonus}. Everyone starts with ${c.start}.`,

  buyTitle: (c) => (c.explore ? 'Exploring a location' : 'Buying a space'),
  buyMain: (c) =>
    `Land on a free space and you may ${c.explore ? 'explore' : 'buy'} it at the printed price.` +
    (c.auctions ? ' Decline, and it goes to auction — anyone may bid.' : ''),
  buyRent: (c) => (
    <>
      A space owned by someone else costs a {c.rentWord}. Owning <strong>a whole colour group</strong>{' '}
      doubles that amount on undeveloped spaces.
    </>
  ),
  buyHome: () => (
    <>
      The common room of <strong>your own house</strong> is different: you explore it for free when
      you land on it, and you never pay there, even if someone else took it first.
    </>
  ),

  factionMain: (c) =>
    `Everyone picks a side at the start (${c.factionList}). It sets the colour of your ${c.buildingsLower} and the identity of your score.`,

  buildMain: (c) =>
    `With a complete colour group, place ${c.buildingsLower} to raise what others owe. Building is spread evenly across the group: no second ${c.buildingLower} anywhere until the others each have one.`,
  buildHotel: (c) => `Four ${c.buildingsLower} on a space let you build a ${c.hotelLower}.`,
  buildCap: () => 'There is nothing above that: four per space is the maximum.',

  mortgageTitle: 'Mortgage',
  mortgageMain: (c) =>
    `Short of ${c.unit}, you can mortgage a space with no buildings on it: the bank pays its mortgage value, and the space earns nothing while mortgaged. You lift it later by repaying that value plus ${c.interest}%.`,
  mortgageHint: () =>
    'A mortgaged space is shown with a dashed border in your holdings, with a "Lift" button and its cost.',

  jailMain: (c) =>
    `You get there via the space, a card, or after ${c.doublesToJail} doubles. To get out: roll a double, pay ${c.bail}, or use a get-out card. After ${c.maxTurns} turns, you pay regardless.`,

  cardsTitle: (c) => (c.deckCount > 1 ? 'The cards' : `${c.deckNames} cards`),
  cardsMain: (c) =>
    (c.deckCount > 1 ? `Two decks: ${c.deckNames}.` : `A single deck: ${c.deckNames}.`) +
    ' You draw the top card of the pile at the centre of the board yourself, read it, then apply it. It goes back under the pile afterwards.',

  tradeTitle: 'Negotiating',
  tradeMain: (c) => (
    <>
      At any time, offer whatever you like to whoever you like: spaces, {c.unit}, get-out cards. A
      reply can come <strong>without waiting for their turn</strong>.
    </>
  ),
  tradeRent: () =>
    'An amount owed is never taken automatically: you can pay, offer the creditor a deal — which clears the debt if they accept, whatever it contains — or sell something first.',

  brokeTitle: (c) => (c.eliminates ? 'Unable to pay' : 'Running short'),
  brokeEliminates: () =>
    'You have to raise the money: mortgage, sell buildings, negotiate. If nothing at all works, you declare bankruptcy — your holdings go to the creditor, or back to the bank, which auctions them off.',
  brokeSurvives: () =>
    'Nobody is knocked out in this edition: you hand over what you have and the matter is closed. You keep playing even at zero.',

  devicesTitle: 'Across several devices',
  devicesMain: () =>
    'Several people can play on the same screen, and others remotely with the game code. Everything is saved: close it, come back tomorrow, and take your seat again from the home screen — even if nobody else is connected.',
};

const PACKS = { fr: FR, en: EN };

export function rulesText(locale) {
  return PACKS[locale] ?? FR;
}
