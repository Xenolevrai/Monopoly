/**
 * Le plateau, dans l'esprit du plateau papier : carton vert pâle, cases crème
 * cernées d'un filet noir, bandeaux de couleur pleins, et — comme sur la vraie
 * boîte — les textes orientés vers le centre selon le côté du plateau.
 */
import { useEffect, useRef, useState } from 'react';
import { board, gridPosition, groupColor, euros } from '../lib/board.js';
import { iconFor } from './SpaceIcons.jsx';
import TokenIcon from './TokenIcon.jsx';
import Dice from './Dice.jsx';

const STEP_MS = 90;

/** Rotation du contenu d'une case selon son côté, comme sur le plateau papier. */
const ROTATION = { bottom: 0, left: 90, top: 180, right: -90 };

/** Les mentions imprimées sous les quatre coins. */
const CORNER_NOTE = {
  0: 'Recevez 200 €',
  10: 'Simple visite',
  30: 'Sans passer par Départ',
};

/** Les pictogrammes de Chance et Caisse gardent leur couleur d'origine. */
const ICON_TINT = { chance: 'text-[var(--color-accent)]', community_chest: 'text-[#2f5c8f]' };

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

/** Un pion posé sur une case : la silhouette du joueur, dans sa couleur. */
function Pawn({ player, index, total }) {
  const offset = total > 1 ? (index - (total - 1) / 2) * 10 : 0;
  return (
    <span
      className="absolute bottom-0.5 left-1/2 transition-all duration-200"
      style={{ transform: `translateX(calc(-50% + ${offset}px))`, opacity: player.bankrupt ? 0.3 : 1 }}
      title={player.name}
    >
      <span
        className="flex h-[19px] w-[19px] items-center justify-center rounded-full border border-black/60"
        style={{ backgroundColor: '#fffdf7', boxShadow: '0 1px 3px rgb(0 0 0 / 0.5)' }}
      >
        <TokenIcon token={player.token} color={player.color} className="h-[15px] w-[15px]" title={player.name} />
      </span>
    </span>
  );
}

