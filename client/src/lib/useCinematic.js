/**
 * La mise en scène d'un tour.
 *
 * Le serveur envoie tout d'un coup : le jet, le déplacement, la case résolue.
 * Sans mise en scène, tout arrive en même temps et on ne voit rien. Ce hook
 * découpe l'arrivée en deux temps, comme sur une vraie table :
 *
 *   1. les dés roulent — le pion ne bouge pas encore ;
 *   2. les dés s'immobilisent — le pion part alors case par case.
 *
 * La détection se fait **pendant le rendu**, pas dans un effet : le rendu qui
 * apporte le résultat des dés est exactement celui où le pion doit déjà être
 * retenu. Le faire après coup laissait le pion partir avec un train d'avance.
 */
import { useEffect, useRef, useState } from 'react';

const ROLL_MS = 1100; // le temps que les dés roulent avant de se poser

export function useCinematic(state) {
  const values = state?.dice?.values ?? null;
  // La clé ne doit changer que pour un *nouveau lancer* — pas à chaque action qui
  // suit (achat, chat…), sans quoi les dés rejouent leur animation à chaque fois.
  const key = values ? `${state.dice.rollId ?? 0}` : null;

  const lastRoll = useRef(undefined);
  const until = useRef(0);
  const [, redraw] = useState(0);

  if (lastRoll.current === undefined) {
    // Premier rendu : on note ce qui est déjà à l'écran sans rien rejouer — une
    // reconnexion en pleine partie ne relance pas les dés du tour précédent.
    lastRoll.current = key;
  } else if (key && key !== lastRoll.current) {
    lastRoll.current = key;
    until.current = Date.now() + ROLL_MS;
  }

  const rolling = Date.now() < until.current;

  // Un dernier rendu à la fin du lancer, pour relâcher le pion.
  useEffect(() => {
    if (!rolling) return;
    const timer = setTimeout(() => redraw((n) => n + 1), until.current - Date.now() + 20);
    return () => clearTimeout(timer);
  }, [rolling, until.current]);

  return { rolling };
}
