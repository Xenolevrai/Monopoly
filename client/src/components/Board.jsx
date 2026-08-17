/**
 * Le plateau : grille 11 × 11, quatre grands coins, bandeaux de couleur
 * lumineux sur ardoise. Les pions se déplacent case par case.
 */
import { useEffect, useRef, useState } from 'react';
import { board, gridPosition, groupColor, euros } from '../lib/board.js';
import Dice from './Dice.jsx';

const STEP_MS = 90;

/** Fait avancer chaque pion case par case jusqu'à sa position réelle. */
function useAnimatedPositions(players) {
  const [positions, setPositions] = useState(() =>
    Object.fromEntries(players.map((p) => [p.id, p.position])),
  );
  const timers = useRef({});

  useEffect(() => {
    for (const player of players) {
      const shown = positions[player.id];
      if (shown === undefined) {
        setPositions((prev) => ({ ...prev, [player.id]: player.position }));
        continue;
      }
      if (shown === player.position || timers.current[player.id]) continue;

      timers.current[player.id] = setInterval(() => {
        setPositions((prev) => {
          const current = prev[player.id];
          const target = player.position;
          if (current === target) {
            clearInterval(timers.current[player.id]);
            delete timers.current[player.id];
            return prev;
          }
          // Un saut « en arrière » (carte Reculez, prison) se fait d'un coup :
          // avancer 37 cases pour reculer de 3 serait absurde à regarder.
          const forward = (target - current + 40) % 40;
          const next = forward > 0 && forward <= 12 ? (current + 1) % 40 : target;
          return { ...prev, [player.id]: next };
        });
      }, STEP_MS);
    }
    return () => {};
  }, [players.map((p) => `${p.id}:${p.position}`).join(',')]);

  useEffect(() => () => Object.values(timers.current).forEach(clearInterval), []);

  return positions;
}

function Token({ player, index, total }) {
  // Plusieurs pions sur une case : on les décale en éventail.
  const offset = total > 1 ? (index - (total - 1) / 2) * 9 : 0;
  return (
    <span
      className="absolute bottom-1 left-1/2 h-3.5 w-3.5 rounded-full border border-white/70 transition-all duration-200"
      style={{
        backgroundColor: player.color,
        transform: `translateX(calc(-50% + ${offset}px))`,
        boxShadow: `0 0 10px ${player.color}, 0 2px 4px rgb(0 0 0 / 0.6)`,
        opacity: player.bankrupt ? 0.25 : 1,
      }}
      title={player.name}
    />
  );
}

function Buildings({ prop }) {
  if (!prop) return null;
  if (prop.hotel) {
    return <span className="absolute right-0.5 top-0.5 text-[9px] leading-none text-gold-soft">▮</span>;
  }
  if (prop.houses > 0) {
    return (
      <span className="absolute right-0.5 top-0.5 flex gap-px">
        {Array.from({ length: prop.houses }).map((_, i) => (
          <span key={i} className="h-1 w-1 rounded-[1px] bg-emerald-400" />
        ))}
      </span>
    );
  }
  return null;
}

