/** Journal de partie et chat, en deux onglets dans la même colonne. */
import { useEffect, useRef, useState } from 'react';
import { sendAction } from '../lib/socket.js';

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
  const bottom = useRef(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [log.length]);

  return (
    <div className="scroll-thin flex-1 space-y-1 overflow-y-auto pr-1 text-[12px] leading-snug">
      {log.map((entry) => (
        <p key={entry.id} className={TONE[entry.type] ?? 'text-ink'}>
          {entry.text}
        </p>
      ))}
      <div ref={bottom} />
    </div>
  );
}

function Chat({ state, actor }) {
  const [text, setText] = useState('');
  const bottom = useRef(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [state.chat.length]);

  const send = (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    sendAction({ type: 'CHAT', text }, actor);
    setText('');
  };

  return (
    <>
      <div className="scroll-thin flex-1 space-y-1 overflow-y-auto pr-1 text-[12px]">
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
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire un message…"
          maxLength={300}
          className="min-w-0 flex-1 rounded border border-black/20 bg-white px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded border border-black/15 bg-white px-3 font-condensed text-sm uppercase hover:bg-black/5"
        >
          Envoyer
        </button>
      </form>
    </>
  );
}

export default function Feed({ state, actor }) {
  const [tab, setTab] = useState('journal');
  const tabs = [
    ['journal', 'Journal'],
    ['chat', `Chat${state.chat.length ? ` (${state.chat.length})` : ''}`],
  ];

  return (
    <div className="panel flex h-full min-h-[220px] flex-col rounded-lg p-3">
      <div className="mb-2 flex gap-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded px-2 py-1 font-condensed text-[11px] uppercase tracking-widest transition-colors ${
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
