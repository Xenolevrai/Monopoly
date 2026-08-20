/**
 * Où tombe-t-on vraiment, sur ce plateau-là ?
 *
 * C'est le socle de toute la stratégie du Monopoly : les cases ne sont pas
 * visitées à égalité. La prison aspire les pions (case « allez en prison »,
 * cartes, trois doubles), et tout ce qui se trouve à six ou huit cases de la
 * sortie est donc sur-visité — c'est ce qui rend l'orange plus rentable que le
 * bleu foncé, malgré des loyers trois fois moindres.
 *
 * On ne code pas cette table en dur : elle serait fausse dès qu'une édition
 * déplace la prison, ou qu'une extension transforme les cases taxes en « allez
 * en prison ». On la **mesure sur le plateau réellement joué**, par une marche
 * aléatoire, puis on la garde en cache. Le bot découvre donc tout seul que
 * l'orange est bon au classique, et que ce n'est plus vrai ailleurs.
 */
import { boardOf } from '../../shared/index.js';

const CACHE = new Map();

/** Signature d'un plateau : ce qui change la carte des probabilités. */
function signature(state) {
  const board = boardOf(state);
  const jail = board.findIndex((s) => s.type === 'jail');
  const traps = board.filter((s) => s.type === 'go_to_jail' || s.type === 'super_jail').map((s) => s.id);
  return `${board.length}:${jail}:${traps.join(',')}:${state.editionId}:${(state.extensionIds ?? []).join(',')}`;
}

/**
 * Fréquence relative de visite de chaque case, normalisée (sa somme fait 1).
 *
 * Marche aléatoire à deux dés avec les règles qui déforment la carte : les
 * cases qui envoient en prison, et les trois doubles. On ignore volontairement
 * les cartes qui déplacent — elles affinent à la marge, mais demanderaient de
 * rejouer le moteur entier ici.
 */
export function landingOdds(state) {
  const key = signature(state);
  if (CACHE.has(key)) return CACHE.get(key);

  const board = boardOf(state);
  const size = board.length;
  const jailSpace = board.findIndex((s) => s.type === 'jail');
  const visits = new Array(size).fill(0);

  // Générateur dédié, à graine fixe : la carte des probabilités doit être la
  // même à chaque partie, sinon deux bots identiques ne joueraient pas pareil.
  let seed = 987654321;
  const roll = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 6) + 1;
  };

  let position = 0;
  let doubles = 0;
  const STEPS = 400000;
  for (let i = 0; i < STEPS; i++) {
    const a = roll();
    const b = roll();
    doubles = a === b ? doubles + 1 : 0;

    if (doubles === 3) {
      position = jailSpace >= 0 ? jailSpace : 0;
      doubles = 0;
    } else {
      position = (position + a + b) % size;
      const type = board[position].type;
      if (type === 'go_to_jail' || type === 'super_jail') {
        visits[position] += 1; // on y est passé, même si l'on n'y reste pas
        position = jailSpace >= 0 ? jailSpace : 0;
      }
    }
    visits[position] += 1;
  }

  const total = visits.reduce((sum, n) => sum + n, 0);
  const odds = visits.map((n) => n / total);
  CACHE.set(key, odds);
  return odds;
}

/**
 * Ce qu'une case rapporte en moyenne par tour de plateau d'une adversaire,
 * à un niveau de construction donné : la fréquence de visite multipliée par le
 * loyer. C'est la vraie mesure de la valeur d'un terrain — celle qui explique
 * qu'on préfère trois maisons oranges à un hôtel bleu foncé.
 */
export function expectedRent(state, spaceId, rent) {
  return landingOdds(state)[spaceId] * rent;
}
