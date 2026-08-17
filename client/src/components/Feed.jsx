/** Journal de partie et chat, en deux onglets dans la même colonne. */
import { useEffect, useRef, useState } from 'react';
import { sendAction } from '../lib/socket.js';

const TONE = {
  buy: 'text-emerald-300',
  rent: 'text-amber-300',
  payment: 'text-amber-200/90',
  credit: 'text-emerald-300',
  debt: 'text-rose-300',
  bankruptcy: 'text-rose-400',
  jail: 'text-sky-300',
  card: 'text-violet-300',
  auction: 'text-gold-soft',
  trade: 'text-teal-300',
  build: 'text-emerald-400',
  victory: 'text-gold-soft',
  turn: 'text-muted',
};

function Journal({ log }) {
  const bottom = useRef(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [log.length]);

  return (
    <div className="scroll-thin flex-1 space-y-1 overflow-y-auto pr-1 text-[12px] leading-snug">
      {log.map((entry) => (
        <p key={entry.id} className={TONE[entry.type] ?? 'text-parchment/80'}>
          {entry.text}
        </p>
      ))}
      <div ref={bottom} />
    </div>
  );
}

function Chat({ state }) {
  const [text, setText] = useState('');
  const bottom = useRef(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [state.chat.length]);

  const send = (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    sendAction({ type: 'CHAT', text });
    setText('');
  };

  return (
    <>
      <div className="scroll-thin flex-1 space-y-1 overflow-y-auto pr-1 text-[12px]">
        {state.chat.map((message) => {
          const author = state.players.find((p) => p.id === message.playerId);
          return (
            <p key={message.id}>
              <span style={{ color: author?.color }}>{author?.name ?? '—'}</span>
              <span className="text-parchment/85"> : {message.text}</span>
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
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-night px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-white/10 px-3 text-sm hover:bg-white/20"
        >
          Envoyer
        </button>
      </form>
    </>
  );
}

export default function Feed({ state }) {
  const [tab, setTab] = useState('journal');
  const tabs = [
    ['journal', 'Journal'],
    ['chat', `Chat${state.chat.length ? ` (${state.chat.length})` : ''}`],
  ];

  return (
    <div className="gilt-soft flex h-full min-h-[220px] flex-col rounded-lg bg-night-soft/80 p-3">
      <div className="mb-2 flex gap-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded px-2 py-1 text-[11px] uppercase tracking-widest transition-colors ${
              tab === id ? 'bg-gold/20 text-gold-soft' : 'text-muted hover:text-parchment'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'journal' ? <Journal log={state.log} /> : <Chat state={state} />}
    </div>
  );
}
