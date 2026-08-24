import { useEffect, useRef, useState } from 'react';
import TokenIcon from './components/TokenIcon.jsx';
import { useGame } from './lib/useGame.js';
import { useCinematic } from './lib/useCinematic.js';
import { useEditionTheme } from './lib/theme.js';
import { sendAction } from './lib/socket.js';
import { Home, WaitingRoom, GameMenu } from './components/Lobby.jsx';
import Board from './components/Board.jsx';
import Players from './components/Players.jsx';
import Actions, { Manage } from './components/Actions.jsx';
import PanelColumn from './components/PanelStack.jsx';
import { usePanelLayout } from './lib/usePanelLayout.js';
import Feed from './components/Feed.jsx';
import TradeDialog from './components/TradeDialog.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import GameOver from './components/GameOver.jsx';
import BroadcastOverlay from './components/BroadcastOverlay.jsx';
import { PropertyCard } from './components/Actions.jsx';
import { LiveEventToast } from './components/MiniGameLog.jsx';
import { money } from './lib/board.js';
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

/** À quel onglet mobile appartient chaque section — sans lien avec son côté. */
const MOBILE_TAB_OF = { actions: 'jeu', assets: 'profil', players: 'profil', feed: 'journal' };

/**
 * Le contenu des quatre sections déplaçables, construit une fois par rendu.
 *
 * Le téléphone et l'ordinateur n'affichent pas le même arbre : une seule
 * colonne filtrée par onglet là, deux colonnes libres ici. Chaque section
 * vit donc à deux endroits du DOM (masqué par CSS, jamais par un test
 * d'appareil — la convention du projet), ce qui la monte deux fois ; le seul
 * coût réel est qu'un brouillon de message dans le chat ne survit pas à un
 * redimensionnement qui franchit le seuil ordinateur, un cas assez rare pour
 * qu'on l'accepte plutôt que de dupliquer toute la mise en page en JavaScript.
 */
function buildSections({ state, me, mine, t, onOpenTrade, setSettleOpen, focusOn, onOpenFullLog }) {
  return {
    actions: {
      title: t('sectionActions'),
      node: (
        <ErrorBoundary zone="La barre d'action">
          <Actions
            state={state}
            me={me}
            mine={mine}
            onOpenTrade={onOpenTrade}
            onOpenSettlement={() => setSettleOpen(true)}
            onOpenFullLog={onOpenFullLog}
          />
        </ErrorBoundary>
      ),
    },
    assets: {
      title: t('sectionAssets'),
      node: (
        <ErrorBoundary zone="Vos biens">
          <Manage state={state} me={me} />
        </ErrorBoundary>
      ),
    },
    players: {
      title: t('sectionPlayers'),
      node: (
        <ErrorBoundary zone="Le panneau des joueuses">
          <Players state={state} me={me} mine={mine} onFocus={focusOn} />
        </ErrorBoundary>
      ),
    },
    feed: {
      title: t('sectionFeed'),
      node: (
        <ErrorBoundary zone="Le journal">
          <Feed state={state} actor={me?.id} />
        </ErrorBoundary>
      ),
    },
  };
}

/**
 * Son solde, toujours sous les yeux.
 *
 * Il fallait dérouler la colonne jusqu'à sa propre fiche pour savoir de combien
 * on disposait — y compris au moment d'acheter, c'est-à-dire précisément quand
 * la question se pose. Ce bandeau colle en haut de la colonne et ne bouge plus.
 */