/** Maisons vertes et hôtel rouge, posés sur le bandeau de couleur. */
function Buildings({ prop }) {
  if (!prop) return null;
  if (prop.hotel) {
    return (
      <span className="flex items-center justify-center gap-0.5">
        <span className="h-[7px] w-[11px] rounded-[1px] border border-black/50 bg-[var(--color-hotel)]" />
      </span>
    );
  }
  if (prop.houses > 0) {
    return (
      <span className="flex items-center justify-center gap-[1.5px]">
        {Array.from({ length: prop.houses }).map((_, i) => (
          <span
            key={i}
            className="h-[6px] w-[5px] rounded-[1px] border border-black/50 bg-[var(--color-house)]"
          />
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
  const Icon = iconFor(space);
  const corner = space.corner;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(space.id)}
      style={{ gridColumn: col, gridRow: row, containerType: 'size' }}
      className={`space-tile relative overflow-hidden transition-[filter] hover:brightness-95 ${
        active ? 'space-active' : ''
      } ${space.type === 'go' ? 'text-[var(--color-accent)]' : ''}`}
    >
      {/* Le contenu tourne vers le centre du plateau ; il occupe la case
          « à l'endroit » grâce aux unités de conteneur (100cqh × 100cqw). */}
      <span
        className="absolute left-1/2 top-1/2 flex flex-col items-center"
        style={{
          width: corner ? '100cqw' : '100cqh',
          height: corner ? '100cqh' : '100cqw',
          transform: `translate(-50%, -50%) rotate(${corner ? 0 : ROTATION[side]}deg)`,
        }}
      >
        {color && (
          <span
            className="flex w-full shrink-0 items-end justify-center border-b border-black/80 pb-px"
            style={{ backgroundColor: color, height: '26%' }}
          >
            <Buildings prop={prop} />
          </span>
        )}

        <span className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center">
          {Icon && (
            <Icon
              className={`${corner ? 'h-7 w-7' : 'h-4 w-4'} ${ICON_TINT[space.type] ?? 'text-ink'}`}
            />
          )}
          <span
            className={`font-condensed uppercase leading-[1.05] ${
              space.type === 'go' ? 'text-[var(--color-accent)]' : 'text-ink'
            } ${
              corner ? 'text-[9px]' : 'text-[7.5px]'
            }`}
          >
            {space.shortName}
          </span>
          {CORNER_NOTE[space.id] && (
            <span className="font-condensed text-[7px] uppercase leading-tight text-ink-soft">
              {CORNER_NOTE[space.id]}
            </span>
          )}
          {space.price != null && (
            <span className="tabular font-condensed text-[7px] text-ink-soft">{space.price} €</span>
          )}
          {space.amount != null && (
            <span className="tabular font-condensed text-[7px] text-ink-soft">{space.amount} €</span>
          )}
          {prop?.mortgaged && (
            <span className="font-condensed text-[6.5px] uppercase text-[var(--color-accent)]">
              hypothéquée
            </span>
          )}
        </span>
      </span>

      {/* Liseré à la couleur de la propriétaire, autour de la case. */}
      {owner && (
        <span
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: `inset 0 0 0 2px ${owner.color}${prop.mortgaged ? '44' : 'cc'}` }}
        />
      )}

      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-5">
        {players.map((player, i) => (
          <Pawn key={player.id} player={player} index={i} total={players.length} />
        ))}
      </span>
    </button>
  );
}

/** Le centre du plateau : titre, dés, dernière carte piochée. */
function Center({ state, drawnCard }) {
  const current = state.players[state.currentPlayerIndex];
  return (
    <div
      style={{ gridColumn: '2 / 11', gridRow: '2 / 11' }}
      className="relative flex flex-col items-center justify-center gap-4 p-4"
    >
      {/* Le cartouche du titre, posé en diagonale comme sur le plateau. */}
      <div className="-rotate-[45deg]">
        <div className="border-y-2 border-ink bg-[var(--color-accent)] px-8 py-1.5 shadow-[0_3px_0_rgba(0,0,0,.35)]">
          <p className="font-condensed text-3xl uppercase tracking-[0.18em] text-[#f7f4ea]">Monopoly</p>
        </div>
        <p className="mt-1 text-center font-condensed text-[11px] uppercase tracking-[0.45em] text-ink-soft">
          Paris
        </p>
      </div>

      <div className="absolute bottom-5 left-1/2 flex w-full -translate-x-1/2 flex-col items-center gap-3 px-4">
        {state.phase === 'playing' && current && (
          <p className="font-condensed text-xs uppercase tracking-widest text-ink-soft">
            Au tour de <span style={{ color: current.color }}>{current.name}</span>
          </p>
        )}
        <Dice values={state.dice?.values} />
        {state.settings?.freeParkingPot && state.freeParkingPot > 0 && (
          <p className="tabular text-[11px] text-ink-soft">
            Cagnotte du Parc Gratuit :{' '}
            <span className="font-semibold text-[var(--color-money)]">{euros(state.freeParkingPot)}</span>
          </p>
        )}
      </div>

      {drawnCard && (
        <div
          className={`card-in absolute left-1/2 top-6 w-[min(62%,270px)] -translate-x-1/2 border-2 p-3 text-center shadow-[0_10px_24px_-12px_rgba(0,0,0,.7)] ${
            drawnCard.deck === 'chance'
              ? 'border-[var(--color-accent)] bg-[#fdf6f0]'
              : 'border-[#2f5c8f] bg-[#f2f6fb]'
          }`}
        >
          <p
            className={`mb-1 font-condensed text-sm uppercase tracking-[0.2em] ${
              drawnCard.deck === 'chance' ? 'text-[var(--color-accent)]' : 'text-[#2f5c8f]'
            }`}
          >
            {drawnCard.deck === 'chance' ? 'Chance' : 'Caisse de Communauté'}
          </p>
          <p className="text-xs leading-snug text-ink">{drawnCard.text}</p>
        </div>
      )}
    </div>
  );
}

export default function Board({ state, onSelectSpace, drawnCard }) {
  const positions = useAnimatedPositions(state.players);
  const activeSpace = state.players[state.currentPlayerIndex]?.position;

  return (
    <div className="board-surface aspect-square w-full max-w-[900px] shrink-0 p-1.5 xl:h-full xl:w-auto">
      {/* Les quatre coins sont plus grands que les cases de bord, comme sur le plateau papier. */}
      <div
        className="grid h-full w-full"
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
