/**
 * Les mots de l'interface, en français et en anglais.
 *
 * La langue vient de la partie (`state.locale`), choisie au moment de sortir la
 * boîte. Tant qu'on n'est dans aucune partie, l'accueil suit la langue choisie à
 * l'écran. Le français est la référence : une clé non traduite retombe dessus
 * plutôt que d'afficher un identifiant brut.
 */
import { localeOf } from './board.js';

const FR = {
  // — Accueil et salon —————————————————————————————
  yourName: 'Votre pseudo',
  namePlaceholder: 'Julie',
  whichBox: 'Quelle boîte sort-on ?',
  language: 'Langue',
  yourToken: 'Votre pion',
  createGame: 'Créer une partie',
  orJoin: 'ou rejoindre',
  code: 'CODE',
  join: 'Rejoindre',
  resumeGame: 'Reprendre une partie',
  resumeHint:
    "Une partie interrompue vous attend ici, même des jours plus tard et même si personne n'est connecté : ouvrez-la et désignez votre joueuse.",
  whoResumes: 'Qui reprend sur cet appareil ? Cochez chaque joueuse qui jouera ici.',
  resumeMine: 'Reprendre ma place',
  resumeSeveral: (n) => `Reprendre à ${n} sur cet écran`,
  alreadyBack: 'déjà revenue',
  gameCode: 'Code de la partie',
  copied: 'Copié !',
  dictate: 'À dicter aux joueuses qui nous rejoignent à distance.',
  players: 'Joueuses',
  onThisScreen: 'sur cet écran',
  away: 'absente',
  addLocal: '+ Ajouter une joueuse sur cet ordinateur',
  gameFull: 'Partie complète',
  localName: 'Pseudo de la joueuse',
  add: 'Ajouter',
  cancel: 'Annuler',
  houseRules: 'Règles maison',
  startGame: 'Lancer la partie',
  needPlayers: (n) => `Il faut au moins ${n} joueuses`,
  anyoneStarts: "Quand tout le monde est là, n'importe qui peut lancer.",
  leave: 'Quitter',
  turn: 'tour',
  saved: 'La partie est sauvegardée : fermez tout, elle vous attendra.',
  endGame: 'Terminer la partie',
  agreed: "Tout le monde est d'accord ?",
  yesEnd: 'Oui, terminer',
  no: 'Non',
  gameOver: 'Partie terminée',
  seeRecap: 'Revoir le compte final',
  quitAndReplay: 'Quitter et rejouer',
  rules: 'Règles',
  understood: "J'ai compris",
  theRules: 'Les règles',
  close: 'Fermer',

  // — En jeu —————————————————————————————————————
  rollDice: 'Lancer les dés',
  tryDouble: 'Tenter un double',
  payBail: 'Payer',
  useCard: 'Utiliser ma carte',
  buy: 'Acheter',
  decline: 'Refuser (enchère)',
  bid: 'Miser',
  pass: 'Passer',
  drawCard: 'Piocher une carte',
  applyCard: "J'applique",
  endTurn: 'Finir le tour',
  playAgain: 'Rejouer (double)',
  trade: 'Échanger',
  negotiate: 'Négocier',
  pay: 'Payer',
  bankruptcy: 'Faillite',
  arrangeWith: (name) => `S'arranger avec ${name}`,
  negotiateElsewhere: 'Négocier ailleurs',
  waitingFor: (name) => `En attente de ${name}`,
  auctionTurn: (name) => `Enchère : au tour de ${name}`,
  yourTurn: (name) => `À ${name} de jouer`,
  myAssets: (name) => `Les biens de ${name}`,
  build: 'Construire',
  sellBuilding: 'Revendre',
  mortgage: 'Hypothéquer',
  unmortgage: 'Lever',
  mortgaged: 'Hypothéquée',
  turnOf: 'Au tour de',
  bank: 'banque',
  journal: 'Journal',
  chat: 'Chat',
  writeMessage: 'Écrire un message…',
  send: 'Envoyer',
  noneLeft: 'plus un billet',
  billsToHand: 'Les billets à sortir',

  // — Échanges ————————————————————————————————————
  billsOnTable: 'Billets posés sur la table',
  jailCards: 'Cartes de prison',
  nothingTradable: 'Aucune propriété échangeable.',
  onBehalfOf: 'Au nom de',
  with: 'Avec',
  gives: 'Donne',
  receives: 'Reçoit',
  proposeArrangement: "Proposer l'arrangement",
  propose: 'Proposer',
  noOneElse: 'Aucune autre joueuse en lice.',
  offersReceived: 'Propositions reçues',
  awaitingReply: 'En attente de réponse',
  accept: 'Accepter',
  refuse: 'Refuser',
  proposalTo: (name) => `Proposition à ${name}`,
  forPlayer: (name) => `Pour ${name}`,
  nothing: 'rien',
  tradeHint:
    "Un terrain construit ne peut pas être échangé : revendez d'abord ses maisons. La réponse peut arriver à tout moment, même hors du tour de la joueuse.",
  arrangement: 'arrangement',
  debtCleared: 'La dette serait alors effacée.',

  // — Fin de partie ————————————————————————————————
  draw: 'Match nul',
  finalCount: 'Le compte final',
  wins: (name) => `${name} l'emporte !`,

  // — Plateau ————————————————————————————————————
  collect: (amount) => `Recevez ${amount}`,
  notPassingGo: 'Sans passer par Départ',
  drawNow: 'Piochez !',
  drawFromPile: (deck) => `${deck} : piochez la carte du dessus du tas, au centre du plateau.`,
  cannotAfford:
    'Fonds insuffisants : hypothéquez ou revendez ci-dessous pour réunir la somme, ou refusez pour la mettre aux enchères.',
  cannotAffordNoMortgage:
    'Fonds insuffisants : refusez pour la mettre aux enchères, ou négociez de quoi la payer.',

  // — Fiche de propriété ——————————————————————————
  bareRent: 'Loyer terrain nu',
  withN: (n, label) => `Avec ${n} ${label}`,
  withOne: (label) => `Avec ${label}`,
  ownedCount: (n, label) => `${n} ${label}${n > 1 ? 's' : ''} possédée${n > 1 ? 's' : ''}`,
  price: "Prix d'achat",
  mortgageValue: 'Valeur hypothécaire',
  utilityRent: (a, b) => `Loyer : ${a} × le jet de dés, ou ${b} × si les deux sont possédées.`,
  hotSeatHint:
    'Plusieurs joueuses sur cet écran : cliquez sur un nom pour agir en son nom hors de son tour.',

  // — Onglets mobiles ——————————————————————————————
  tabPlay: 'Jouer',
  tabBoard: 'Plateau',
  tabPlayers: 'Joueuses',
  tabLog: 'Journal',

  // — Divers ————————————————————————————————————
  connectionLost: 'Connexion perdue — reprise automatique dès que le serveur répond…',
  justVisiting: 'Simple visite',
  inJailFor: (n, max) => `En prison (tentative ${n}/${max})`,
  eliminated: 'éliminée',
  here: 'ici',
};

