/**
 * Schéma de l'état d'une partie.
 *
 * Principes retenus :
 *  1. Le serveur détient LA vérité : ce `GameState` vit côté serveur, le client
 *     n'en reçoit qu'une projection (voir `docs/DATA_MODEL.md`, section « vues »).
 *  2. L'état est un objet JSON sérialisable de bout en bout (pas de Map, pas de
 *     Set, pas de classe) : on peut le logger, le diffuser tel quel, le
 *     sauvegarder en SQLite ou le rejouer dans un test.
 *  3. Les propriétés ne sont PAS dupliquées dans les joueuses : `properties` est
 *     indexé par numéro de case et porte le propriétaire. Une seule source de
 *     vérité, pas de désynchronisation possible entre les deux listes.
 *  4. Ce qui « attend une décision » est explicite dans `pending` : le moteur
 *     n'accepte une action que si elle correspond à ce que `pending` réclame.
 *     C'est ce qui rend la validation serveur simple et exhaustive.
 */

/**
 * @typedef {'lobby'|'rolling'|'resolving'|'awaiting_action'|'auction'|'trade'|'finished'} GamePhase
 *
 * @typedef {Object} Player
 * @property {string} id            - identifiant stable (persiste à la reconnexion)
 * @property {string} name          - pseudo
 * @property {string} token         - id du pion (voir rules.json → tokens)
 * @property {string} color         - couleur du pion (hex)
 * @property {number} cash          - solde en €
 * @property {number} position      - case courante (0-39)
 * @property {boolean} inJail
 * @property {number} jailTurns     - tours passés en prison (0-3)
 * @property {number} getOutOfJailCards - nombre de cartes « libérée de prison » détenues
 * @property {boolean} bankrupt
 * @property {boolean} connected    - false = onglet fermé, la place reste réservée
 * @property {number} order         - rang dans l'ordre de jeu
 *
 * @typedef {Object} PropertyState
 * @property {number} spaceId
 * @property {string|null} ownerId  - null = appartient à la banque
 * @property {number} houses        - 0-4 (5 est représenté par `hotel`)
 * @property {boolean} hotel
 * @property {boolean} mortgaged
 *
 * @typedef {Object} DiceState
 * @property {[number, number]|null} values
 * @property {number} doublesCount  - doubles consécutifs dans le tour courant
 * @property {boolean} rolled       - la joueuse a déjà lancé pour ce déplacement
 *
 * @typedef {Object} Auction
 * @property {number} spaceId
 * @property {number} highestBid
 * @property {string|null} highestBidderId
 * @property {string[]} activeBidders - joueuses encore en lice
 * @property {string} currentBidderId - à qui de miser
 * @property {number} minimumRaise
 *
 * @typedef {Object} TradeOffer
 * @property {string} id
 * @property {string} fromPlayerId
 * @property {string} toPlayerId
 * @property {{ cash: number, spaceIds: number[], jailCards: number }} give
 * @property {{ cash: number, spaceIds: number[], jailCards: number }} receive
 * @property {'pending'|'accepted'|'declined'|'cancelled'} status
 *
 * @typedef {Object} Debt
 * @property {string} debtorId
 * @property {string|null} creditorId - null = la banque
 * @property {number} amount
 * @property {string} reason          - libellé pour le journal
 *
 * @typedef {Object} Pending
 * Ce que le moteur attend maintenant. Une seule décision en cours à la fois.
 * @property {'buy_or_auction'|'pay_debt'|'jail_choice'|'card_choice'|'auction_bid'|'trade_response'|'end_turn'|null} kind
 * @property {string[]} playerIds     - qui doit répondre
 * @property {Object} [payload]       - données propres au type (spaceId, montant, options de carte…)
 *
 * @typedef {Object} LogEntry
 * @property {string} id
 * @property {number} at              - timestamp
 * @property {string} type            - 'roll' | 'buy' | 'rent' | 'card' | 'build' | …
 * @property {string} text            - phrase prête à afficher, en français
 * @property {Object} [data]          - données structurées (pour l'UI / les tests)
 *
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} playerId
 * @property {string} text
 * @property {number} at
 *
 * @typedef {Object} GameState
 * @property {string} code            - code de partie à partager (ex. « PARIS7 »)
 * @property {string} hostId
 * @property {GamePhase} phase
 * @property {Player[]} players
 * @property {number} currentPlayerIndex
 * @property {number} turnCount
 * @property {DiceState} dice
 * @property {Record<number, PropertyState>} properties - clé = numéro de case
 * @property {{ houses: number, hotels: number }} bank  - stock restant
 * @property {{ chance: string[], community_chest: string[] }} decks - piles mélangées (ids de cartes)
 * @property {string|null} drawnCardId
 * @property {number} freeParkingPot  - utilisé seulement si houseRules.freeParkingPot
 * @property {Pending} pending
 * @property {Auction|null} auction
 * @property {TradeOffer[]} trades
 * @property {Debt|null} debt         - dette en cours à régler avant de continuer
 * @property {LogEntry[]} log
 * @property {ChatMessage[]} chat
 * @property {Object} settings        - copie de rules.houseRules, modifiable au lobby
 * @property {string|null} winnerId
 * @property {number} version         - incrémenté à chaque mutation (détection de désync)
 */

import { ownableSpaces, rules } from './index.js';

/**
 * Construit l'état initial d'une partie (phase lobby, sans joueuses).
 * @param {string} code
 * @param {string} hostId
 * @returns {GameState}
 */
export function createGameState(code, hostId) {
  /** @type {Record<number, PropertyState>} */
  const properties = {};
  for (const space of ownableSpaces()) {
    properties[space.id] = {
      spaceId: space.id,
      ownerId: null,
      houses: 0,
      hotel: false,
      mortgaged: false,
    };
  }

  return {
    code,
    hostId,
    phase: 'lobby',
    players: [],
    currentPlayerIndex: 0,
    turnCount: 0,
    dice: { values: null, doublesCount: 0, rolled: false },
    properties,
    bank: { houses: rules.housesInBank, hotels: rules.hotelsInBank },
    decks: { chance: [], community_chest: [] },
    drawnCardId: null,
    freeParkingPot: 0,
    pending: { kind: null, playerIds: [] },
    auction: null,
    trades: [],
    debt: null,
    log: [],
    chat: [],
    settings: { ...rules.houseRules },
    winnerId: null,
    version: 0,
  };
}

/**
 * Crée une joueuse prête à être ajoutée au lobby.
 * @returns {Player}
 */
export function createPlayer({ id, name, token, color, order }) {
  return {
    id,
    name,
    token,
    color,
    cash: rules.startingCash,
    position: rules.goSpace,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    bankrupt: false,
    connected: true,
    order,
  };
}
