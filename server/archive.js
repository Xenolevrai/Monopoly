/**
 * Le carnet des parties jouées, pour entraîner les bots plus tard.
 *
 * Ce que le journal d'une partie sait déjà dire : « Expert achète Gare
 * Montparnasse ». Ce qu'il ne dit pas, et qui est précisément ce qu'il faut
 * pour apprendre : **à quelle question elle répondait, et ce qu'elle avait en
 * main au moment de choisir**. Une décision, c'est une invite (`pending.kind`),
 * un état, et un coup joué — pas seulement son résultat.
 *
 * Trois principes tenus ici :
 *
 *  - **les décisions ne vivent pas dans `state`.** L'état part sur le disque à
 *    chaque coup et doit rester léger ; on les garde sur l'objet partie, comme
 *    `game.undo`. Une partie reprise après un redémarrage du serveur perd donc
 *    son historique — elle est alors marquée `partial`, pour qu'on puisse
 *    l'écarter à l'entraînement plutôt que d'apprendre sur un trou ;
 *  - **on écrit une seule fois, à la fin**, en ajoutant une ligne au fichier du
 *    mois. Le format JSON Lines s'ajoute sans relire et se filtre en une ligne
 *    de shell ;
 *  - **archiver ne doit jamais faire échouer un coup.** Toute erreur d'écriture
 *    est signalée dans la console et avalée : on préfère perdre une archive
 *    qu'interrompre une partie de famille.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { netWorth, propertiesOf, activePlayers, buildingLevel } from './engine/queries.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

// Ancré sur l'emplacement du fichier, jamais sur `process.cwd()` — même piège
// que `DATA_DIR` : lancer le serveur d'ailleurs pointerait vers un autre dossier.
const ARCHIVE_DIR =
  process.env.MONOPOLY_ARCHIVE_DIR ?? path.join(MODULE_DIR, '..', 'data', 'archives');

/** Au-delà, on cesse d'enregistrer : une partie de bots peut tourner longtemps. */
const MAX_DECISIONS = 20000;

/** Le fichier du mois en cours : `2026-08.jsonl`. */
function monthlyFile(at = new Date()) {
  const month = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
  return path.join(ARCHIVE_DIR, `${month}.jsonl`);
}

/**
 * Ce que la joueuse voyait avant de décider.
 *
 * On garde de quoi rejuger le coup sans avoir à rejouer la partie : son argent,
 * sa position, son patrimoine, ce qu'elle possède, et la même chose pour les
 * autres — un achat ne se juge pas pareil selon qu'on mène ou qu'on est à la
 * traîne.
 */
function snapshotBefore(state, playerId) {
  const pending = state.pending ?? {};
  const payload = pending.payload ?? {};
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return null;

  return {
    turn: state.turnCount,
    cash: me.cash,
    position: me.position,
    inJail: me.inJail,
    netWorth: netWorth(state, playerId),
    owned: propertiesOf(state, playerId).map((prop) => prop.spaceId),
    // Le niveau de construction de chacune, et ce qu'il reste en banque : sans
    // ça, une décision de bâtir ne se juge pas — on ne sait pas si le groupe
    // était déjà coiffé d'hôtels, ni si la banque avait encore des maisons.
    buildings: Object.fromEntries(
      propertiesOf(state, playerId)
        .map((prop) => [prop.spaceId, buildingLevel(prop)])
        .filter(([, level]) => level > 0),
    ),
    mortgaged: propertiesOf(state, playerId).filter((p) => p.mortgaged).map((p) => p.spaceId),
    bank: { houses: state.bank?.houses ?? 0, hotels: state.bank?.hotels ?? 0 },
    // La case et le prix en jeu, quand l'invite en désigne un.
    spaceId: payload.spaceId ?? null,
    price: payload.price ?? null,
    // La mise courante : sans elle, « a passé une enchère » ne se juge pas.
    currentBid: state.auction ? state.auction.highestBid : null,
    debt: state.debt ? { amount: state.debt.amount, creditorId: state.debt.creditorId } : null,
    freeParkingPot: state.freeParkingPot ?? 0,
    opponents: activePlayers(state)
      .filter((p) => p.id !== playerId)
      .map((p) => ({
        playerId: p.id,
        cash: p.cash,
        netWorth: netWorth(state, p.id),
        owned: propertiesOf(state, p.id).length,
      })),
  };
}

/**
 * Note une décision. Appelée par `dispatch` pour **toute** action, humaine
 * comme artificielle : c'est le seul point de passage, donc rien n'échappe.
 */
export function recordDecision(game, playerId, action, pendingKind, before, result) {
  if (!before) return;
  game.decisions ??= [];
  if (game.decisions.length >= MAX_DECISIONS) return;

  const player = game.state.players.find((p) => p.id === playerId);
  game.decisions.push({
    seq: game.decisions.length + 1,
    playerId,
    bot: player?.bot ?? null,
    pendingKind,
    action,
    accepted: Boolean(result?.ok),
    error: result?.ok ? undefined : result?.error,
    before,
  });
}

export { snapshotBefore };

/** Le classement final, du meilleur patrimoine au moins bon. */
function finalStandings(state) {
  const ranked = [...state.players]
    .map((p) => ({ player: p, worth: p.bankrupt ? 0 : netWorth(state, p.id) }))
    .sort((a, b) => b.worth - a.worth);

  return ranked.map(({ player, worth }, index) => ({
    id: player.id,
    name: player.name,
    token: player.token,
    bot: player.bot ?? null,
    order: player.order,
    finalCash: player.cash,
    finalWorth: worth,
    bankrupt: Boolean(player.bankrupt),
    rank: index + 1,
  }));
}

/**
 * Écrit la partie terminée dans l'archive du mois.
 *
 * Idempotent : une partie déjà archivée ne l'est pas deux fois, ce qui permet
 * d'appeler cette fonction depuis le point de diffusion, appelé à chaque coup.
 */
export async function archiveGame(room) {
  const { state } = room;
  if (state.phase !== 'finished' || room.archived) return false;
  room.archived = true;

  const decisions = room.decisions ?? [];
  const record = {
    code: state.code,
    startedAt: state.log?.[0]?.at ?? null,
    endedAt: Date.now(),
    editionId: state.editionId,
    extensionIds: state.extensionIds ?? [],
    locale: state.locale,
    settings: state.settings,
    seed: room.seed ?? null,
    turns: state.turnCount,
    winnerId: state.winnerId ?? null,
    players: finalStandings(state),
    // Une partie reprise après un redémarrage a perdu ses décisions : on le dit
    // plutôt que de laisser croire à une partie sans coups.
    partial: decisions.length === 0 && state.turnCount > 1,
    decisions,
    // Le journal complet, tel qu'il a été écrit. Le chat en est absent : il
    // n'apprend rien à un bot, et ce sont des conversations de famille.
    log: state.log ?? [],
  };

  try {
    await fs.mkdir(ARCHIVE_DIR, { recursive: true });
    await fs.appendFile(monthlyFile(), `${JSON.stringify(record)}\n`, 'utf8');
    return true;
  } catch (err) {
    // Perdre une archive ne doit jamais interrompre une partie.
    console.error('[monopoly] archivage impossible :', err.message);
    return false;
  }
}

/** Où les archives sont écrites — utile aux scripts et aux tests. */
export { ARCHIVE_DIR };