const EN = {
  yourName: 'Your name',
  namePlaceholder: 'Alex',
  whichBox: 'Which box are we opening?',
  language: 'Language',
  yourToken: 'Your token',
  createGame: 'Create a game',
  orJoin: 'or join',
  code: 'CODE',
  join: 'Join',
  resumeGame: 'Resume a game',
  resumeHint:
    'An unfinished game waits for you here, days later and even if nobody is connected: open it and pick your player.',
  whoResumes: 'Who is resuming on this device? Tick every player who will play here.',
  resumeMine: 'Take my seat back',
  resumeSeveral: (n) => `Resume with ${n} players on this screen`,
  alreadyBack: 'already back',
  gameCode: 'Game code',
  copied: 'Copied!',
  dictate: 'Read it out to whoever joins from somewhere else.',
  players: 'Players',
  onThisScreen: 'on this screen',
  away: 'away',
  addLocal: '+ Add a player on this computer',
  gameFull: 'Game full',
  localName: "Player's name",
  add: 'Add',
  cancel: 'Cancel',
  houseRules: 'House rules',
  startGame: 'Start the game',
  needPlayers: (n) => `At least ${n} players are needed`,
  anyoneStarts: 'Once everyone is here, anyone can start.',
  leave: 'Leave',
  turn: 'turn',
  saved: 'The game is saved: close everything, it will wait for you.',
  endGame: 'End the game',
  agreed: 'Is everyone agreed?',
  yesEnd: 'Yes, end it',
  no: 'No',
  gameOver: 'Game over',
  seeRecap: 'See the final standings',
  quitAndReplay: 'Leave and play again',
  rules: 'Rules',
  understood: 'Got it',
  theRules: 'The rules',
  close: 'Close',

  rollDice: 'Roll the dice',
  tryDouble: 'Try for a double',
  payBail: 'Pay',
  useCard: 'Use my card',
  buy: 'Buy',
  decline: 'Decline (auction)',
  bid: 'Bid',
  pass: 'Pass',
  drawCard: 'Draw a card',
  applyCard: 'Apply it',
  endTurn: 'End turn',
  playAgain: 'Roll again (double)',
  trade: 'Trade',
  negotiate: 'Negotiate',
  pay: 'Pay',
  bankruptcy: 'Bankruptcy',
  arrangeWith: (name) => `Make a deal with ${name}`,
  negotiateElsewhere: 'Negotiate elsewhere',
  waitingFor: (name) => `Waiting for ${name}`,
  auctionTurn: (name) => `Auction: ${name}'s turn to bid`,
  yourTurn: (name) => `${name}'s turn`,
  myAssets: (name) => `${name}'s holdings`,
  build: 'Build',
  sellBuilding: 'Sell',
  mortgage: 'Mortgage',
  unmortgage: 'Lift',
  mortgaged: 'Mortgaged',
  turnOf: 'Turn:',
  bank: 'bank',
  journal: 'Log',
  chat: 'Chat',
  writeMessage: 'Write a message…',
  send: 'Send',
  noneLeft: 'not a single note left',
  billsToHand: 'Notes to hand over',

  billsOnTable: 'Notes on the table',
  jailCards: 'Get-out-of-jail cards',
  nothingTradable: 'No tradable property.',
  onBehalfOf: 'On behalf of',
  with: 'With',
  gives: 'Gives',
  receives: 'Receives',
  proposeArrangement: 'Propose the deal',
  propose: 'Propose',
  noOneElse: 'No other player left.',
  offersReceived: 'Offers received',
  awaitingReply: 'Awaiting a reply',
  accept: 'Accept',
  refuse: 'Decline',
  proposalTo: (name) => `Offer to ${name}`,
  forPlayer: (name) => `For ${name}`,
  nothing: 'nothing',
  tradeHint:
    'A built property cannot be traded: sell its houses first. A reply can come at any time, even outside that player\'s turn.',
  arrangement: 'deal',
  debtCleared: 'The debt would then be cleared.',

  draw: 'A draw',
  finalCount: 'Final standings',
  wins: (name) => `${name} wins!`,

  collect: (amount) => `Collect ${amount}`,
  notPassingGo: 'Do not pass GO',
  drawNow: 'Draw!',
  drawFromPile: (deck) => `${deck}: draw the top card from the pile at the centre of the board.`,
  cannotAfford:
    'Not enough funds: mortgage or sell below to raise the amount, or decline to send it to auction.',
  cannotAffordNoMortgage:
    'Not enough funds: decline to send it to auction, or negotiate enough to pay for it.',

  bareRent: 'Rent (site only)',
  withN: (n, label) => `With ${n} ${label}`,
  withOne: (label) => `With ${label}`,
  ownedCount: (n, label) => `${n} ${label}${n > 1 ? 's' : ''} owned`,
  price: 'Price',
  mortgageValue: 'Mortgage value',
  utilityRent: (a, b) => `Rent: ${a} × the dice roll, or ${b} × if both are owned.`,
  hotSeatHint:
    'Several players on this screen: click a name to act for them outside their turn.',

  tabPlay: 'Play',
  tabBoard: 'Board',
  tabPlayers: 'Players',
  tabLog: 'Log',

  connectionLost: 'Connection lost — it will pick up as soon as the server answers…',
  justVisiting: 'Just visiting',
  inJailFor: (n, max) => `In jail (attempt ${n}/${max})`,
  eliminated: 'out',
  here: 'here',
};

const PACKS = { fr: FR, en: EN };

/**
 * Le traducteur d'une partie.
 *
 * `t('rules')` rend une chaîne ; `t('needPlayers', 2)` appelle l'entrée quand
 * c'est une fonction. Une clé absente de l'anglais retombe sur le français, et
 * une clé absente partout se rend telle quelle — visible, mais jamais cassée.
 */
export function translator(locale) {
  const pack = PACKS[locale] ?? FR;
  return (key, ...args) => {
    const entry = pack[key] ?? FR[key];
    if (entry == null) return key;
    return typeof entry === 'function' ? entry(...args) : entry;
  };
}

/** Le traducteur de la partie en cours. */
export function useT(state) {
  return translator(localeOf(state));
}
