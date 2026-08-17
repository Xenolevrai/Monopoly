/**
 * Générateur aléatoire déterministe (mulberry32).
 *
 * Le moteur ne touche jamais à `Math.random` : il reçoit un `rng` en paramètre.
 * En partie réelle on l'initialise avec une graine aléatoire ; dans les tests on
 * la fixe, ce qui rend chaque partie rejouable à l'identique.
 */
export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** Flottant dans [0, 1[ */
    next,
    /** Entier dans [0, max[ */
    int: (max) => Math.floor(next() * max),
    /** Mélange de Fisher-Yates, hors place */
    shuffle(list) {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/** Un dé à `sides` faces. */
export function rollDie(rng, sides = 6) {
  return rng.int(sides) + 1;
}

/** Lance `count` dés et renvoie leurs valeurs. */
export function rollDice(rng, count = 2, sides = 6) {
  return Array.from({ length: count }, () => rollDie(rng, sides));
}

/**
 * Crée un rng scripté à partir d'une liste de jets imposés.
 * Uniquement destiné aux tests : `scriptedRng([[3, 4], [2, 2]])`.
 */
export function scriptedRng(rolls) {
  const queue = rolls.flat();
  const fallback = createRng(1);
  return {
    ...fallback,
    int: (max) => (max === 6 && queue.length ? queue.shift() - 1 : fallback.int(max)),
  };
}
