/**
 * Ce qui vient de se passer, en un coup d'œil.
 *
 * Deux composants qui partagent le même vocabulaire d'événements :
 *  - `LiveEventToast` — la bulle flottante, pour ne pas rater un coup pendant
 *    qu'on regarde le plateau ;
 *  - `MiniGameLog` — les cinq dernières lignes, posées en permanence dans le
 *    panneau d'action.
 *
 * Le principe qui gouverne la bulle : **informer sans déranger**. Avec quatre
 * bots qui jouent toutes les 700 à 1 600 ms, les événements s'enchaînent plus
 * vite qu'on ne les lit. Les bulles font donc la queue au lieu de s'écraser les
 * unes les autres, et ce qui nous concerne personnellement passe devant le
 * reste et reste affiché plus longtemps.
 */
import { useState, useEffect, useRef } from 'react';
import TokenIcon from './TokenIcon.jsx';
import { useT } from '../lib/i18n.js';

const EVENT_ICONS = {
  buy: '🏷️',
  build: '🏠',
  sell: '🔨',
  credit: '💰',
  money: '💰',
  rent: '💸',
  payment: '💸',
  debt: '⚠️',
  bankruptcy: '💥',
  jail: '⛓️',
  card: '🃏',
  spin: '🎡',
  hazard: '🕷️',
  auction: '🔨',
  trade: '🤝',
  unmortgage: '🔓',
  victory: '🏆',
  turn: '🎲',
  movement: '👟',
};

/**
 * Les couleurs sont écrites en dur, fond **et** encre ensemble.
 *
 * C'est délibéré et c'est la règle du projet (voir `CLAUDE.md` §7 bis) : un
 * composant qui pose son propre fond doit poser sa propre encre. Utiliser
 * `text-ink` ferait hériter de l'encre du thème — claire sur les plateaux
 * sombres — et le texte disparaîtrait sur son fond clair.
 */
const TONE_CLASSES = {
  buy: 'border-emerald-500/40 bg-emerald-50/95 text-emerald-950',
  build: 'border-green-500/40 bg-green-50/95 text-green-950',
  sell: 'border-lime-600/40 bg-lime-50/95 text-lime-950',
  credit: 'border-amber-500/40 bg-amber-50/95 text-amber-950',
  money: 'border-amber-500/40 bg-amber-50/95 text-amber-950',
  rent: 'border-orange-500/40 bg-orange-50/95 text-orange-950',
  payment: 'border-orange-500/40 bg-orange-50/95 text-orange-950',
  debt: 'border-rose-500/40 bg-rose-50/95 text-rose-950',
  bankruptcy: 'border-red-600/50 bg-red-100 text-red-950 font-bold',
  jail: 'border-blue-500/40 bg-blue-50/95 text-blue-950',
  card: 'border-purple-500/40 bg-purple-50/95 text-purple-950',
  spin: 'border-fuchsia-500/40 bg-fuchsia-50/95 text-fuchsia-950',
  hazard: 'border-violet-600/40 bg-violet-50/95 text-violet-950',
  auction: 'border-yellow-600/40 bg-yellow-50/95 text-yellow-950',
  trade: 'border-teal-500/40 bg-teal-50/95 text-teal-950',
  unmortgage: 'border-sky-500/40 bg-sky-50/95 text-sky-950',
  victory: 'border-amber-500 bg-amber-100 text-amber-950 font-extrabold',
  turn: 'border-stone-300 bg-stone-50/95 text-stone-800',
  movement: 'border-stone-300 bg-stone-50/95 text-stone-800',
};

/**
 * Les événements qui méritent une bulle.
 *
 * Tirer une carte en faisait partie depuis le début côté icône, mais avait été
 * oublié ici : on voyait l'icône prévue et jamais la bulle. La liste couvre
 * maintenant tout ce que le moteur émet et qu'on aurait envie de voir de loin.
 * Restent volontairement dehors : `turn`, `roll`, `land`, `movement` (trop
 * fréquents, ils noieraient le reste), `setup`, `action` et `error`.
 */
const NOTABLE = new Set([
  'buy', 'build', 'sell', 'credit', 'money', 'rent', 'payment', 'debt',
  'jail', 'bankruptcy', 'card', 'spin', 'hazard', 'auction', 'trade',
  'unmortgage', 'victory',
]);

/** Combien de temps une bulle reste affichée, selon qu'elle nous concerne. */
const DURATION = { mine: 4200, other: 2600 };

/** Au-delà, on jette les plus anciennes : mieux vaut rater que prendre du retard. */
const QUEUE_MAX = 4;

/**
 * La bulle flottante.
 *
 * @param {{ state: object, mine?: {id: string}[] }} props `mine` = les joueuses
 *   de ce poste, pour savoir ce qui nous concerne vraiment.
 */
