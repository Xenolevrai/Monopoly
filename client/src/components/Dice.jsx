/** Deux dés blancs, avec une courte rotation avant l'affichage du résultat. */
import { useEffect, useState } from 'react';

const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, rolling }) {
  const pips = PIPS[value] ?? [];
  return (
    <div
      className={`grid h-11 w-11 grid-cols-3 grid-rows-3 gap-0.5 rounded-lg bg-parchment p-1.5 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.9)] ${
        rolling ? 'die-rolling' : ''
      }`}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className={`rounded-full ${pips.includes(i) ? 'bg-night' : 'bg-transparent'}`}
        />
      ))}
    </div>
  );
}

export default function Dice({ values }) {
  const [rolling, setRolling] = useState(false);
  const [shown, setShown] = useState(values);
  const key = values?.join('-') ?? '';

  // À chaque nouveau jet reçu du serveur, on fait tourner les dés un instant.
  // Le début d'un tour remet `values` à null : on garde alors le dernier jet à
  // l'écran plutôt que de laisser un trou au centre du plateau.
  useEffect(() => {
    if (!values) return;
    setRolling(true);
    const timer = setTimeout(() => {
      setRolling(false);
      setShown(values);
    }, 550);
    return () => clearTimeout(timer);
  }, [key]);

  if (!shown && !values) return <div className="h-11" />;

  const total = shown ? shown.reduce((a, b) => a + b, 0) : null;

  return (
    <div className="flex items-center gap-3">
      <Die value={rolling ? 1 + ((Date.now() / 90) % 6 | 0) : shown?.[0]} rolling={rolling} />
      <Die value={rolling ? 1 + ((Date.now() / 70) % 6 | 0) : shown?.[1]} rolling={rolling} />
      {!rolling && total != null && (
        <span className="tabular font-display text-2xl text-gold-soft">{total}</span>
      )}
    </div>
  );
}
