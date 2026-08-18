/** Panneau des joueuses : solde, propriétés par couleur, état (prison, absente). */
import { propertiesByGroup, euros } from '../lib/board.js';
import TokenIcon from './TokenIcon.jsx';
import { BillStack } from './Money.jsx';

function PropertyChip({ item, groupColor }) {
  const { space, houses, hotel, mortgaged } = item;
  return (
    <span
      title={`${space.name}${hotel ? ' — hôtel' : houses ? ` — ${houses} maison(s)` : ''}${
        mortgaged ? ' — hypothéquée' : ''
      }`}
      className={`flex items-center gap-1 rounded border border-black/10 bg-white px-1.5 py-0.5 text-[10px] leading-none ${
        mortgaged ? 'opacity-45 line-through' : ''
      }`}
    >
      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: groupColor }} />
      <span className="max-w-[92px] truncate">{space.shortName}</span>
      {hotel && <span className="text-[var(--color-hotel)]">▮</span>}
      {!hotel && houses > 0 && <span className="text-[var(--color-house)]">{'▪'.repeat(houses)}</span>}
    </span>
  );
}

function PlayerCard({ player, state, isLocal, isActingHere, isCurrent, onFocus }) {
  const groups = propertiesByGroup(state, player.id);

  return (
    <div
      className={`rounded-md border bg-white/70 p-2.5 transition-all ${
        isCurrent ? 'border-[var(--color-accent)] shadow-[0_0_0_2px_rgba(179,36,44,.18)]' : 'border-black/10'
      } ${player.bankrupt ? 'opacity-50' : ''} ${isActingHere ? 'ring-2 ring-[var(--color-gold)]' : ''}`}
    >
      <button
        type="button"
        onClick={() => isLocal && onFocus?.(player.id)}
        className={`flex w-full items-center gap-2 text-left ${isLocal ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black/25 bg-white"
          style={{ boxShadow: `0 0 0 1.5px ${player.color}55` }}
        >
          <TokenIcon token={player.token} color={player.color} className="h-4 w-4" />
        </span>
        <span className="truncate font-condensed text-[15px] uppercase">{player.name}</span>
        {isLocal && (
          <span className="rounded bg-[var(--color-gold)]/20 px-1 text-[9px] uppercase tracking-wide text-[#6b5216]">
            ici
          </span>
        )}
        <span className="tabular ml-auto shrink-0 font-semibold text-[var(--color-money)]">
          {euros(player.cash)}
        </span>
      </button>

      <div className="mt-1.5">
        <BillStack amount={player.cash} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-soft">
        {player.bankrupt && <span className="text-[var(--color-accent)]">éliminée</span>}
        {player.inJail && <span className="text-[var(--color-accent)]">en prison ({player.jailTurns}/3)</span>}
        {!player.connected && !player.bankrupt && <span className="text-[var(--color-accent)]">absente</span>}
        {player.getOutOfJailCards > 0 && (
          <span className="text-[var(--color-money)]">{player.getOutOfJailCards} carte(s) de sortie</span>
        )}
      </div>

      {groups.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {groups.map(({ group, items, complete }) => (
            <div key={group.id} className="flex items-start gap-1.5">
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm border border-black/30"
                style={{
                  backgroundColor: group.color,
                  outline: complete ? '1.5px solid var(--color-gold)' : 'none',
                }}
                title={complete ? `${group.label} — groupe complet` : group.label}
              />
              <div className="flex flex-wrap gap-1">
                {items.map((item) => (
                  <PropertyChip key={item.spaceId} item={item} groupColor={group.color} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Players({ state, mine, me, onFocus }) {
  const current = state.players[state.currentPlayerIndex];
  const localIds = new Set(mine.map((p) => p.id));

  return (
    <div className="panel space-y-2 rounded-lg p-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-condensed text-base uppercase tracking-[0.2em]">Joueuses</h2>
        <span className="tabular text-[11px] text-ink-soft">
          banque : {state.bank.houses} maisons · {state.bank.hotels} hôtels
        </span>
      </div>
      {state.players.map((player) => (
        <PlayerCard
          key={player.id}
          player={player}
          state={state}
          isLocal={localIds.has(player.id)}
          isActingHere={mine.length > 1 && player.id === me?.id}
          isCurrent={player.id === current?.id && state.phase === 'playing'}
          onFocus={onFocus}
        />
      ))}
      {mine.length > 1 && (
        <p className="text-[10px] text-ink-soft">
          Plusieurs joueuses sur cet écran : cliquez sur un nom pour agir en son nom hors de son tour.
        </p>
      )}
    </div>
  );
}
