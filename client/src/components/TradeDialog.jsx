/**
 * Négociations : échanges libres et arrangements pour solder une dette.
 *
 * Visualisation complète des groupes/sets de propriétés par couleur,
 * sélection automatique du proposeur lors de la réception d'une offre,
 * et possibilité de contre-proposer en un clic.
 */
import { useState, useEffect } from 'react';
import { boardOf, groupsOf, money } from '../lib/board.js';
import { useT } from '../lib/i18n.js';
import { sendAction } from '../lib/socket.js';
import TokenIcon from './TokenIcon.jsx';
import { BillPicker } from './Money.jsx';

function PropertySetGroup({ groupKey, group, items, selectedIds, onToggle, state }) {
  const isComplete = items.length === group.spaces?.length;
  const ownedCount = items.length;
  const totalCount = group.spaces?.length ?? items.length;

  return (
    <div className="rounded-lg border border-black/10 bg-stone-50/80 p-2 text-xs shadow-xs space-y-1.5">
      {/* En-tête du groupe de couleur */}
      <div className="flex items-center justify-between border-b border-black/5 pb-1">
        <div className="flex items-center gap-1.5 truncate">
          <span
            className="h-3 w-3 shrink-0 rounded-sm border border-black/30 shadow-xs"
            style={{ backgroundColor: group.color }}
          />
          <span className="font-condensed font-bold uppercase tracking-wide text-ink text-[11px] truncate">
            {group.label ?? groupKey}
          </span>
        </div>
        <span
          className={`shrink-0 rounded px-1.5 py-0.2 font-condensed text-[9px] font-bold uppercase ${
            isComplete
              ? 'bg-amber-400/30 text-amber-950 border border-amber-500/40'
              : 'bg-stone-200/80 text-stone-700'
          }`}
        >
          {isComplete ? '★ Complet' : `${ownedCount}/${totalCount}`}
        </span>
      </div>

      {/* Liste des cartes du groupe */}
      <div className="grid gap-1">
        {items.map(({ space, prop }) => {
          const isTradable = !prop.hotel && prop.houses === 0;
          const selected = selectedIds.includes(prop.spaceId);

          if (!isTradable) {
            return (
              <div
                key={prop.spaceId}
                title="Les constructions doivent être revendues avant d'échanger"
                className="flex items-center justify-between rounded border border-black/10 bg-stone-100/70 px-2 py-1 text-[11px] opacity-60 cursor-not-allowed"
              >
                <span className="truncate font-medium text-stone-600">{space.shortName}</span>
                <span className="shrink-0 text-[10px] text-amber-800 font-semibold">
                  {prop.hotel ? '🏨 Hôtel' : `🏠x${prop.houses}`}
                </span>
              </div>
            );
          }

          return (
            <button
              key={prop.spaceId}
              type="button"
              onClick={() => onToggle(prop.spaceId)}
              className={`flex items-center justify-between gap-1.5 rounded border px-2 py-1 text-left text-[11px] transition-all cursor-pointer ${
                selected
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 font-bold text-[var(--color-accent-deep)] shadow-xs ring-1 ring-[var(--color-accent)]'
                  : 'border-black/10 bg-white hover:bg-black/5 text-ink'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
                    selected ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white' : 'border-black/30 bg-white'
                  }`}
                >
                  {selected ? '✓' : ''}
                </span>
                <span className="truncate">{space.shortName}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 text-[10px]">
                {prop.mortgaged && (
                  <span className="rounded bg-rose-100 px-1 text-rose-800 font-bold uppercase text-[8px]">
                    Hyp.
                  </span>
                )}
                <span className="tabular font-semibold text-ink-soft">{money(state, space.price)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Side({ title, player, state, value, onChange }) {
  const t = useT(state);
  const board = boardOf(state);
  const groups = groupsOf(state);

  // Group properties of player
  const allOwned = Object.values(state.properties)
    .filter((p) => p.ownerId === player.id)
    .map((prop) => ({ prop, space: board[prop.spaceId] }))
    .sort((a, b) => a.prop.spaceId - b.prop.spaceId);

  const byGroup = new Map();
  for (const item of allOwned) {
    const gKey = item.space.group ?? 'other';
    const list = byGroup.get(gKey) ?? [];
    list.push(item);
    byGroup.set(gKey, list);
  }

  const toggle = (spaceId) => {
    const next = value.spaceIds.includes(spaceId)
      ? value.spaceIds.filter((id) => id !== spaceId)
      : [...value.spaceIds, spaceId];
    onChange({ ...value, spaceIds: next });
  };

  const totalCards = allOwned.length;
  const tradableCards = allOwned.filter((i) => !i.prop.hotel && i.prop.houses === 0).length;

  return (
    <div className="flex-1 space-y-2.5 rounded-xl border border-black/10 bg-white/80 p-3 shadow-sm">
      <div className="flex items-center justify-between border-b border-black/10 pb-2">
        <div className="flex items-center gap-2">
          <TokenIcon token={player.token} color={player.color} className="h-5 w-5" />
          <p className="font-condensed text-xs font-bold uppercase tracking-wider text-ink">
            {title} — <span style={{ color: player.color }}>{player.name}</span>
          </p>
        </div>
        <span className="tabular font-bold text-xs text-[var(--color-money)]">
          {money(state, player.cash)}
        </span>
      </div>

      <div className="space-y-1">
        <p className="font-condensed text-[10px] uppercase tracking-wider text-ink-soft">{t('billsOnTable')}</p>
        <BillPicker
          state={state}
          value={value.cash}
          max={player.cash}
          onChange={(cash) => onChange({ ...value, cash })}
        />
      </div>

      {player.getOutOfJailCards > 0 && (
        <label className="flex items-center justify-between rounded border border-black/10 bg-white p-1.5 text-xs">
          <span className="text-ink-soft">🎴 {t('jailCards')} (max {player.getOutOfJailCards})</span>
          <input
            type="number"
            min={0}
            max={player.getOutOfJailCards}
            value={value.jailCards}
            onChange={(e) => onChange({ ...value, jailCards: Math.max(0, Number(e.target.value)) })}
            className="tabular w-14 rounded border border-black/20 bg-white px-2 py-0.5 text-right font-bold"
          />
        </label>
      )}

      {/* Propriétés classées par Groupes / Sets */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-condensed uppercase tracking-wider text-ink-soft">
          <span>{t('properties')} ({tradableCards} échangeables)</span>
          {value.spaceIds.length > 0 && (
            <span className="font-bold text-[var(--color-accent)]">{value.spaceIds.length} sélectionnée(s)</span>
          )}
        </div>

        <div className="scroll-thin max-h-56 space-y-2 overflow-y-auto pr-1">
          {allOwned.length === 0 ? (
            <p className="text-[11px] text-ink-soft italic p-2">{t('nothingTradable')}</p>
          ) : (
            Array.from(byGroup.entries()).map(([gKey, items]) => {
              const group = groups[gKey] ?? {
                label: gKey === 'other' ? 'Autres titres' : gKey,
                color: '#64748b',
                spaces: items.map((i) => i.prop.spaceId),
              };
              return (
                <PropertySetGroup
                  key={gKey}
                  groupKey={gKey}
                  group={group}
                  items={items}
                  selectedIds={value.spaceIds}
                  onToggle={toggle}
                  state={state}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const EMPTY = { cash: 0, spaceIds: [], jailCards: 0 };

export default function TradeDialog({ state, me, mine, onClose, settleMode = false, initialTargetId = null }) {
  const t = useT(state);
  const localIds = mine.map((p) => p.id);
  const debt = state.debt;

  // En mode arrangement, c'est la débitrice qui propose, à sa créancière.
  const debtor = settleMode ? state.players.find((p) => p.id === debt?.debtorId) : null;
  const [fromId, setFromId] = useState(settleMode ? debt?.debtorId : me.id);
  const from = state.players.find((p) => p.id === fromId) ?? me;

  const others = state.players.filter((p) => p.id !== from.id && !p.bankrupt);

  // Toutes les propositions adressées à une joueuse de ce poste.
  const incoming = state.trades.filter((t) => t.status === 'pending' && localIds.includes(t.toPlayerId));
  const outgoing = state.trades.filter((t) => t.status === 'pending' && localIds.includes(t.fromPlayerId));

  // Cible par défaut : forcedTarget > initialTargetId > premier proposeur d'une offre reçue > premier autre joueur
  const forcedTarget = settleMode ? debt?.creditorId : null;
  const defaultTarget = forcedTarget ?? initialTargetId ?? incoming[0]?.fromPlayerId ?? others[0]?.id ?? null;
  const [targetId, setTargetId] = useState(defaultTarget);

  useEffect(() => {
    if (initialTargetId && !forcedTarget) {
      setTargetId(initialTargetId);
    }
  }, [initialTargetId, forcedTarget]);

  const target = state.players.find((p) => p.id === (forcedTarget ?? targetId));

  const [give, setGive] = useState(EMPTY);
  const [receive, setReceive] = useState(EMPTY);
  const board = boardOf(state);

  const describe = (side) =>
    [
      side.cash ? money(state, side.cash) : null,
      ...side.spaceIds.map((id) => board[id]?.shortName ?? board[id]?.name),
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

  const handleCounterPropose = (trade) => {
    // Switch target to the proposer of this trade and pre-fill exchange
    setFromId(trade.toPlayerId);
    setTargetId(trade.fromPlayerId);
    setGive(trade.receive ?? EMPTY);
    setReceive(trade.give ?? EMPTY);
  };

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
      <div className="panel max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between border-b border-black/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤝</span>
            <div>
              <h2 className="font-condensed text-xl font-bold uppercase tracking-[0.15em] text-ink">
                {settleMode ? t('proposeArrangement') : t('negotiate')}
              </h2>
              <p className="text-xs text-ink-soft">
                {settleMode ? 'Arrangement amiable pour éponger une dette' : 'Échange libre de propriétés, argent et cartes'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink text-base font-bold">
            ✕
          </button>
        </div>

        {settleMode && debt && (
          <p className="mb-4 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-3 text-xs leading-relaxed">
            {debtor?.name} doit <span className="tabular font-semibold text-[var(--color-accent)]">{money(state, debt.amount)}</span> à{' '}
            <strong>{target?.name}</strong>. Proposez ce que vous voulez — des propriétés, de l'argent, une carte de
            prison. <strong>Si {target?.name} accepte, la dette est effacée</strong>, quel que soit
            le montant cédé.
          </p>
        )}

        {/* Offres reçues en attente */}
        {incoming.length > 0 && (
          <div className="mb-4 space-y-2 rounded-xl border border-amber-500/40 bg-amber-50/70 p-3">
            <div className="flex items-center gap-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-amber-950">
              <span>📬</span>
              <span>{t('offersReceived')} ({incoming.length})</span>
            </div>

            {incoming.map((trade) => {
              const proposer = state.players.find((p) => p.id === trade.fromPlayerId);
              const recipient = state.players.find((p) => p.id === trade.toPlayerId);
              return (
                <div
                  key={trade.id}
                  className={`rounded-lg border p-3 text-xs shadow-xs ${
                    trade.settlesDebt
                      ? 'border-[var(--color-accent)]/50 bg-white'
                      : 'border-black/10 bg-white'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <TokenIcon token={recipient?.token} color={recipient?.color} className="h-4 w-4" />
                      <span className="font-condensed font-bold uppercase">{t('forPlayer', recipient?.name)}</span>
                      {trade.settlesDebt && (
                        <span className="rounded bg-[var(--color-accent)] px-1.5 py-px text-[9px] uppercase text-white font-bold">
                          {t('arrangement')} — {money(state, trade.debtAmount)}
                        </span>
                      )}
                    </div>
                    <span className="font-condensed text-[10px] text-ink-soft">
                      Proposé par <strong style={{ color: proposer?.color }}>{proposer?.name}</strong>
                    </span>
                  </div>

                  <p className="leading-snug">
                    <span className="font-bold" style={{ color: proposer?.color }}>{proposer?.name}</span> vous offre{' '}
                    <span className="font-bold text-[var(--color-money)]">{describe(trade.give)}</span> en échange de{' '}
                    <span className="font-bold text-amber-800">{describe(trade.receive)}</span>.
                    {trade.settlesDebt && ` ${t('debtCleared')}`}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded bg-emerald-600 px-3 py-1 font-condensed text-xs font-bold uppercase text-white hover:bg-emerald-700 shadow-xs"
                      onClick={() =>
                        sendAction(
                          { type: 'RESPOND_TRADE', tradeId: trade.id, accept: true },
                          trade.toPlayerId,
                        )
                      }
                    >
                      ✓ {t('accept')}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-black/15 bg-white px-3 py-1 font-condensed text-xs uppercase hover:bg-black/5"
                      onClick={() =>
                        sendAction(
                          { type: 'RESPOND_TRADE', tradeId: trade.id, accept: false },
                          trade.toPlayerId,
                        )
                      }
                    >
                      ✕ {t('refuse')}
                    </button>
                    <button
                      type="button"
                      className="ml-auto rounded border border-amber-500/50 bg-amber-100/80 px-2.5 py-1 font-condensed text-xs font-bold uppercase text-amber-950 hover:bg-amber-200"
                      onClick={() => handleCounterPropose(trade)}
                    >
                      🔍 Négocier / Contre-proposer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Offres envoyées */}
        {outgoing.length > 0 && (
          <div className="mb-3 space-y-1 rounded-lg border border-black/10 bg-stone-50 p-2.5">
            <p className="font-condensed text-[10px] uppercase tracking-widest text-ink-soft">
              {t('awaitingReply')}
            </p>
            {outgoing.map((trade) => {
              const to = state.players.find((p) => p.id === trade.toPlayerId);
              return (
                <div key={trade.id} className="flex items-center justify-between text-xs text-ink-soft">
                  <span>{t('proposalTo', to?.name)} ({describe(trade.give)} ➔ {describe(trade.receive)})</span>
                  <button
                    type="button"
                    className="rounded border border-black/15 bg-white px-2 py-0.5 text-[10px] hover:bg-black/5"
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

        {/* Formulaire de négociation */}
        {target ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-stone-100 p-2 text-xs">
              {mine.length > 1 && !settleMode && (
                <div className="flex items-center gap-1.5">
                  <span className="font-condensed uppercase text-ink-soft">{t('onBehalfOf')}</span>
                  <select
                    value={fromId}
                    onChange={(e) => {
                      setFromId(e.target.value);
                      setGive(EMPTY);
                    }}
                    className="rounded border border-black/20 bg-white px-2 py-1 font-bold"
                  >
                    {mine
                      .filter((p) => !p.bankrupt)
                      .map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <span className="font-condensed uppercase text-ink-soft">{t('with')}</span>
              {settleMode ? (
                <span className="font-condensed font-bold uppercase text-ink">{target.name}</span>
              ) : (
                <select
                  value={targetId ?? ''}
                  onChange={(e) => {
                    setTargetId(e.target.value);
                    setReceive(EMPTY);
                  }}
                  className="rounded border border-black/20 bg-white px-2.5 py-1 font-bold text-ink"
                >
                  {others.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({money(state, player.cash)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Side title={t('gives')} player={from} state={state} value={give} onChange={setGive} />
              <Side title={t('receives')} player={target} state={state} value={receive} onChange={setReceive} />
            </div>

            {/* Récapitulatif de l'offre */}
            <div className="mt-4 rounded-lg border border-black/10 bg-stone-50 p-2.5 text-xs text-ink space-y-1">
              <div className="flex items-center justify-between">
                <span>
                  <strong>{from.name}</strong> donne : <span className="font-semibold text-[var(--color-money)]">{describe(give)}</span>
                </span>
                <span>➔</span>
                <span>
                  reçoit : <span className="font-semibold text-amber-800">{describe(receive)}</span> de <strong>{target.name}</strong>
                </span>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2.5">
              <button
                type="button"
                className="rounded-lg border border-black/15 bg-white px-4 py-2 font-condensed text-xs font-bold uppercase hover:bg-black/5"
                onClick={onClose}
              >
                {t('close')}
              </button>
              <button
                type="button"
                disabled={give.cash === 0 && give.spaceIds.length === 0 && give.jailCards === 0 && receive.cash === 0 && receive.spaceIds.length === 0 && receive.jailCards === 0}
                className="rounded-lg bg-[var(--color-accent)] px-5 py-2 font-condensed text-xs font-bold uppercase text-white hover:bg-[var(--color-accent-deep)] disabled:opacity-40 shadow-md"
                onClick={submit}
              >
                {settleMode ? t('proposeArrangement') : t('propose')}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-soft italic p-4 text-center">{t('noOneElse')}</p>
        )}
      </div>
    </div>
  );
}
