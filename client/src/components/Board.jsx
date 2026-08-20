/**
 * Le plateau, dans l'esprit du plateau papier : carton vert pâle, cases crème
 * cernées d'un filet noir, bandeaux de couleur pleins, et — comme sur la vraie
 * boîte — les textes orientés vers le centre selon le côté du plateau.
 */
import { boardOf, gridPosition, gridTemplate, gridSize, groupColor, editionFor, money } from '../lib/board.js';
import { iconFor } from './SpaceIcons.jsx';
import { artFor } from './SpaceArt.jsx';
import { translator } from '../lib/i18n.js';
import { PaperGrain, BoardWatermark, BoardFrame, BoardVignette } from './BoardSkin.jsx';
import Centerpiece from './Centerpiece.jsx';
import Pawns from './Pawns.jsx';
import Dice from './Dice.jsx';

/** Rotation du contenu d'une case selon son côté, comme sur le plateau papier. */
const ROTATION = { bottom: 0, left: 90, top: 180, right: -90 };

/** Les mentions imprimées sous les quatre coins, dans la monnaie de l'édition. */
function cornerNote(state, id) {
  const t = translator(state.locale);
  const board = editionFor(state).board;
  if (board[id]?.type === 'go') return t('collect', money(state, editionFor(state).currency.goBonus));
  if (board[id]?.type === 'jail') return t('justVisiting');
  if (board[id]?.type === 'go_to_jail') return t('notPassingGo');
  return null;
}

/**
 * Un nom trop long pour la largeur d'une case s'imprime plus petit — c'est ce
 * que fait le plateau papier. Sans ça, `break-words` coupe au milieu d'un mot
 * et l'on obtient « HONEYDU / KES ». On se règle sur le mot le plus long : huit
 * lettres tiennent à la taille nominale, au-delà on réduit d'autant — c'est la
 * limite mesurée sur un téléphone, où la case ne fait plus que vingt-cinq
 * points de large une fois les marges retirées.
 */
function nameScale(name) {
  const longest = Math.max(...name.split(/\s+/).map((word) => word.length));
  // Deux contraintes : la largeur (le mot le plus long doit tenir sur une ligne)
  // et la hauteur (« CHAMBRE DES SECRETS » prend trois lignes et chassait le prix
  // hors de la case). On retient la plus sévère des deux.
  const byWidth = longest <= 8 ? 1 : 8 / longest;
  const byHeight = name.length <= 15 ? 1 : 15 / name.length;
  return Math.max(0.6, Math.min(byWidth, byHeight));
}