export function LiveEventToast({ state, mine = [] }) {
  const t = useT(state);
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  // On suit le **dernier identifiant vu**, jamais la longueur du journal :
  // celui-ci est plafonné à 500 entrées côté serveur, si bien qu'en partie
  // longue sa longueur cesse de changer — et les bulles s'arrêtaient
  // définitivement, sans que rien ne le signale.
  const lastSeenRef = useRef(null);

  const localIds = mine.map((p) => p.id).join('|');

  useEffect(() => {
    const log = state?.log ?? [];
    const latest = log.at(-1);
    if (!latest) return;

    // Premier rendu : on prend le journal tel qu'il est sans rejouer l'historique.
    if (lastSeenRef.current === null) {
      lastSeenRef.current = latest.id;
      return;
    }
    if (latest.id === lastSeenRef.current) return;

    // Tout ce qui est arrivé depuis la dernière fois, dans l'ordre. Une seule
    // action du moteur peut produire plusieurs entrées (payer un loyer en écrit
    // deux ou trois) : les prendre toutes évite d'en perdre au passage.
    const seenAt = log.findIndex((entry) => entry.id === lastSeenRef.current);
    const fresh = (seenAt === -1 ? [latest] : log.slice(seenAt + 1)).filter((entry) =>
      NOTABLE.has(entry.type),
    );
    lastSeenRef.current = latest.id;
    if (!fresh.length) return;

    const localSet = new Set(mine.map((p) => p.id));
    const items = fresh.map((entry) => ({
      entry,
      // L'autrice est dans `entry.data`, pas `entry.meta` : c'est la forme que
      // `log()` construit côté serveur, et un piège déjà documenté.
      player: state.players?.find((p) => p.id === entry.data?.playerId) ?? null,
      mine: localSet.has(entry.data?.playerId) || localSet.has(entry.data?.creditorId),
    }));

    setQueue((waiting) => {
      // Ce qui nous concerne passe devant, sans casser l'ordre du reste.
      const next = [...waiting, ...items];
      const ours = next.filter((item) => item.mine);
      const theirs = next.filter((item) => !item.mine);
      return [...ours, ...theirs].slice(0, QUEUE_MAX);
    });
  }, [state?.log?.at(-1)?.id, localIds]);

  // Défile la file : une bulle à la fois, jamais d'écrasement.
  useEffect(() => {
    if (current || !queue.length) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [queue, current]);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(
      () => setCurrent(null),
      current.mine ? DURATION.mine : DURATION.other,
    );
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;

  const { entry, player, mine: isMine } = current;
  const icon = EVENT_ICONS[entry.type] ?? '📢';
  const tone = TONE_CLASSES[entry.type] ?? 'border-stone-400 bg-white text-stone-900';

  return (
    // Sur téléphone la bulle se pose **en bas**, juste au-dessus des onglets :
    // le plateau occupe tout le haut de l'écran, et s'y poser masquait la case
    // où l'on vient de tomber et la carte qu'on vient de tirer — exactement ce
    // qu'on était en train de regarder. Sur ordinateur, la place est en haut.
    // `pointer-events-none` sur le cadre pour ne jamais bloquer un appui ;
    // seule la bulle elle-même reçoit les clics.
    <div className="pointer-events-none fixed inset-x-0 bottom-[4.5rem] z-40 flex justify-center px-3 xl:bottom-auto xl:top-16">
      <div
        role="status"
        aria-live="polite"
        className={`fade-in pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-xl border-2 px-3.5 py-2 text-xs font-semibold shadow-xl backdrop-blur-sm ${tone} ${
          isMine ? 'ring-2 ring-[var(--color-gold)]' : ''
        }`}
      >
        <span className="shrink-0 text-lg">{icon}</span>
        {player && (
          <TokenIcon token={player.token} color={player.color} className="h-4 w-4 shrink-0" />
        )}
        <p className="line-clamp-2 flex-1 text-xs leading-snug">{entry.text}</p>
        <button
          type="button"
          onClick={() => setCurrent(null)}
          className="-my-2 -mr-2 flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center font-bold text-current hover:opacity-70"
          aria-label={t('close')}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** Mini journal : les cinq derniers événements, posés en permanence. */
export default function MiniGameLog({ state, onOpenFullLog }) {
  const t = useT(state);
  const recent = (state?.log ?? []).slice(-5);
  if (!recent.length) return null;

  return (
    <div className="shadow-xs backdrop-blur-xs space-y-1.5 rounded-xl border border-black/10 bg-white/75 p-2.5">
      <div className="flex items-center justify-between border-b border-black/5 pb-1">
        <div className="flex items-center gap-1.5 font-condensed text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          <span aria-hidden="true">📜</span>
          <span>{t('recentActivity')}</span>
        </div>
        {onOpenFullLog && (
          <button
            type="button"
            onClick={onOpenFullLog}
            className="-my-1 px-2 py-2 font-condensed text-[10px] font-bold uppercase text-[var(--color-accent)] hover:underline xl:my-0 xl:px-0 xl:py-0"
          >
            {t('fullLog')}
          </button>
        )}
      </div>

      <div className="space-y-1">
        {recent.map((entry) => {
          const icon = EVENT_ICONS[entry.type] ?? '•';
          const player = state.players?.find((p) => p.id === entry.data?.playerId);

          return (
            <div
              key={entry.id}
              className="shadow-2xs flex items-center gap-1.5 rounded border border-black/5 bg-white/90 px-2 py-1 text-[11px] leading-tight text-stone-800"
            >
              <span className="shrink-0 text-xs" aria-hidden="true">{icon}</span>
              {player && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full border border-black/30"
                  style={{ backgroundColor: player.color }}
                  title={player.name}
                />
              )}
              <span className="flex-1 truncate">{entry.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
