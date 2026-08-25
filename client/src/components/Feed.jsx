/** Journal de partie et chat, en deux onglets dans la même colonne. */
import { useEffect, useRef, useState } from 'react';
import { sendAction } from '../lib/socket.js';
import { useT } from '../lib/i18n.js';

const TONE = {
  buy: 'text-[var(--color-money)]',
  build: 'text-[var(--color-money)]',
  credit: 'text-[var(--color-money)]',
  rent: 'text-[#8a5a00]',
  payment: 'text-[#8a5a00]',
  debt: 'text-[var(--color-accent)]',
  bankruptcy: 'text-[var(--color-accent)] font-medium',
  jail: 'text-[#2f5c8f]',
  card: 'text-[#5b3a8e]',
  auction: 'text-[#8a6a12]',
  trade: 'text-[#116b6b]',
  victory: 'text-[var(--color-accent)] font-semibold',
  turn: 'text-ink-soft',
  setup: 'text-ink-soft',
  lobby: 'text-ink-soft',
};

function Journal({ log }) {
  const list = useRef(null);
  // On ne descend que dans ce panneau : `scrollIntoView` remonte toute la chaîne
  // de conteneurs défilants (jusqu'à la page entière sur mobile), ce qui faisait
  // sauter tout l'écran vers le bas à chaque nouvelle ligne du journal.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <div ref={list} className="scroll-thin flex-1 space-y-1 overflow-y-auto pr-1 text-[12px] leading-snug">
      {log.map((entry) => (
        <p key={entry.id} className={TONE[entry.type] ?? 'text-ink'}>
          {entry.text}
        </p>
      ))}
    </div>
  );
}

function Chat({ state, actor }) {
  const [text, setText] = useState('');
  const t = useT(state);
  const list = useRef(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.chat.length]);

  const send = (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    sendAction({ type: 'CHAT', text }, actor);
    setText('');
  };

  return (
    <>
      <div ref={list} className="scroll-thin flex-1 space-y-1 overflow-y-auto pr-1 text-[12px]">
        {state.chat.map((message) => {
          const author = state.players.find((p) => p.id === message.playerId);
          return (
            <p key={message.id}>
              <span className="font-medium" style={{ color: author?.color }}>
                {author?.name ?? '—'}
              </span>
              <span> : {message.text}</span>
            </p>
          );
        })}
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("writeMessage")}
          maxLength={300}
          className="min-w-0 flex-1 rounded border border-black/20 bg-white px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded border border-black/15 bg-white px-3 font-condensed text-sm uppercase hover:bg-black/5"
        >
          {t('send')}
        </button>
      </form>
    </>
  );
}

export default function Feed({ state, actor }) {
  const [tab, setTab] = useState('journal');
  const t = useT(state);
  const tabs = [
    ['journal', t('journal')],
    ['chat', `${t('chat')}${state.chat.length ? ` (${state.chat.length})` : ''}`],
  ];

  return (
    <div className="flex h-[248px] flex-col">
      <div className="mb-2 flex gap-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded px-3 py-2 font-condensed text-[11px] uppercase tracking-widest transition-colors xl:px-2 xl:py-1 ${
              tab === id ? 'bg-[var(--color-accent)] text-white' : 'text-ink-soft hover:bg-black/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'journal' ? <Journal log={state.log} /> : <Chat state={state} actor={actor} />}
    </div>
  );
}