function Space({ space, state, players, active, onSelect }) {
  const { col, row, side } = gridPosition(space.id);
  const color = groupColor(space);
  const prop = state.properties?.[space.id];
  const owner = prop?.ownerId ? state.players.find((p) => p.id === prop.ownerId) : null;
  const corner = space.corner;

  const bandVertical = side === 'left' || side === 'right';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(space.id)}
      style={{ gridColumn: col, gridRow: row }}
      className={`relative flex select-none flex-col items-center justify-center overflow-hidden rounded-[3px] border border-white/5 bg-slate-space p-0.5 text-center transition-colors hover:bg-white/10 ${
        active ? 'space-active' : ''
      }`}
    >
      {color && (
        <span
          className={`absolute ${bandVertical ? 'inset-y-0 w-1.5' : 'inset-x-0 h-1.5'} ${
            side === 'right' ? 'left-0' : side === 'left' ? 'right-0' : side === 'top' ? 'bottom-0' : 'top-0'
          }`}
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}88` }}
        />
      )}

      {/* Liseré à la couleur de la propriétaire. */}
      {owner && (
        <span
          className="pointer-events-none absolute inset-0 rounded-[3px]"
          style={{ boxShadow: `inset 0 0 0 1.5px ${owner.color}${prop.mortgaged ? '55' : 'dd'}` }}
        />
      )}

      <span
        className={`px-0.5 leading-tight text-parchment/85 ${
          corner ? 'font-display text-[11px] tracking-wide' : 'text-[7.5px]'
        }`}
      >
        {space.shortName}
      </span>
      {space.price != null && !corner && (
        <span className="tabular text-[7px] text-muted">{space.price} €</span>
      )}
      {prop?.mortgaged && (
        <span className="text-[6.5px] uppercase tracking-wide text-amber-400/80">hypo.</span>
      )}

      <Buildings prop={prop} />

      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-4">
        {players.map((player, i) => (
          <Token key={player.id} player={player} index={i} total={players.length} />
        ))}
      </span>
    </button>
  );
}

/** Le centre du plateau : logo, dés, dernière carte piochée. */
function Center({ state, drawnCard }) {
  const current = state.players[state.currentPlayerIndex];
  return (
    <div
      style={{ gridColumn: '2 / 11', gridRow: '2 / 11' }}
      className="relative flex flex-col items-center justify-center gap-4 rounded-lg bg-slate-board/60 p-4"
    >
      <div className="flex flex-col items-center gap-1">
        {/* Monogramme original, dessiné en SVG (aucun visuel de marque repris). */}
        <svg viewBox="0 0 64 64" className="h-12 w-12" aria-hidden="true">
          <rect
            x="16"
            y="16"
            width="32"
            height="32"
            transform="rotate(45 32 32)"
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="1.5"
          />
          <text
            x="32"
            y="41"
            textAnchor="middle"
            fontFamily="Cormorant Garamond, serif"
            fontSize="28"
            fill="var(--color-gold-soft)"
          >
            M
          </text>
        </svg>
        <h1 className="font-display text-2xl tracking-[0.3em] text-gold-soft">MONOPOLY</h1>
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">Paris</p>
      </div>

      {state.phase === 'playing' && current && (
        <p className="text-xs text-muted">
          Au tour de <span style={{ color: current.color }}>{current.name}</span>
        </p>
      )}

      <Dice values={state.dice?.values} rolling={false} />

      {drawnCard && (
        <div className="card-in max-w-[260px] rounded-md border border-gold/30 bg-night-soft/90 p-3 text-center">
          <p className="mb-1 font-display text-sm tracking-widest text-gold-soft">
            {drawnCard.deck === 'chance' ? 'CHANCE' : 'CAISSE DE COMMUNAUTÉ'}
          </p>
          <p className="text-xs leading-snug text-parchment/90">{drawnCard.text}</p>
        </div>
      )}

      {state.settings?.freeParkingPot && state.freeParkingPot > 0 && (
        <p className="tabular text-[11px] text-muted">
          Cagnotte du Parc Gratuit : <span className="text-gold-soft">{euros(state.freeParkingPot)}</span>
        </p>
      )}
    </div>
  );
}

export default function Board({ state, onSelectSpace, drawnCard }) {
  const positions = useAnimatedPositions(state.players);
  const activeSpace = state.players[state.currentPlayerIndex]?.position;

  return (
    <div className="gilt aspect-square w-full max-w-[900px] shrink-0 rounded-xl bg-slate-board p-2 xl:h-full xl:w-auto">
      {/* Les quatre coins sont plus grands que les cases de bord, comme sur le plateau papier. */}
      <div
        className="grid h-full w-full gap-px"
        style={{
          gridTemplateColumns: '1.55fr repeat(9, 1fr) 1.55fr',
          gridTemplateRows: '1.55fr repeat(9, 1fr) 1.55fr',
        }}
      >
        {board.map((space) => (
          <Space
            key={space.id}
            space={space}
            state={state}
            active={space.id === activeSpace}
            players={state.players.filter((p) => positions[p.id] === space.id)}
            onSelect={onSelectSpace}
          />
        ))}
        <Center state={state} drawnCard={drawnCard} />
      </div>
    </div>
  );
}
