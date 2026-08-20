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
 * @property {string[]} saleCards  - cartes du coffre détenues (extension qui en pose un)
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
 * @property {boolean} extraRoll    - un double lui donne un tour supplémentaire
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
 * @property {'roll'|'buy_or_auction'|'draw_card'|'card_reveal'|'pay_debt'|'card_choice'|'auction_bid'|'end_turn'|null} kind
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
 * @property {string} editionId       - quelle édition fait tourner cette partie
 * @property {string[]} extensionIds  - extensions Hasbro activées, posées sur cette édition
 * @property {'fr'|'en'} locale       - la langue dans laquelle elle se joue
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
 * @property {{position: number, lastRoll: *}|null} hazardPawn - pion hostile autonome
 * @property {Record<number, boolean>} hazards - cases piégées, par numéro de case
 * @property {Pending} pending
 * @property {Auction|null} auction
 * @property {number[]} auctionQueue  - biens d'une faillite à liquider un par un
 * @property {{collectorId: string, amount: number, remaining: string[]}|null} pendingCollection
 * @property {boolean} awaitingTurnEnd - la joueuse courante a fait faillite, on passe la main
 * @property {TradeOffer[]} trades
 * @property {Debt|null} debt         - dette en cours à régler avant de continuer
 * @property {LogEntry[]} log
 * @property {ChatMessage[]} chat
 * @property {Object} settings        - copie de rules.houseRules, modifiable au lobby
 * @property {{playerId: string, name: string, worth: number}[]} standings - classement final
 * @property {string|null} winnerId
 * @property {{playerId: string, type: string, spaceId?: number}|null} undoable - dernier geste réversible, s'il y en a un
 * @property {number} version         - incrémenté à chaque mutation (détection de désync)
 */

import { getEdition, DEFAULT_EDITION, DEFAULT_LOCALE, OWNABLE_TYPES } from './index.js';
import { applyExtensions, compatibleExtensions } from './extensions.js';

/** Ne garde que les extensions à la fois connues et compatibles avec l'édition. */
function compatibleExtensionIds(edition, extensionIds) {
  const allowed = new Set(compatibleExtensions(edition).map((ext) => ext.id));
  return (extensionIds ?? []).filter((id) => allowed.has(id));
}

/**
 * Construit l'état initial d'une partie (phase lobby, sans joueuses).
 * @param {string} code
 * @param {string} hostId
 * @returns {GameState}
 */
export function createGameState(code, hostId, editionId = DEFAULT_EDITION, locale = DEFAULT_LOCALE, extensionIds = []) {
  // Résolues avec les extensions déjà fusionnées, pour que les propriétés
  // initiales (cases achetables, etc.) reflètent le plateau réellement joué.
  const edition = getEdition(editionId, locale);
  const activeExtensionIds = compatibleExtensionIds(edition, extensionIds);
  const merged = applyExtensions(edition, activeExtensionIds);

  /** @type {Record<number, PropertyState>} */
  const properties = {};
  for (const space of merged.board.filter((sp) => OWNABLE_TYPES.includes(sp.type))) {
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
    editionId: edition.id,
    extensionIds: activeExtensionIds,
    // La langue de la partie : elle ne change ni les prix ni les règles, seulement
    // les mots — noms de cases, textes de cartes, interface.
    locale,
    phase: 'lobby',
    players: [],
    currentPlayerIndex: 0,
    turnCount: 0,
    dice: { values: null, doublesCount: 0, rolled: false, extraRoll: false, rollId: 0 },
    properties,
    bank: { houses: edition.bank.houses, hotels: edition.bank.hotels },
    // Un objet par paquet déclaré par l'édition fusionnée (extensions comprises),
    // pas seulement chance/community_chest : une extension peut retirer ces deux-là
    // et en ajouter d'autres (spin, corruption…).
    decks: Object.fromEntries(Object.keys(merged.cards ?? {}).map((deck) => [deck, []])),
    drawnCardId: null,
    // Coffre de cartes toujours visibles, quand l'édition fusionnée en déclare
    // un (`mechanics.saleVault`). `null` partout ailleurs : rien à afficher,
    // rien à sauvegarder.
    saleVault: merged.mechanics?.saleVault ? { visible: [] } : null,
    // Pion hostile qui avance seul (`mechanics.hazardPawn`), et les dangers
    // qu'il sème. `null` / objet vide partout ailleurs : une édition sans pion
    // autonome ne porte rien de plus dans son état.
    hazardPawn: merged.mechanics?.hazardPawn
      ? { position: merged.mechanics.hazardPawn.start ?? 0, lastRoll: null }
      : null,
    hazards: {},
    freeParkingPot: 0,
    // Marqueur du dernier geste annulable. Les instantanés, eux, vivent hors de
    // l'état (voir `rememberForUndo`) : les y mettre gonflerait la sauvegarde.
    undoable: null,
    pending: { kind: null, playerIds: [] },
    auction: null,
    auctionQueue: [],
    pendingCollection: null,
    awaitingTurnEnd: false,
    trades: [],
    debt: null,
    log: [],
    logSeq: 0,
    chat: [],
    chatSeq: 0,
    // Les extensions peuvent changer des règles maison (ex. cagnotte Parc Gratuit
    // toujours active) : on part de l'édition déjà fusionnée, pas de l'originale.
    settings: { ...merged.houseRules },
    standings: [],
    winnerId: null,
    version: 0,
  };
}

/**
 * Crée une joueuse prête à être ajoutée au lobby.
 * @returns {Player}
 */
export function createPlayer({ id, name, token, color, order, edition, faction = null, bot = null }) {
  const config = edition ?? getEdition();
  return {
    id,
    name,
    token,
    color,
    // Camp choisi quand l'édition en propose (maison de Poudlard…), sinon null.
    faction,
    // Niveau de difficulté si c'est une joueuse artificielle, `null` si humaine.
    // Vit dans l'état — donc une partie reprise le lendemain retrouve ses bots.
    bot,
    cash: config.currency.startingAmount,
    position: 0,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    // Cartes gagnées dans un coffre (`mechanics.saleVault`) : toujours un
    // tableau, même sans extension qui en distribue — l'état reste homogène.
    saleCards: [],
    // Loyers à annuler (carte, ou pouvoir de camp accordé à chaque tour de
    // plateau). Toujours un nombre : l'état reste homogène sans extension.
    rentWaivers: 0,
    bankrupt: false,
    connected: true,
    order,
  };
}
