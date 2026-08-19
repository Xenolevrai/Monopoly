/**
 * Négociations : échanges libres et arrangements pour solder une dette.
 *
 * Deux principes de souplesse :
 *  - on répond à une proposition **quand on veut**, sans attendre son tour ;
 *  - sur un écran partagé, les propositions adressées à n'importe quelle joueuse
 *    du poste sont visibles et répondables tout de suite.
 */
import { useState } from 'react';
import { boardOf, groupsOf, money } from '../lib/board.js';
import { useT } from '../lib/i18n.js';
import { sendAction } from '../lib/socket.js';
import TokenIcon from './TokenIcon.jsx';
import { BillPicker } from './Money.jsx';

function Side({ title, player, state, value, onChange }) {
  const t = useT(state);
  const board = boardOf(state);
  const groups = groupsOf(state);
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

      <div className="space-y-1">
        <p className="text-[11px] text-ink-soft">{t('billsOnTable')}</p>
        <BillPicker
          state={state}
          value={value.cash}
          max={player.cash}
          onChange={(cash) => onChange({ ...value, cash })}
        />
      </div>

      {player.getOutOfJailCards > 0 && (
        <label className="flex items-center gap-2 text-xs">
          <span className="text-ink-soft">{t('jailCards')}</span>
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
        {owned.length === 0 && <p className="text-[11px] text-ink-soft">{t('nothingTradable')}</p>}
        {owned.map((prop) => {
          const space = board[prop.spaceId];
          const selected = value.spaceIds.includes(prop.spaceId);
          return (
            <button
              key={prop.spaceId}
              type="button"
              onClick={() => toggle(prop.spaceId)}
              className={`flex w-full items-center gap-2 rounded border px-2 py-1 text-left text-[11px] transition-colors ${
                selected
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12'
                  : 'border-black/10 bg-white hover:bg-black/5'
              }`}
            >
              {space.group && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/25"
                  style={{ backgroundColor: groups[space.group].color }}
                />
              )}
              <span className="truncate">{space.shortName}</span>
              {prop.mortgaged && <span className="text-[var(--color-accent)]">hyp.</span>}
              <span className="tabular ml-auto text-ink-soft">{money(state, space.price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const EMPTY = { cash: 0, spaceIds: [], jailCards: 0 };

export default function TradeDialog({ state, me, mine, onClose, settleMode = false }) {
  const t = useT(state);
  const localIds = mine.map((p) => p.id);
  const debt = state.debt;

  // En mode arrangement, c'est la débitrice qui propose, à sa créancière.
  const debtor = settleMode ? state.players.find((p) => p.id === debt?.debtorId) : null;
  const [fromId, setFromId] = useState(settleMode ? debt?.debtorId : me.id);
  const from = state.players.find((p) => p.id === fromId) ?? me;

  const others = state.players.filter((p) => p.id !== from.id && !p.bankrupt);
  const forcedTarget = settleMode ? debt?.creditorId : null;
  const [targetId, setTargetId] = useState(forcedTarget ?? others[0]?.id ?? null);
  const target = state.players.find((p) => p.id === (forcedTarget ?? targetId));

  const [give, setGive] = useState(EMPTY);
  const [receive, setReceive] = useState(EMPTY);
  const board = boardOf(state);

  // Toutes les propositions adressées à une joueuse de ce poste.
  const incoming = state.trades.filter((t) => t.status === 'pending' && localIds.includes(t.toPlayerId));
  const outgoing = state.trades.filter((t) => t.status === 'pending' && localIds.includes(t.fromPlayerId));

  const describe = (side) =>
    [
      side.cash ? money(state, side.cash) : null,
      ...side.spaceIds.map((id) => board[id].shortName),
      side.jailCards ? `${side.jailCards} carte(s) de prison` : null,
    ]
      .filter(Boolean)
      .join(', ') || t('nothing');

  const submit = () => {
    if (!target) return;
    sendAction(
      {
        type: 'PROPOSE_TRADE',
        toPlayerId: target.id,
        give,
        receive,
        ...(settleMode ? { settlesDebt: true } : {}),
      },
      from.id,
    );
    setGive(EMPTY);
    setReceive(EMPTY);
    if (settleMode) onClose();
  };

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-condensed text-xl uppercase tracking-[0.2em]">
            {settleMode ? t('proposeArrangement') : t('negotiate')}
          </h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">
            ✕
          </button>
        </div>

        {settleMode && debt && (
          <p className="mb-4 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 p-3 text-xs">
            {debtor?.name} doit <span className="tabular font-semibold">{money(state, debt.amount)}</span> à{' '}
            {target?.name}. Proposez ce que vous voulez — des propriétés, de l'argent, une carte de
            prison. <strong>Si {target?.name} accepte, la dette est effacée</strong>, quel que soit
            le montant cédé.
          </p>
        )}

        {incoming.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
              {t('offersReceived')}
            </p>
            {incoming.map((trade) => {
              const proposer = state.players.find((p) => p.id === trade.fromPlayerId);
              const recipient = state.players.find((p) => p.id === trade.toPlayerId);
              return (
                <div
                  key={trade.id}
                  className={`rounded border p-3 text-xs ${
                    trade.settlesDebt
                      ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/8'
                      : 'border-black/10 bg-white'
                  }`}
                >
                  <p className="mb-1 flex items-center gap-1.5">
                    <TokenIcon token={recipient?.token} color={recipient?.color} className="h-4 w-4" />
                    <span className="font-condensed uppercase">{t('forPlayer', recipient?.name)}</span>
                    {trade.settlesDebt && (
                      <span className="rounded bg-[var(--color-accent)] px-1.5 py-px text-[10px] uppercase text-white">
                        {t('arrangement')} — {money(state, trade.debtAmount)}
                      </span>
                    )}
                  </p>
                  <p>
                    <span style={{ color: proposer?.color }}>{proposer?.name}</span> {t('gives').toLowerCase()}{' '}
                    <span className="text-[var(--color-money)]">{describe(trade.give)}</span> {t('receives').toLowerCase()}{' '}
                    <span className="text-[#8a5a00]">{describe(trade.receive)}</span>.
                    {trade.settlesDebt && ` ${t('debtCleared')}`}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded bg-[var(--color-accent)] px-3 py-1 font-condensed uppercase text-white hover:bg-[var(--color-accent-deep)]"
                      onClick={() =>
                        sendAction(
                          { type: 'RESPOND_TRADE', tradeId: trade.id, accept: true },
                          trade.toPlayerId,
                        )
                      }
                    >
                      {t('accept')}
                    </button>
                    <button
                      className="rounded border border-black/15 bg-white px-3 py-1 font-condensed uppercase hover:bg-black/5"
                      onClick={() =>
                        sendAction(
                          { type: 'RESPOND_TRADE', tradeId: trade.id, accept: false },
                          trade.toPlayerId,
                        )
                      }
                    >
                      {t('refuse')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {outgoing.length > 0 && (
          <div className="mb-4 space-y-1">
            <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
              {t('awaitingReply')}
            </p>
            {outgoing.map((trade) => {
              const to = state.players.find((p) => p.id === trade.toPlayerId);
              return (
                <div key={trade.id} className="flex items-center gap-2 text-xs text-ink-soft">
                  <span>{t('proposalTo', to?.name)}</span>
                  <button
                    className="rounded border border-black/15 bg-white px-2 py-0.5 hover:bg-black/5"
                    onClick={() =>
                      sendAction({ type: 'CANCEL_TRADE', tradeId: trade.id }, trade.fromPlayerId)
                    }
                  >
                    {t('cancel')}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {target ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              {mine.length > 1 && !settleMode && (
                <>
                  <span className="text-ink-soft">{t('onBehalfOf')}</span>
                  <select
                    value={fromId}
                    onChange={(e) => {
                      setFromId(e.target.value);
                      setGive(EMPTY);
                    }}
                    className="rounded border border-black/20 bg-white px-2 py-1"
                  >
                    {mine
                      .filter((p) => !p.bankrupt)
                      .map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                  </select>
                </>
              )}
              <span className="text-ink-soft">{t('with')}</span>
              {settleMode ? (
                <span className="font-condensed uppercase">{target.name}</span>
              ) : (
                <select
                  value={targetId ?? ''}
                  onChange={(e) => {
                    setTargetId(e.target.value);
                    setReceive(EMPTY);
                  }}
                  className="rounded border border-black/20 bg-white px-2 py-1"
                >
                  {others.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-col gap-5 sm:flex-row">
              <Side title={t("gives")} player={from} state={state} value={give} onChange={setGive} />
              <Side title={t("receives")} player={target} state={state} value={receive} onChange={setReceive} />
            </div>

            <p className="mt-4 text-[11px] text-ink-soft">
              {t('tradeHint')}
            </p>

            <div className="mt-3 flex justify-end gap-2">
              <button
                className="rounded border border-black/15 bg-white px-3 py-2 font-condensed text-sm uppercase hover:bg-black/5"
                onClick={onClose}
              >
                {t('close')}
              </button>
              <button
                className="rounded bg-[var(--color-accent)] px-3 py-2 font-condensed text-sm uppercase text-white hover:bg-[var(--color-accent-deep)]"
                onClick={submit}
              >
                {settleMode ? t('proposeArrangement') : t('propose')}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-soft">{t('noOneElse')}</p>
        )}
      </div>
    </div>
  );
}
