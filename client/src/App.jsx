import { useEffect, useState } from 'react';
import { useGame } from './lib/useGame.js';
import { Home, WaitingRoom } from './components/Lobby.jsx';
import Board from './components/Board.jsx';
import Players from './components/Players.jsx';
import Actions from './components/Actions.jsx';
import Feed from './components/Feed.jsx';
import TradeDialog from './components/TradeDialog.jsx';
import { PropertyCard } from './components/Actions.jsx';
import cards from '../../shared/data/cards.json';

const ALL_CARDS = Object.fromEntries(
  Object.entries(cards).flatMap(([deck, list]) => list.map((card) => [card.id, { ...card, deck }])),
);

export default function App() {
  const { state, me, error, connected, setError, leave } = useGame();
  const [tradeOpen, setTradeOpen] = useState(false);
  const [inspected, setInspected] = useState(null);

  // Les erreurs sont passagères : elles s'effacent d'elles-mêmes.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  // Une proposition d'échange reçue ouvre la fenêtre d'échange.
  useEffect(() => {
    if (state?.trades?.some((t) => t.status === 'pending' && t.toPlayerId === me?.id)) {
      setTradeOpen(true);
    }
  }, [state?.trades?.length]);

  if (!state) return <Home error={error} />;
  if (state.phase === 'lobby') return <WaitingRoom state={state} me={me} onLeave={leave} />;

  const drawnCard = state.drawnCardId ? ALL_CARDS[state.drawnCardId] : null;

  return (
    <div className="min-h-screen p-3 lg:p-5">
      {!connected && (
        <div className="fixed inset-x-0 top-0 z-50 bg-rose-700/90 py-1.5 text-center text-xs">
          Connexion perdue — reprise automatique dès que le serveur répond…
        </div>
      )}
      {error && (
        <div className="fade-in fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-md bg-rose-600/90 px-4 py-2 text-sm shadow-lg">
          {error}
        </div>
      )}

      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 xl:h-[calc(100dvh-2.5rem)] xl:flex-row">
        <div className="flex min-h-0 flex-1 items-start justify-center">
          <Board state={state} drawnCard={drawnCard} onSelectSpace={setInspected} />
        </div>

        {/* La colonne défile toute seule : le plateau, lui, ne bouge jamais. */}
        <aside className="scroll-thin flex w-full shrink-0 flex-col gap-4 xl:h-full xl:w-[380px] xl:overflow-y-auto">
          <Actions state={state} me={me} onOpenTrade={() => setTradeOpen(true)} />
          <Players state={state} me={me} />
          <div className="h-72 shrink-0">
            <Feed state={state} />
          </div>
        </aside>
      </div>

      {tradeOpen && me && (
        <TradeDialog state={state} me={me} onClose={() => setTradeOpen(false)} />
      )}

      {inspected != null && (
        <div
          className="fade-in fixed inset-0 z-40 flex items-center justify-center bg-night/80 p-4"
          onClick={() => setInspected(null)}
        >
          <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <PropertyCard spaceId={inspected} />
            <button
              onClick={() => setInspected(null)}
              className="mt-2 w-full rounded-md bg-white/10 py-2 text-sm hover:bg-white/20"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
