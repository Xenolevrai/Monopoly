/**
 * Le pion qui joue tout seul.
 *
 * Une édition peut déclarer `mechanics.hazardPawn` : un pion hostile qui avance
 * après chaque tour de joueuse, au jet d'un dé qui lui est propre, et qui sème
 * un danger sur la case où il s'arrête. Le moteur ne sait pas qui il est — ni
 * Bouffon Vert, ni rien d'autre : il lit une configuration.
 *
 * Une case piégée ne rapporte plus de loyer à sa propriétaire, et coûte une
 * pénalité à qui s'y arrête. Une construction sur la case le repousse : c'est
 * ce qui donne aux bâtiments un rôle défensif en plus du loyer.
 */
import { boardOf, isOwnable, getSpace } from '../../shared/index.js';
import { log, say, amountText } from './log.js';
import { playerById, activePlayers, config, buildingLevel } from './queries.js';
import { charge } from './money.js';

/** La configuration du pion hostile, ou null si l'édition n'en déclare pas. */
export function hazardConfig(state) {
  return config(state).mechanics?.hazardPawn ?? null;
}

/** Vrai si cette case porte un danger. */
export function isHazarded(state, spaceId) {
  return Boolean(state.hazards?.[spaceId]);
}

/**
 * Pose un danger sur une case, si elle s'y prête : elle doit être achetable,
 * et non défendue par une construction.
 * @returns {boolean} true si un danger vient d'être posé
 */
export function dropHazard(state, spaceId) {
  if (!hazardConfig(state)) return false;
  if (!isOwnable(state, spaceId)) return false;
  if (isHazarded(state, spaceId)) return false;
  // Le piège vise ce qu'on possède : c'est ainsi que la boîte décrit son effet
  // (« son propriétaire ne peut plus toucher de loyer »). Piéger aussi les
  // cases libres taxait tout le monde au hasard et étouffait les captures.
  if (hazardConfig(state).dropsOnOwnedOnly && !state.properties[spaceId]?.ownerId) return false;
  // Une construction repousse le pion : c'est la seule défense possible.
  if (buildingLevel(state.properties[spaceId] ?? {}) > 0) return false;

  state.hazards[spaceId] = true;
  log(state, 'hazard', say(state, 'hazardDropped', {
    label: hazardConfig(state).label,
    space: getSpace(state, spaceId).name,
  }), { spaceId });
  return true;
}

/** La première case piégée à partir d'une position, en avançant. */
function nextHazardedFrom(state, from) {
  const size = boardOf(state).length;
  for (let step = 0; step < size; step++) {
    const id = (from + step) % size;
    if (isHazarded(state, id)) return id;
  }
  return null;
}

/**
 * Retire jusqu'à `count` dangers du plateau, en partant de la joueuse.
 * @returns {number} combien ont été retirés
 */
export function clearHazards(state, fromPosition = 0, count = 1) {
  let cleared = 0;
  for (let i = 0; i < count; i++) {
    const spaceId = nextHazardedFrom(state, fromPosition);
    if (spaceId == null) break;
    delete state.hazards[spaceId];
    cleared += 1;
    log(state, 'hazard', say(state, 'hazardCleared', { space: getSpace(state, spaceId).name }), { spaceId });
  }
  return cleared;
}

/** La case achetable non défendue la plus proche, en avançant. */
export function nearestVulnerable(state, from) {
  const size = boardOf(state).length;
  for (let step = 1; step <= size; step++) {
    const id = (from + step) % size;
    if (!isOwnable(state, id)) continue;
    if (isHazarded(state, id)) continue;
    if (buildingLevel(state.properties[id] ?? {}) > 0) continue;
    if (hazardConfig(state)?.dropsOnOwnedOnly && !state.properties[id]?.ownerId) continue;
    return id;
  }
  return null;
}

/** Avance le pion hostile de `steps` cases et le fait frapper là où il s'arrête. */
export function advanceHazardPawn(state, steps) {
  const pawn = state.hazardPawn;
  if (!pawn) return;
  const size = boardOf(state).length;
  pawn.position = ((pawn.position + steps) % size + size) % size;
  strike(state);
}

/** Envoie le pion hostile sur la joueuse la plus proche devant lui. */
function chaseNearestPlayer(state) {
  const pawn = state.hazardPawn;
  const size = boardOf(state).length;
  let best = null;
  for (const player of activePlayers(state)) {
    const distance = ((player.position - pawn.position) % size + size) % size;
    if (distance === 0) continue;
    if (!best || distance < best.distance) best = { distance, player };
  }
  if (!best) return;
  pawn.position = best.player.position;
  log(state, 'hazard', say(state, 'hazardChases', {
    label: hazardConfig(state).label,
    name: best.player.name,
  }), { playerId: best.player.id });
  strike(state);
}

/** Ce que fait le pion hostile en arrivant sur une case. */
function strike(state) {
  dropHazard(state, state.hazardPawn.position);
}

/**
 * Fait jouer le pion hostile : un jet de son dé, puis son déplacement.
 * Les faces sont décrites par l'édition (`faces`) : un nombre de cases, ou
 * `'chase'` pour foncer sur la joueuse la plus proche.
 */
export function playHazardTurn(state, rng) {
  const cfg = hazardConfig(state);
  if (!cfg || !state.hazardPawn) return;
  const faces = cfg.faces ?? [1, 2, 3];
  const face = faces[rng.int(faces.length)];
  state.hazardPawn.lastRoll = face;

  if (face === 'chase') {
    chaseNearestPlayer(state);
    return;
  }
  advanceHazardPawn(state, Number(face) || 0);
}

/**
 * Une joueuse arrive sur une case piégée : elle paie la pénalité, sauf si son
 * camp désamorce en arrivant (`clearsHazardOnLand`).
 * @returns {boolean} true si la case était piégée (le loyer ne s'applique plus)
 */
export function resolveHazardOnLanding(state, playerId, spaceId) {
  if (!isHazarded(state, spaceId)) return false;
  const cfg = hazardConfig(state);
  const player = playerById(state, playerId);
  const faction = config(state).factions?.options?.find((f) => f.id === player.faction);

  if (faction?.clearsHazardOnLand) {
    delete state.hazards[spaceId];
    log(state, 'hazard', say(state, 'hazardDefused', { name: player.name, space: getSpace(state, spaceId).name }), {
      playerId,
      spaceId,
    });
    return true;
  }

  // Le piège se consomme sur celle qui le déclenche : elle encaisse le souffle,
  // la case redevient saine. Sans ça, rien ne nettoie jamais le plateau — les
  // pièges s'accumulaient jusqu'à verrouiller la moitié des cases et la
  // victoire « tout capturé » devenait inatteignable. La boîte dit la case
  // verrouillée « tant qu'elle n'est pas nettoyée » sans dire qui nettoie :
  // c'est notre lecture, notée dans CLAUDE.md.
  delete state.hazards[spaceId];

  const penalty = cfg.penalty ?? 0;
  if (penalty > 0) {
    log(state, 'hazard', say(state, 'hazardHits', {
      name: player.name,
      space: getSpace(state, spaceId).name,
      amount: amountText(state, penalty),
    }), { playerId, spaceId, amount: penalty });
    charge(state, playerId, penalty, say(state, 'reasonHazard'));
  }
  return true;
}
