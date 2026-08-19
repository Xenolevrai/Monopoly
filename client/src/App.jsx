import { useEffect, useRef, useState } from 'react';
import { useGame } from './lib/useGame.js';
import { useCinematic } from './lib/useCinematic.js';
import { useEditionTheme } from './lib/theme.js';
import { sendAction } from './lib/socket.js';
import { Home, WaitingRoom, GameMenu } from './components/Lobby.jsx';
import Board from './components/Board.jsx';
import Players from './components/Players.jsx';
import Actions from './components/Actions.jsx';
import Feed from './components/Feed.jsx';
import TradeDialog from './components/TradeDialog.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import GameOver from './components/GameOver.jsx';
import { PropertyCard } from './components/Actions.jsx';
import { editionFor } from './lib/board.js';
import { useT } from './lib/i18n.js';

function allCardsOf(state) {
  const cards = editionFor(state).cards;
  return Object.fromEntries(
    Object.entries(cards).flatMap(([deck, list]) => list.map((card) => [card.id, { ...card, deck }])),
  );
}

/**
 * Les onglets du bas, sur téléphone uniquement.
 *
 * Le plateau remplit l'écran d'un mobile : sans onglets, il faudrait le faire
 * défiler en entier à chaque tour pour atteindre les boutons. Sur ordinateur,
 * tout reste côte à côte et cette barre disparaît.
 */
