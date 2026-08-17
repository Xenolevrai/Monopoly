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
      <p className="text-[11px] uppercase tracking-widest text-muted">
        {title} — <span style={{ color: player.color }}>{player.name}</span>
      </p>

      <label className="flex items-center gap-2 text-xs">
        <span className="text-muted">Argent</span>
        <input
          type="number"
          min={0}
          max={player.cash}
          value={value.cash}
          onChange={(e) => onChange({ ...value, cash: Math.max(0, Number(e.target.value)) })}
          className="tabular w-24 rounded border border-white/10 bg-night px-2 py-1"
        />
        <span className="tabular text-muted">/ {euros(player.cash)}</span>
      </label>

      {player.getOutOfJailCards > 0 && (
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted">Cartes de prison</span>
          <input
            type="number"
            min={0}
            max={player.getOutOfJailCards}
            value={value.jailCards}
            onChange={(e) => onChange({ ...value, jailCards: Math.max(0, Number(e.target.value)) })}
            className="tabular w-16 rounded border border-white/10 bg-night px-2 py-1"
          />
        </label>
      )}

      <div className="scroll-thin max-h-40 space-y-1 overflow-y-auto pr-1">
        {owned.length === 0 && <p className="text-[11px] text-muted">Aucune propriété échangeable.</p>}
        {owned.map((prop) => {
          const space = board[prop.spaceId];
          const selected = value.spaceIds.includes(prop.spaceId);
          return (
            <button
              key={prop.spaceId}
              type="button"
              onClick={() => toggle(prop.spaceId)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] transition-colors ${
                selected ? 'bg-gold/25 text-parchment' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <span className="truncate">{space.shortName}</span>
              {prop.mortgaged && <span className="text-amber-400/80">hypo.</span>}
              <span className="tabular ml-auto text-muted">{euros(space.price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TradeDialog({ state, me, onClose }) {
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
    sendAction({ type: 'PROPOSE_TRADE', toPlayerId: targetId, give, receive });
    setGive({ cash: 0, spaceIds: [], jailCards: 0 });
    setReceive({ cash: 0, spaceIds: [], jailCards: 0 });
  };

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-night/80 p-4">
      <div className="gilt max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-night-soft p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl tracking-widest text-gold-soft">ÉCHANGE</h2>
          <button onClick={onClose} className="text-muted hover:text-parchment">
            ✕
          </button>
        </div>

        {incoming.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-[11px] uppercase tracking-widest text-muted">Propositions reçues</p>
            {incoming.map((trade) => {
              const from = state.players.find((p) => p.id === trade.fromPlayerId);
              return (
                <div key={trade.id} className="rounded-md border border-white/10 bg-white/5 p-3 text-xs">
                  <p>
                    <span style={{ color: from?.color }}>{from?.name}</span> vous donne{' '}
                    <span className="text-emerald-300">{describe(trade.give)}</span> contre{' '}
                    <span className="text-amber-300">{describe(trade.receive)}</span>.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded bg-gold/90 px-3 py-1 text-night hover:bg-gold-soft"
                      onClick={() =>
                        sendAction({ type: 'RESPOND_TRADE', tradeId: trade.id, accept: true })
                      }
                    >
                      Accepter
                    </button>
                    <button
                      className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
                      onClick={() =>
                        sendAction({ type: 'RESPOND_TRADE', tradeId: trade.id, accept: false })
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
            <p className="text-[11px] uppercase tracking-widest text-muted">En attente de réponse</p>
            {outgoing.map((trade) => {
              const to = state.players.find((p) => p.id === trade.toPlayerId);
              return (
                <div key={trade.id} className="flex items-center gap-2 text-xs text-muted">
                  <span>Proposition à {to?.name}</span>
                  <button
                    className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
                    onClick={() => sendAction({ type: 'CANCEL_TRADE', tradeId: trade.id })}
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
              <span className="text-muted">Échanger avec</span>
              <select
                value={targetId}
                onChange={(e) => {
                  setTargetId(e.target.value);
                  setReceive({ cash: 0, spaceIds: [], jailCards: 0 });
                }}
                className="rounded border border-white/10 bg-night px-2 py-1"
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

            <p className="mt-4 text-[11px] text-muted">
              Un terrain construit ne peut pas être échangé : revendez d'abord ses maisons.
            </p>

            <div className="mt-3 flex justify-end gap-2">
              <button className="rounded-md bg-white/5 px-3 py-2 text-sm hover:bg-white/10" onClick={onClose}>
                Fermer
              </button>
              <button
                className="rounded-md bg-gold/90 px-3 py-2 text-sm font-medium text-night hover:bg-gold-soft"
                onClick={submit}
              >
                Proposer
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Aucune autre joueuse en lice.</p>
        )}
      </div>
    </div>
  );
}