/** Les cases « pile » prennent la couleur que l'édition donne à leur paquet. */
function deckTint(state, type) {
  return editionFor(state).theming?.decks?.[type]?.color ?? null;
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

function Space({ space, state, active, onSelect }) {
  const { col, row, side } = gridPosition(state, space.id);
  const color = groupColor(state, space);
  const prop = state.properties?.[space.id];
  const owner = prop?.ownerId ? state.players.find((p) => p.id === prop.ownerId) : null;
  // L'illustration propre à la case prime sur le pictogramme de son type :
  // c'est elle qui fait reconnaître un lieu d'un coup d'œil.
  const edition = editionFor(state);
  const Icon = artFor(edition, space) ?? iconFor(edition, space);
  const corner = space.corner;
  const vertical = !corner && (side === 'left' || side === 'right');

  return (
    <button
      type="button"
      onClick={() => onSelect?.(space.id)}
      style={{ gridColumn: col, gridRow: row, containerType: 'size' }}
      className={`space-tile relative overflow-hidden transition-[filter] hover:brightness-95 ${
        active ? 'space-active' : ''
      } ${space.type === 'go' ? 'text-[var(--color-accent)]' : ''}`}
    >
      {/* Le contenu tourne vers le centre du plateau. Seules les cases des deux
          côtés (rotation d'un quart de tour) échangent leurs dimensions : à 0°
          comme à 180°, la case garde sa largeur, et l'échanger débordait le nom
          d'un bon tiers — c'est ce qui coupait « HIBOU EXPRESS » en haut et
          « TÊTE DE SANGLIER » en bas.

          La taille du texte se règle ici une fois pour toutes, en fraction de
          la largeur utile ; les enfants s'expriment ensuite en `em`. */}
      <span
        className="absolute left-1/2 top-1/2 flex flex-col items-center"
        style={{
          width: vertical ? '100cqh' : '100cqw',
          height: vertical ? '100cqw' : '100cqh',
          transform: `translate(-50%, -50%) rotate(${corner ? 0 : ROTATION[side]}deg)`,
          fontSize: corner
            ? 'clamp(6px, 13cqw, 11px)'
            : vertical
              ? 'clamp(6px, 17cqh, 10px)'
              : 'clamp(6px, 17cqw, 10px)',
        }}
      >
        {color && (
          <span
            className="color-band flex w-full shrink-0 items-end justify-center border-b border-black/80 pb-px"
            style={{ backgroundColor: color, height: '26%' }}
          >
            <Buildings prop={prop} />
          </span>
        )}

        <span className="flex w-full flex-1 flex-col items-center justify-center gap-0.5 px-[4%] text-center">
          {Icon && (
            <Icon
              className={`${corner ? 'w-[32%]' : 'w-[40%] min-w-4'} aspect-square h-auto text-ink`}
              style={
                !artFor(edition, space) && deckTint(state, space.type)
                  ? { color: deckTint(state, space.type) }
                  : undefined
              }
            />
          )}
          <span
            className={`w-full break-words font-condensed uppercase leading-[1.05] ${
              space.type === 'go' ? 'text-[var(--color-accent)]' : 'text-ink'
            }`}
            style={{ fontSize: `${nameScale(space.shortName)}em`, letterSpacing: '-0.01em' }}
          >
            {space.shortName}
          </span>
          {cornerNote(state, space.id) && (
            <span
              className="w-full break-words font-condensed uppercase leading-tight text-ink-soft"
              style={{ fontSize: '0.82em' }}
            >
              {cornerNote(state, space.id)}
            </span>
          )}
          {space.price != null && (
            <span
              className="tabular font-condensed text-ink-soft"
              style={{ fontSize: '0.82em' }}
            >
              {money(state, space.price)}
            </span>
          )}
          {space.amount != null && (
            <span
              className="tabular font-condensed text-ink-soft"
              style={{ fontSize: '0.82em' }}
            >
              {money(state, space.amount)}
            </span>
          )}
          {prop?.mortgaged && (
            <span
              className="font-condensed uppercase text-[var(--color-accent)]"
              style={{ fontSize: '0.75em' }}
            >
              {translator(state.locale)('mortgaged')}
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
  // Certaines éditions fusionnent Chance et Caisse en une seule pile : on
  // n'affiche que les paquets réellement déclarés, sans tas fantôme.
  const decks = editionFor(state).theming?.decks ?? {};
  const piles = Object.entries(decks).map(([id, deck], i) => ({ id, tilt: i === 0 ? -4 : 3, ...deck }));

  return (
    <div className="flex items-start gap-[4cqw]">
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
            title={pile.label}
          >
            {/* Les cartes du dessous, pour l'épaisseur du tas. */}
            <span className="absolute left-[0.5cqw] top-[0.5cqw] h-full w-full rounded border-2 border-black/25 bg-white/70" />
            <span className="absolute left-[0.25cqw] top-[0.25cqw] h-full w-full rounded border-2 border-black/30 bg-white/85" />
            <span
              className="relative flex flex-col items-center justify-center gap-[0.6cqw] rounded border-2 border-ink text-center"
              style={{ backgroundColor: pile.color, width: '8.4cqw', height: '11.5cqw' }}
            >
              <span
                className="font-condensed leading-none text-white"
                style={{ fontSize: 'clamp(11px, 4cqw, 26px)' }}
              >
                {pile.glyph ?? '?'}
              </span>
              <span
                className="px-[0.4cqw] font-condensed uppercase leading-tight text-white/95"
                style={{ fontSize: 'clamp(4px, 1.15cqw, 7px)' }}
              >
                {pile.label}
              </span>
            </span>
            {mine && (
              <span className="absolute -bottom-[3.4cqw] left-1/2 -translate-x-1/2 whitespace-nowrap font-condensed uppercase text-[var(--color-accent)]"
                style={{ fontSize: 'clamp(6px, 1.7cqw, 10px)' }}>
                {translator(state.locale)('drawNow')}
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
      style={{ gridColumn: `2 / ${gridSize(state)}`, gridRow: `2 / ${gridSize(state)}` }}
      className="relative flex flex-col items-center justify-center gap-4 p-4"
    >
      {/* La pièce maîtresse de l'édition. Elle s'efface quand une carte est
          retournée, pour ne pas dépasser derrière. */}
      <div className="flex w-full justify-center transition-opacity duration-200" style={{ opacity: drawnCard ? 0 : 1 }}>
        <Centerpiece
          skin={editionFor(state).theming?.skin ?? 'table'}
          title={editionFor(state).theming?.centerTitle ?? 'Monopoly'}
          subtitle={editionFor(state).theming?.centerSubtitle ?? ''}
        />
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <CardPiles state={state} canDraw={canDraw} deckToDraw={deckToDraw} onDraw={onDraw} />
      </div>

      <div className="absolute bottom-5 left-1/2 flex w-full -translate-x-1/2 flex-col items-center gap-3 px-4">
        {/* Une pastille claire : le nom reste lisible même sur un plateau
            sombre, et la couleur de la joueuse reste identifiable. */}
        {state.phase === 'playing' && current && (
          <p className="flex items-center gap-1.5 rounded-full border border-black/15 bg-[var(--color-space)] px-[2cqw] py-[0.6cqw] font-condensed uppercase tracking-widest text-ink"
            style={{ fontSize: 'clamp(7px, 1.9cqw, 12px)' }}>
            {translator(state.locale)('turnOf')}
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-full border border-black/30"
                style={{ backgroundColor: current.color }}
              />
              {current.name}
            </span>
          </p>
        )}
        <Dice values={state.dice?.values} rolling={rolling} />
        {state.settings?.freeParkingPot && state.freeParkingPot > 0 && (
          <p className="tabular text-[11px] opacity-80" style={{ color: 'var(--color-board-ink)' }}>
            {state.locale === 'en' ? 'Free Parking pot:' : 'Cagnotte du Parc Gratuit :'}{' '}
            <span className="font-semibold text-[var(--color-money)]">{money(state, state.freeParkingPot)}</span>
          </p>
        )}
      </div>

      {drawnCard && (
        (() => {
          // Une Beuglante ne se lit pas comme un courrier ordinaire : elle
          // hurle. On la sort en rouge, quel que soit le paquet dont elle vient.
          const howler = drawnCard.variant === 'howler';
          const deck = editionFor(state).theming?.decks?.[drawnCard.deck];
          const tint = howler ? '#a01b1b' : deck?.color;
          return (
        <div
          className={`card-flip absolute left-1/2 top-1/2 w-[min(70%,320px)] -translate-x-1/2 -translate-y-1/2 border-[3px] p-4 text-center shadow-[0_18px_40px_-16px_rgba(0,0,0,.8)] ${
            howler ? 'bg-[#fdeaea]' : 'bg-[#fdfaf4]'
          }`}
          style={{ borderColor: tint }}
        >
          <p
            className="mb-2 font-condensed text-base uppercase tracking-[0.2em]"
            style={{ color: tint }}
          >
            {howler ? (state.locale === 'en' ? 'Howler' : 'Beuglante') : (deck?.label ?? drawnCard.deck)}
          </p>
          {/* La carte pose son propre fond crème, indépendant du thème : son
              encre doit donc l'être aussi. Utiliser `text-ink` la rendait
              invisible sur les plateaux sombres, où cette variable est claire
              — du crème sur du crème, exactement le défaut signalé. */}
          <p className="text-sm leading-snug" style={{ color: howler ? '#3d0c0c' : '#16130f' }}>
            {drawnCard.text}
          </p>
          {revealed && (
            <button
              type="button"
              onClick={onAcknowledge}
              className="mt-3 w-full rounded bg-[var(--color-accent)] py-2 font-condensed text-sm uppercase tracking-wide text-white hover:bg-[var(--color-accent-deep)]"
            >
              {translator(state.locale)('applyCard')}
            </button>
          )}
        </div>
          );
        })()
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
  const skin = editionFor(state).theming?.skin ?? 'table';

  return (
    <div className={`board-surface board-${skin} relative aspect-square w-full max-w-[900px] shrink-0 overflow-hidden p-1.5 xl:h-full xl:w-auto`}>
      {/* Le décor : filigrane sous les cases, grain de papier, cadre, vignetage. */}
      <BoardWatermark skin={skin} />
      {skin === 'parchment' && <PaperGrain opacity={0.42} scale={0.9} />}
      <BoardVignette />
      <BoardFrame skin={skin} />

      {/* Les quatre coins sont plus grands que les cases de bord, comme sur le plateau papier. */}
      <div
        className="relative grid h-full w-full"
        style={{
          gridTemplateColumns: gridTemplate(state),
          gridTemplateRows: gridTemplate(state),
          // Les tas de cartes, les dés et le cartouche se mesurent en `cqw` :
          // sur un téléphone, tout rétrécit avec le plateau au lieu de l'écraser.
          containerType: 'size',
        }}
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