function MobileTabs({ tab, onChange, waiting, t }) {
  // Le plateau et les boutons vivent dans le même onglet : on lance les dés, on
  // voit où l'on tombe, on achète et on paie sans jamais changer d'écran.
  const tabs = [
    ['jeu', t('tabPlay')],
    ['profil', t('tabProfile')],
    ['journal', t('tabLog')],
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-black/25 bg-[var(--color-panel)] pb-[env(safe-area-inset-bottom)] xl:hidden"
      aria-label="Sections"
    >
      {tabs.map(([id, label]) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex-1 py-3 font-condensed text-[12px] uppercase tracking-wide transition-colors ${
              active ? 'bg-[var(--color-accent)] text-white' : 'text-ink-soft'
            }`}
          >
            {label}
            {/* La pastille signale qu'on attend une décision de ce poste. */}
            {id === 'jeu' && waiting && !active && (
              <span className="absolute left-1/2 top-1.5 ml-5 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const { state, me, mine, error, connected, setError, leave, focusOn } = useGame();
  const { rolling } = useCinematic(state);
  // Les couleurs de l'édition en cours, appliquées à toute la page.
  useEditionTheme(state);
  const t = useT(state);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [inspected, setInspected] = useState(null);
  const [tab, setTab] = useState('jeu');
  const aside = useRef(null);
  const [recapClosed, setRecapClosed] = useState(false);

  const finished = state?.phase === 'finished';
  useEffect(() => {
    if (finished) setRecapClosed(false);
  }, [finished]);

  // Quand une nouvelle décision arrive, la colonne remonte : sans ça, le panneau
  // reste caché sous la liste des biens et on croit qu'il ne se passe rien.
  const pendingKind = state?.pending?.kind ?? null;
  useEffect(() => {
    if (pendingKind) aside.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pendingKind]);

  // Sur téléphone, quand le jeu attend une décision de ce poste, on bascule
  // automatiquement sur l'onglet où se trouvent les boutons.
  const myTurn = Boolean(
    state?.pending?.kind && mine.some((p) => state.pending.playerIds?.includes(p.id)),
  );
  useEffect(() => {
    if (myTurn) setTab('jeu');
  }, [myTurn, pendingKind]);

  // Les erreurs sont passagères : elles s'effacent d'elles-mêmes.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  // Une proposition d'échange reçue ouvre la fenêtre d'échange.
  useEffect(() => {
    if (state?.trades?.some((t) => t.status === 'pending' && mine.some((p) => p.id === t.toPlayerId))) {
      setTradeOpen(true);
    }
  }, [state?.trades?.length]);

  if (!state) return <Home error={error} />;
  if (state.phase === 'lobby') return <WaitingRoom state={state} mine={mine} onLeave={leave} />;

  // La carte n'est montrée que le temps de la piocher et de la valider.
  const revealed = state.pending?.kind === 'card_reveal';
  const drawnCard = revealed && state.drawnCardId ? allCardsOf(state)[state.drawnCardId] : null;
  const myTurnToDraw = state.pending?.kind === 'draw_card' && me && state.pending.playerIds.includes(me.id);
  const revealedIsMine = revealed && me && state.pending.playerIds.includes(me.id);

  return (
    <div className="min-h-screen p-3 lg:p-5">
      {!connected && (
        <div className="fixed inset-x-0 top-0 z-50 bg-[var(--color-accent)] py-1.5 text-center text-xs text-white">
          {t('connectionLost')}
        </div>
      )}
      {error && (
        <div className="fade-in fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white shadow-lg">
          {error}
        </div>
      )}

      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 pb-16 xl:h-[calc(100dvh-2.5rem)] xl:flex-row xl:pb-0">
        <div
          className={`min-h-0 flex-1 items-start justify-center xl:flex ${
            tab === 'jeu' ? 'flex' : 'hidden'
          }`}
        >
          <ErrorBoundary zone="Le plateau">
            <Board
              state={state}
              drawnCard={drawnCard}
              onSelectSpace={setInspected}
              rolling={rolling}
              canDraw={Boolean(myTurnToDraw)}
              deckToDraw={state.pending?.payload?.deck ?? null}
              onDraw={() => sendAction({ type: 'DRAW_CARD' }, me?.id)}
              revealed={Boolean(revealedIsMine)}
              onAcknowledge={() => sendAction({ type: 'ACKNOWLEDGE_CARD' }, me?.id)}
            />
          </ErrorBoundary>
        </div>

        {/* La colonne défile toute seule : le plateau, lui, ne bouge jamais. */}
        <aside
          ref={aside}
          className="scroll-thin flex w-full shrink-0 flex-col gap-4 xl:h-full xl:w-[380px] xl:overflow-y-auto"
        >
          <div className={tab === 'jeu' ? 'contents' : 'hidden xl:contents'}>
            <ErrorBoundary zone="Le menu de partie">
              <GameMenu
                state={state}
                mine={mine}
                onLeave={leave}
                onShowRecap={() => setRecapClosed(false)}
              />
            </ErrorBoundary>
            <ErrorBoundary zone="La barre d'action">
              <Actions
                state={state}
                me={me}
                mine={mine}
                onOpenTrade={() => setTradeOpen(true)}
                onOpenSettlement={() => setSettleOpen(true)}
              />
            </ErrorBoundary>
          </div>

          <div className={tab === 'profil' ? 'contents' : 'hidden xl:contents'}>
            <ErrorBoundary zone="Le panneau des joueuses">
              <Players state={state} me={me} mine={mine} onFocus={focusOn} />
            </ErrorBoundary>
          </div>

          <div className={`h-72 shrink-0 xl:block ${tab === 'journal' ? 'block' : 'hidden'}`}>
            <ErrorBoundary zone="Le journal">
              <Feed state={state} actor={me?.id} />
            </ErrorBoundary>
          </div>
        </aside>
      </div>

      <MobileTabs tab={tab} onChange={setTab} waiting={myTurn} t={t} />

      {finished && !recapClosed && (
        <ErrorBoundary zone="Le récapitulatif">
          <GameOver state={state} onLeave={leave} onClose={() => setRecapClosed(true)} />
        </ErrorBoundary>
      )}

      {(tradeOpen || settleOpen) && me && (
        <ErrorBoundary zone="La fenêtre d'échange">
          <TradeDialog
            state={state}
            me={me}
            mine={mine}
            settleMode={settleOpen}
            onClose={() => {
              setTradeOpen(false);
              setSettleOpen(false);
            }}
          />
        </ErrorBoundary>
      )}

      {inspected != null && (
        <div
          className="fade-in fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setInspected(null)}
        >
          <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <PropertyCard state={state} spaceId={inspected} />
            <button
              onClick={() => setInspected(null)}
              className="mt-2 w-full rounded border border-black/15 bg-white py-2 font-condensed text-sm uppercase hover:bg-black/5"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
