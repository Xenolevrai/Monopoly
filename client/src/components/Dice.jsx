/**
 * Les dés : ils roulent vraiment avant de s'immobiliser sur le résultat.
 *
 * Le tirage vient du serveur — l'animation ne fait que le mettre en scène, donc
 * tout le monde voit le même résultat au même moment.
 */
import { useEffect, useState } from 'react';

const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const TUMBLE_MS = 70; // à quelle vitesse les faces défilent

function Die({ value, rolling, delay = 0 }) {
  const pips = PIPS[value] ?? [];
  return (
    <div
      className={`grid h-12 w-12 grid-cols-3 grid-rows-3 gap-0.5 rounded-lg border border-black/25 bg-white p-1.5 shadow-[0_4px_10px_-4px_rgba(0,0,0,.6)] ${
        rolling ? 'die-tumbling' : 'die-settle'
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={`rounded-full ${pips.includes(i) ? 'bg-ink' : 'bg-transparent'}`} />
      ))}
    </div>
  );
}

/**
 * @param {{ values: number[]|null, rolling: boolean }} props
 * `rolling` est piloté par la cinématique du tour : le pion ne part qu'une fois
 * les dés immobilisés.
 */
export default function Dice({ values, rolling = false }) {
  const [tumble, setTumble] = useState([1, 1]);
  const shown = values;

  // Les faces défilent tant que les dés roulent.
  useEffect(() => {
    if (!rolling) return;
    const tumbler = setInterval(
      () => setTumble([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]),
      TUMBLE_MS,
    );
    return () => clearInterval(tumbler);
  }, [rolling]);

  if (!shown) return <div className="h-12" />;

  const faces = rolling ? tumble : (shown ?? [1, 1]);
  const total = shown ? shown.reduce((a, b) => a + b, 0) : null;

  return (
    <div className="flex items-center gap-3">
      <Die value={faces[0]} rolling={rolling} />
      <Die value={faces[1]} rolling={rolling} delay={90} />
      <span
        className={`tabular font-condensed text-2xl transition-opacity duration-200 ${
          rolling ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {total ?? ''}
      </span>
    </div>
  );
}
