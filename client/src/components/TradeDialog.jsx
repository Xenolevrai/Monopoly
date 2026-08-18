/** Construction d'un échange : argent + propriétés + cartes de prison, des deux côtés. */
import { useState } from 'react';
import { board, euros } from '../lib/board.js';
import { sendAction } from '../lib/socket.js';

function Side({ title, player, state, value, onChange }) {
  const owned = Object.values(state.properties)
    .filter((p) => p.ownerId === player.id && !p.hotel && p.houses === 0)
    .sort((a, b) => a.spaceId - b.spaceId);

  const toggle = (spaceId) => {
    const next = value.spaceIds.includes(spaceId)
      ? value.spaceIds.filter((id) => id !== spaceId)
      : [...value.spaceIds, spaceId];
    onChange({ ...value, spaceIds: next });
  };

  return (
    <div className="flex-1 space-y-2">
      <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
        {title} — <span style={{ color: player.color }}>{player.name}</span>
      </p>

      <label className="flex items-center gap-2 text-xs">
        <span className="text-ink-soft">Argent</span>
        <input
          type="number"
          min={0}
          max={player.cash}
          value={value.cash}
          onChange={(e) => onChange({ ...value, cash: Math.max(0, Number(e.target.value)) })}
          className="tabular w-24 rounded border border-black/20 bg-white px-2 py-1"
        />
        <span className="tabular text-ink-soft">/ {euros(player.cash)}</span>
      </label>

      {player.getOutOfJailCards > 0 && (
        <label className="flex items-center gap-2 text-xs">
          <span className="text-ink-soft">Cartes de prison</span>
          <input
            type="number"
            min={0}
            max={player.getOutOfJailCards}
            value={value.jailCards}
            onChange={(e) => onChange({ ...value, jailCards: Math.max(0, Number(e.target.value)) })}
            className="tabular w-16 rounded border border-black/20 bg-white px-2 py-1"
          />
        </label>
      )}

      <div className="scroll-thin max-h-40 space-y-1 overflow-y-auto pr-1">
        {owned.length === 0 && <p className="text-[11px] text-ink-soft">Aucune propriété échangeable.</p>}
        {owned.map((prop) => {
          const space = board[prop.spaceId];
          const selected = value.spaceIds.includes(prop.spaceId);
          return (
            <button
              key={prop.spaceId}
              type="button"
              onClick={() => toggle(prop.spaceId)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] transition-colors ${
                selected ? 'bg-[var(--color-gold)]/25 text-ink' : 'bg-white hover:bg-black/5 border border-black/10'
              }`}
            >
              <span className="truncate">{space.shortName}</span>
              {prop.mortgaged && <span className="text-amber-400/80">hypo.</span>}
              <span className="tabular ml-auto text-ink-soft">{euros(space.price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TradeDialog({ state, me, onClose }) {
  const actor = me.id;
  const others = state.players.filter((p) => p.id !== me.id && !p.bankrupt);
  const [targetId, setTargetId] = useState(others[0]?.id ?? null);
  const [give, setGive] = useState({ cash: 0, spaceIds: [], jailCards: 0 });
  const [receive, setReceive] = useState({ cash: 0, spaceIds: [], jailCards: 0 });

  const target = state.players.find((p) => p.id === targetId);
  const incoming = state.trades.filter((t) => t.status === 'pending' && t.toPlayerId === me.id);
  const outgoing = state.trades.filter((t) => t.status === 'pending' && t.fromPlayerId === me.id);

  const describe = (side) =>
    [
      side.cash ? euros(side.cash) : null,
      ...side.spaceIds.map((id) => board[id].shortName),
      side.jailCards ? `${side.jailCards} carte(s)` : null,
    ]
      .filter(Boolean)
      .join(', ') || 'rien';

  const submit = () => {
    if (!targetId) return;
    sendAction({ type: 'PROPOSE_TRADE', toPlayerId: targetId, give, receive }, actor);
    setGive({ cash: 0, spaceIds: [], jailCards: 0 });
    setReceive({ cash: 0, spaceIds: [], jailCards: 0 });
  };

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-condensed text-xl uppercase tracking-[0.2em]">ÉCHANGE</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">
            ✕
          </button>
        </div>

        {incoming.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">Propositions reçues</p>
            {incoming.map((trade) => {
              const from = state.players.find((p) => p.id === trade.fromPlayerId);
              return (
                <div key={trade.id} className="rounded-md border border-black/10 bg-white p-3 text-xs">
                  <p>
                    <span style={{ color: from?.color }}>{from?.name}</span> vous donne{' '}
                    <span className="text-[var(--color-money)]">{describe(trade.give)}</span> contre{' '}
                    <span className="text-[#8a5a00]">{describe(trade.receive)}</span>.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded bg-[var(--color-accent)] px-3 py-1 text-white hover:bg-[var(--color-accent-deep)]"
                      onClick={() =>
                        sendAction({ type: 'RESPOND_TRADE', tradeId: trade.id, accept: true }, actor)
                      }
                    >
                      Accepter
                    </button>
                    <button
                      className="rounded border border-black/15 bg-white px-3 py-1 hover:bg-black/5"
                      onClick={() =>
                        sendAction({ type: 'RESPOND_TRADE', tradeId: trade.id, accept: false }, actor)
                      }
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {outgoing.length > 0 && (
          <div className="mb-4 space-y-1">
            <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">En attente de réponse</p>
            {outgoing.map((trade) => {
              const to = state.players.find((p) => p.id === trade.toPlayerId);
              return (
                <div key={trade.id} className="flex items-center gap-2 text-xs text-ink-soft">
                  <span>Proposition à {to?.name}</span>
                  <button
                    className="rounded border border-black/15 bg-white px-2 py-0.5 hover:bg-black/5"
                    onClick={() => sendAction({ type: 'CANCEL_TRADE', tradeId: trade.id }, actor)}
                  >
                    Annuler
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {others.length > 0 && target ? (
          <>
            <div className="mb-3 flex items-center gap-2 text-xs">
              <span className="text-ink-soft">Échanger avec</span>
              <select
                value={targetId}
                onChange={(e) => {
                  setTargetId(e.target.value);
                  setReceive({ cash: 0, spaceIds: [], jailCards: 0 });
                }}
                className="rounded border border-black/20 bg-white px-2 py-1"
              >
                {others.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-5 sm:flex-row">
              <Side title="Je donne" player={me} state={state} value={give} onChange={setGive} />
              <Side
                title="Je reçois"
                player={target}
                state={state}
                value={receive}
                onChange={setReceive}
              />
            </div>

            <p className="mt-4 text-[11px] text-ink-soft">
              Un terrain construit ne peut pas être échangé : revendez d'abord ses maisons.
            </p>

            <div className="mt-3 flex justify-end gap-2">
              <button className="rounded border border-black/15 bg-white px-3 py-2 font-condensed text-sm uppercase hover:bg-black/5" onClick={onClose}>
                Fermer
              </button>
              <button
                className="rounded bg-[var(--color-accent)] px-3 py-2 font-condensed text-sm uppercase text-white hover:bg-[var(--color-accent-deep)]"
                onClick={submit}
              >
                Proposer
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-soft">Aucune autre joueuse en lice.</p>
        )}
      </div>
    </div>
  );
}