function CashBar({ state, mine, t }) {
  if (!mine.length) return null;
  return (
    <div className="panel sticky top-0 z-20 flex items-center gap-2 rounded-lg px-3 py-1.5 shadow-sm">
      <span className="font-condensed text-[10px] uppercase tracking-[0.18em] text-ink-soft">
        {t('yourCash')}
      </span>
      <span className="ml-auto flex items-center gap-2.5">
        {mine.map((player) => (
          <span key={player.id} className="flex items-center gap-1">
            <TokenIcon token={player.token} color={player.color} className="h-4 w-4" />
            <span className="tabular font-semibold text-[var(--color-money)]">
              {money(state, player.cash)}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

export default function App() {
  const { state, me, mine, error, connected, setError, leave, focusOn } = useGame();
  const { rolling } = useCinematic(state);
  // Les couleurs de l'édition en cours, appliquées à toute la page.
  useEditionTheme(state);
  const t = useT(state);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeTarget, setTradeTarget] = useState(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [inspected, setInspected] = useState(null);
  const [tab, setTab] = useState('jeu');
  const leftDock = useRef(null);
  const rightDock = useRef(null);
  const [recapClosed, setRecapClosed] = useState(false);

  const handleOpenTrade = (targetPlayerId = null) => {
    setTradeTarget(targetPlayerId);
    setTradeOpen(true);
  };

  // Les quatre sections qu'on peut replier et faire glisser d'un côté à
  // l'autre du plateau. `usePanelLayout` est appelé une fois ici, et les deux
  // colonnes en dessous partagent le même objet — c'est ce qui permet à un
  // glisser-déposer commencé dans l'une de se terminer dans l'autre.
  const SECTION_IDS = ['actions', 'assets', 'players', 'feed'];
  const layout = usePanelLayout(SECTION_IDS);

  const finished = state?.phase === 'finished';
  useEffect(() => {
    if (finished) setRecapClosed(false);
  }, [finished]);

  // Quand une nouvelle décision arrive, la colonne qui porte les boutons
  // remonte : sans ça, ils restent cachés sous la liste des biens et on croit
  // qu'il ne se passe rien. On ne sait plus d'avance laquelle des deux
  // colonnes les porte — ça dépend de l'agencement choisi.
  const pendingKind = state?.pending?.kind ?? null;
  useEffect(() => {
    if (!pendingKind) return;
    const dock = layout.columns.left.includes('actions') ? leftDock : rightDock;
    dock.current?.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Construit une seule fois le contenu des sections, puis le distribue selon
  // l'agencement choisi : gauche, droite, ou — sur téléphone — un seul
  // ensemble filtré par onglet, dans l'ordre où les colonnes ont été fondues.
  const content = buildSections({
    state,
    me,
    mine,
    t,
    onOpenTrade: handleOpenTrade,
    setSettleOpen,
    focusOn,
    onOpenFullLog: () => setTab('journal'),
  });
  const toSection = (id) => ({ id, ...content[id] });
  const leftSections = layout.columns.left.map(toSection);
  const rightSections = layout.columns.right.map(toSection);
  const mobileSections = [...layout.columns.left, ...layout.columns.right].map((id) => ({
    id,
    ...content[id],
    className: tab === MOBILE_TAB_OF[id] ? '' : 'hidden',
  }));

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

      {/* Le plateau, flanqué d'une colonne de chaque côté. N'importe quelle
          section — vos biens, les joueuses, le journal et le chat — se
          replie, se réordonne, et se glisse d'une colonne à l'autre : c'est
          l'agencement choisi qui commande, pas un ordre figé d'avance. Une
          colonne vide ne réserve aucune place, le plateau récupère l'espace. */}
      <div className="mx-auto flex max-w-[2000px] flex-col gap-2 pb-16 xl:h-[calc(100dvh-2.5rem)] xl:flex-row xl:pb-0">
        {leftSections.length > 0 && (
          <aside
            ref={leftDock}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => layout.dropInto('left')}
            className="scroll-thin hidden shrink-0 flex-col gap-2 overflow-y-auto xl:flex xl:h-full xl:w-[360px]"
          >
            <PanelColumn side="left" t={t} layout={layout} sections={leftSections} />
          </aside>
        )}

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

        {/* Sur téléphone, une seule colonne : les onglets décident de ce qui
            s'affiche, par des classes, jamais par une détection d'appareil.
            Elle reçoit les deux côtés fondus, puisque « gauche » et « droite »
            ne veulent rien dire sans le plateau entre les deux. */}
        <aside
          ref={rightDock}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => layout.dropInto('right')}
          className="scroll-thin flex w-full shrink-0 flex-col gap-2 xl:h-full xl:w-[380px] xl:overflow-y-auto"
        >
          {/* Le code de partie, les règles, la calculatrice et le solde ne se
              déplacent pas : ils restent en tête de la colonne de droite. */}
          <div className={tab === 'jeu' ? 'contents' : 'hidden xl:contents'}>
            <ErrorBoundary zone="Le menu de partie">
              <GameMenu
                state={state}
                mine={mine}
                onLeave={leave}
                onShowRecap={() => setRecapClosed(false)}
              />
            </ErrorBoundary>
          </div>

          <CashBar state={state} mine={mine} t={t} />

          {/* Le seul endroit où le téléphone regarde encore l'onglet en cours :
              une colonne unique, les deux côtés fondus dans l'ordre où
              l'ordinateur les affiche. */}
          <div className="contents xl:hidden">
            <PanelColumn side="right" t={t} layout={layout} sections={mobileSections} />
          </div>
          <div className="hidden xl:contents">
            <PanelColumn side="right" t={t} layout={layout} sections={rightSections} />
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
            initialTargetId={tradeTarget}
            onClose={() => {
              setTradeOpen(false);
              setTradeTarget(null);
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

      <LiveEventToast state={state} />
      <BroadcastOverlay state={state} me={me} />
    </div>
  );
}
