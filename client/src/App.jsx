import { useEffect, useState } from 'react';
import { useGame } from './lib/useGame.js';
import { Home, WaitingRoom } from './components/Lobby.jsx';
import Board from './components/Board.jsx';
import Players from './components/Players.jsx';
import Actions from './components/Actions.jsx';
import Feed from './components/Feed.jsx';
import TradeDialog from './components/TradeDialog.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { PropertyCard } from './components/Actions.jsx';
import cards from '../../shared/data/cards.json';

const ALL_CARDS = Object.fromEntries(
  Object.entries(cards).flatMap(([deck, list]) => list.map((card) => [card.id, { ...card, deck }])),
);

export default function App() {
  const { state, me, mine, error, connected, setError, leave, focusOn } = useGame();
  const [tradeOpen, setTradeOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [inspected, setInspected] = useState(null);

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

  const drawnCard = state.drawnCardId ? ALL_CARDS[state.drawnCardId] : null;

  return (
    <div className="min-h-screen p-3 lg:p-5">
      {!connected && (
        <div className="fixed inset-x-0 top-0 z-50 bg-[var(--color-accent)] py-1.5 text-center text-xs text-white">
          Connexion perdue — reprise automatique dès que le serveur répond…
        </div>
      )}
      {error && (
        <div className="fade-in fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white shadow-lg">
          {error}
        </div>
      )}

      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 xl:h-[calc(100dvh-2.5rem)] xl:flex-row">
        <div className="flex min-h-0 flex-1 items-start justify-center">
          <ErrorBoundary zone="Le plateau">
            <Board state={state} drawnCard={drawnCard} onSelectSpace={setInspected} />
          </ErrorBoundary>
        </div>

        {/* La colonne défile toute seule : le plateau, lui, ne bouge jamais. */}
        <aside className="scroll-thin flex w-full shrink-0 flex-col gap-4 xl:h-full xl:w-[380px] xl:overflow-y-auto">
          <ErrorBoundary zone="La barre d'action">
            <Actions
              state={state}
              me={me}
              mine={mine}
              onOpenTrade={() => setTradeOpen(true)}
              onOpenSettlement={() => setSettleOpen(true)}
            />
          </ErrorBoundary>
          <ErrorBoundary zone="Le panneau des joueuses">
            <Players state={state} me={me} mine={mine} onFocus={focusOn} />
          </ErrorBoundary>
          <div className="h-72 shrink-0">
            <ErrorBoundary zone="Le journal">
              <Feed state={state} actor={me?.id} />
            </ErrorBoundary>
          </div>
        </aside>
      </div>

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
            <PropertyCard spaceId={inspected} />
            <button
              onClick={() => setInspected(null)}
              className="mt-2 w-full rounded border border-black/15 bg-white py-2 font-condensed text-sm uppercase hover:bg-black/5"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
