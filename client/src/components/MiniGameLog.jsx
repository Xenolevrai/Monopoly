import { useState, useEffect, useRef } from 'react';
import TokenIcon from './TokenIcon.jsx';

const EVENT_ICONS = {
  buy: '🏷️',
  build: '🏠',
  credit: '💰',
  rent: '💸',
  payment: '💸',
  debt: '⚠️',
  bankruptcy: '💥',
  jail: '⛓️',
  card: '🃏',
  auction: '🔨',
  trade: '🤝',
  victory: '🏆',
  turn: '🎲',
  movement: '👟',
};

const TONE_CLASSES = {
  buy: 'border-emerald-500/40 bg-emerald-50/90 text-emerald-950',
  build: 'border-green-500/40 bg-green-50/90 text-green-950',
  credit: 'border-amber-500/40 bg-amber-50/90 text-amber-950',
  rent: 'border-orange-500/40 bg-orange-50/90 text-orange-950',
  payment: 'border-orange-500/40 bg-orange-50/90 text-orange-950',
  debt: 'border-rose-500/40 bg-rose-50/90 text-rose-950',
  bankruptcy: 'border-red-600/50 bg-red-100 text-red-950 font-bold',
  jail: 'border-blue-500/40 bg-blue-50/90 text-blue-950',
  card: 'border-purple-500/40 bg-purple-50/90 text-purple-950',
  auction: 'border-yellow-600/40 bg-yellow-50/90 text-yellow-950',
  trade: 'border-teal-500/40 bg-teal-50/90 text-teal-950',
  victory: 'border-amber-500 bg-amber-100 text-amber-950 font-extrabold',
  turn: 'border-stone-300 bg-stone-50/80 text-stone-700',
  movement: 'border-stone-300 bg-stone-50/80 text-stone-700',
};

/** Toast flottant qui surgit dès qu'un événement marquant survient */
export function LiveEventToast({ state }) {
  const [toast, setToast] = useState(null);
  const lastIdRef = useRef(null);

  const importantTypes = ['buy', 'build', 'credit', 'rent', 'payment', 'jail', 'bankruptcy', 'trade', 'victory'];

  useEffect(() => {
    const logs = state?.log ?? [];
    if (logs.length === 0) return;
    const latest = logs[logs.length - 1];

    if (latest.id !== lastIdRef.current) {
      lastIdRef.current = latest.id;
      if (importantTypes.includes(latest.type)) {
        const player = state.players?.find((p) => p.id === latest.meta?.playerId);
        setToast({ entry: latest, player, time: Date.now() });

        const timer = setTimeout(() => {
          setToast(null);
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [state?.log?.length]);

  if (!toast) return null;

  const icon = EVENT_ICONS[toast.entry.type] ?? '📢';
  const toneClass = TONE_CLASSES[toast.entry.type] ?? 'border-stone-400 bg-white text-stone-900';

  return (
    <div className="fade-in pointer-events-none fixed top-16 left-1/2 z-50 -translate-x-1/2 px-3 w-full max-w-md">
      <div className={`flex items-center gap-2.5 rounded-xl border-2 px-3.5 py-2 text-xs font-semibold shadow-xl backdrop-blur-sm ${toneClass}`}>
        <span className="text-lg shrink-0">{icon}</span>
        {toast.player && (
          <TokenIcon token={toast.player.token} color={toast.player.color} className="h-4 w-4 shrink-0" />
        )}
        <p className="flex-1 truncate text-xs leading-snug">{toast.entry.text}</p>
      </div>
    </div>
  );
}

/** Mini journal affichant en permanence les 5 derniers événements du jeu */
export default function MiniGameLog({ state, onOpenFullLog }) {
  const isEn = state?.locale === 'en';
  const logs = state?.log ?? [];
  const recentLogs = logs.slice(-5);

  if (recentLogs.length === 0) return null;

  return (
    <div className="rounded-xl border border-black/10 bg-white/75 p-2.5 shadow-xs backdrop-blur-xs space-y-1.5">
      <div className="flex items-center justify-between border-b border-black/5 pb-1">
        <div className="flex items-center gap-1.5 font-condensed text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          <span>📜</span>
          <span>{isEn ? 'Recent Activity' : 'Dernières actions'}</span>
        </div>
        {onOpenFullLog && (
          <button
            type="button"
            onClick={onOpenFullLog}
            className="text-[10px] font-condensed font-bold uppercase text-[var(--color-accent)] hover:underline"
          >
            {isEn ? 'Full Log →' : 'Tout le Journal →'}
          </button>
        )}
      </div>

      <div className="space-y-1">
        {recentLogs.map((entry) => {
          const icon = EVENT_ICONS[entry.type] ?? '•';
          const player = state.players?.find((p) => p.id === entry.meta?.playerId);

          return (
            <div
              key={entry.id}
              className="flex items-center gap-1.5 rounded border border-black/5 bg-white/90 px-2 py-1 text-[11px] leading-tight text-ink shadow-2xs"
            >
              <span className="text-xs shrink-0">{icon}</span>
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
