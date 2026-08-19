/**
 * Le plateau, dans l'esprit du plateau papier : carton vert pâle, cases crème
 * cernées d'un filet noir, bandeaux de couleur pleins, et — comme sur la vraie
 * boîte — les textes orientés vers le centre selon le côté du plateau.
 */
import { boardOf, gridPosition, gridTemplate, groupColor, editionFor, money } from '../lib/board.js';
import { iconFor } from './SpaceIcons.jsx';
import Pawns from './Pawns.jsx';
import Dice from './Dice.jsx';

/** Rotation du contenu d'une case selon son côté, comme sur le plateau papier. */
const ROTATION = { bottom: 0, left: 90, top: 180, right: -90 };

/** Les mentions imprimées sous les quatre coins, dans la monnaie de l'édition. */
function cornerNote(state, id) {
  if (id === 0) return `Recevez ${money(state, editionFor(state).currency.goBonus)}`;
  if (id === 10) return 'Simple visite';
  if (id === 30) return 'Sans passer par Départ';
  return null;
}

/** Chance et Caisse de Communauté gardent leur couleur d'origine. */
const ICON_TINT = { chance: 'text-[var(--color-accent)]', community_chest: 'text-[#2f5c8f]' };

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

function Space({ space, state, active, onSelect }) {
  const { col, row, side } = gridPosition(state, space.id);
  const color = groupColor(state, space);
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
          {cornerNote(state, space.id) && (
            <span className="font-condensed text-[7px] uppercase leading-tight text-ink-soft">
              {cornerNote(state, space.id)}
            </span>
          )}
          {space.price != null && (
            <span className="tabular font-condensed text-[7px] text-ink-soft">
              {money(state, space.price)}
            </span>
          )}
          {space.amount != null && (
            <span className="tabular font-condensed text-[7px] text-ink-soft">
              {money(state, space.amount)}
            </span>
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
    </button>
  );
}

/**
 * Les deux tas de cartes, posés au centre comme sur le plateau.
 * Quand c'est à nous de piocher, le tas concerné s'anime et devient cliquable.
 */
function CardPiles({ state, canDraw, deckToDraw, onDraw }) {
  const decks = editionFor(state).theming?.decks ?? {};
  const piles = [
    { id: 'chance', tilt: -4, ...decks.chance },
    { id: 'community_chest', tilt: 3, ...decks.community_chest },
  ];

  return (
    <div className="flex items-start gap-6">
      {piles.map((pile) => {
        const mine = canDraw && deckToDraw === pile.id;
        return (
          <button
            key={pile.id}
            type="button"
            disabled={!mine}
            onClick={() => mine && onDraw(pile.id)}
            className={`relative block ${mine ? 'cursor-pointer pile-ready' : 'cursor-default'}`}
            style={{ transform: `rotate(${pile.tilt}deg)` }}
            title={mine ? `Piocher une carte ${pile.label}` : pile.label}
          >
            {/* Les cartes du dessous, pour l'épaisseur du tas. */}
            <span className="absolute left-1 top-1 h-full w-full rounded border-2 border-ink/60 bg-white/70" />
            <span className="absolute left-0.5 top-0.5 h-full w-full rounded border-2 border-ink/70 bg-white/85" />
            <span
              className="relative flex h-[74px] w-[54px] flex-col items-center justify-center gap-1 rounded border-2 border-ink text-center"
              style={{ backgroundColor: pile.color }}
            >
              <span className="font-condensed text-[26px] leading-none text-white">
                {pile.id === 'chance' ? '?' : '▤'}
              </span>
              <span className="px-1 font-condensed text-[7px] uppercase leading-tight text-white/95">
                {pile.label}
              </span>
            </span>
            {mine && (
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-condensed text-[10px] uppercase text-[var(--color-accent)]">
                Piochez !
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Le centre du plateau : titre, tas de cartes, dés, carte retournée. */
function Center({ state, drawnCard, rolling, canDraw, deckToDraw, onDraw, revealed, onAcknowledge }) {
  const current = state.players[state.currentPlayerIndex];
  return (
    <div
      style={{ gridColumn: '2 / 11', gridRow: '2 / 11' }}
      className="relative flex flex-col items-center justify-center gap-4 p-4"
    >
      {/* Le cartouche du titre, posé en diagonale comme sur le plateau.
          Il s'efface quand une carte est retournée, pour ne pas dépasser derrière. */}
      <div
        className="-rotate-[45deg] transition-opacity duration-200"
        style={{ opacity: drawnCard ? 0 : 1 }}
      >
        <div className="border-y-2 border-ink bg-[var(--color-accent)] px-8 py-1.5 shadow-[0_3px_0_rgba(0,0,0,.35)]">
          <p className="font-condensed text-3xl uppercase tracking-[0.18em] text-[#f7f4ea]">
            {editionFor(state).theming?.centerTitle ?? 'Monopoly'}
          </p>
        </div>
        <p className="mt-1 text-center font-condensed text-[11px] uppercase tracking-[0.45em] text-ink-soft">
          {editionFor(state).theming?.centerSubtitle ?? ''}
        </p>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <CardPiles state={state} canDraw={canDraw} deckToDraw={deckToDraw} onDraw={onDraw} />
      </div>

      <div className="absolute bottom-5 left-1/2 flex w-full -translate-x-1/2 flex-col items-center gap-3 px-4">
        {state.phase === 'playing' && current && (
          <p className="font-condensed text-xs uppercase tracking-widest text-ink-soft">
            Au tour de <span style={{ color: current.color }}>{current.name}</span>
          </p>
        )}
        <Dice values={state.dice?.values} rolling={rolling} />
        {state.settings?.freeParkingPot && state.freeParkingPot > 0 && (
          <p className="tabular text-[11px] text-ink-soft">
            Cagnotte du Parc Gratuit :{' '}
            <span className="font-semibold text-[var(--color-money)]">{money(state, state.freeParkingPot)}</span>
          </p>
        )}
      </div>

      {drawnCard && (
        <div
          className="card-flip absolute left-1/2 top-1/2 w-[min(70%,320px)] -translate-x-1/2 -translate-y-1/2 border-[3px] bg-[#fdfaf4] p-4 text-center shadow-[0_18px_40px_-16px_rgba(0,0,0,.8)]"
          style={{ borderColor: editionFor(state).theming?.decks?.[drawnCard.deck]?.color }}
        >
          <p
            className="mb-2 font-condensed text-base uppercase tracking-[0.2em]"
            style={{ color: editionFor(state).theming?.decks?.[drawnCard.deck]?.color }}
          >
            {editionFor(state).theming?.decks?.[drawnCard.deck]?.label ?? drawnCard.deck}
          </p>
          <p className="text-sm leading-snug text-ink">{drawnCard.text}</p>
          {revealed && (
            <button
              type="button"
              onClick={onAcknowledge}
              className="mt-3 w-full rounded bg-[var(--color-accent)] py-2 font-condensed text-sm uppercase tracking-wide text-white hover:bg-[var(--color-accent-deep)]"
            >
              J'applique
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Board({
  state,
  onSelectSpace,
  drawnCard,
  rolling = false,
  canDraw = false,
  deckToDraw = null,
  onDraw,
  revealed = false,
  onAcknowledge,
}) {
  const activeSpace = state.players[state.currentPlayerIndex]?.position;

  return (
    <div className="board-surface aspect-square w-full max-w-[900px] shrink-0 p-1.5 xl:h-full xl:w-auto">
      {/* Les quatre coins sont plus grands que les cases de bord, comme sur le plateau papier. */}
      <div
        className="relative grid h-full w-full"
        style={{ gridTemplateColumns: gridTemplate(state), gridTemplateRows: gridTemplate(state) }}
      >
        {boardOf(state).map((space) => (
          <Space
            key={space.id}
            space={space}
            state={state}
            active={space.id === activeSpace}
            onSelect={onSelectSpace}
          />
        ))}
        <Center
          state={state}
          drawnCard={drawnCard}
          rolling={rolling}
          canDraw={canDraw}
          deckToDraw={deckToDraw}
          onDraw={onDraw}
          revealed={revealed}
          onAcknowledge={onAcknowledge}
        />
        <Pawns state={state} players={state.players} hold={rolling} />
      </div>
    </div>
  );
}
