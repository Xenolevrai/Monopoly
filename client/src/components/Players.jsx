/** Panneau des joueuses : solde, propriétés par couleur, état (prison, absente). */
import { propertiesByGroup, euros } from '../lib/board.js';

function PropertyChip({ item }) {
  const { space, houses, hotel, mortgaged } = item;
  return (
    <span
      title={`${space.name}${hotel ? ' — hôtel' : houses ? ` — ${houses} maison(s)` : ''}${
        mortgaged ? ' — hypothéquée' : ''
      }`}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-none ${
        mortgaged ? 'opacity-40 line-through' : ''
      }`}
      style={{ backgroundColor: `${item.space.group ? '' : ''}rgb(255 255 255 / 0.06)` }}
    >
      <span className="truncate max-w-[92px]">{space.shortName}</span>
      {hotel && <span className="text-gold-soft">▮</span>}
      {!hotel && houses > 0 && <span className="text-emerald-400">{'▪'.repeat(houses)}</span>}
    </span>
  );
}

function PlayerCard({ player, state, isMe, isCurrent }) {
  const groups = propertiesByGroup(state, player.id);

  return (
    <div
      className={`gilt-soft rounded-lg bg-night-soft/80 p-3 transition-all ${
        isCurrent ? 'ring-1 ring-gold/60' : ''
      } ${player.bankrupt ? 'opacity-45' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: player.color, boxShadow: `0 0 8px ${player.color}` }}
        />
        <span className="truncate font-medium">
          {player.name}
          {isMe && <span className="ml-1 text-[10px] text-muted">(vous)</span>}
        </span>
        <span className="tabular ml-auto shrink-0 text-gold-soft">{euros(player.cash)}</span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
        {player.bankrupt && <span className="text-rose-400">éliminée</span>}
        {player.inJail && <span className="text-amber-400">en prison ({player.jailTurns}/3)</span>}
        {!player.connected && !player.bankrupt && <span className="text-rose-300/80">absente</span>}
        {player.getOutOfJailCards > 0 && (
          <span className="text-emerald-300">
            {player.getOutOfJailCards} carte(s) de sortie
          </span>
        )}
      </div>

      {groups.length > 0 && (
        <div className="mt-2 space-y-1">
          {groups.map(({ group, items, complete }) => (
            <div key={group.id} className="flex items-start gap-1.5">
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor: group.color,
                  boxShadow: complete ? `0 0 8px ${group.color}` : 'none',
                  outline: complete ? '1px solid rgb(228 192 91 / 0.8)' : 'none',
                }}
                title={complete ? `${group.label} — groupe complet` : group.label}
              />
              <div className="flex flex-wrap gap-1">
                {items.map((item) => (
                  <PropertyChip key={item.spaceId} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Players({ state, me }) {
  const current = state.players[state.currentPlayerIndex];
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg tracking-widest text-gold-soft">JOUEUSES</h2>
        <span className="tabular text-[11px] text-muted">
          banque : {state.bank.houses} 🏠 · {state.bank.hotels} 🏨
        </span>
      </div>
      {state.players.map((player) => (
        <PlayerCard
          key={player.id}
          player={player}
          state={state}
          isMe={player.id === me?.id}
          isCurrent={player.id === current?.id && state.phase === 'playing'}
        />
      ))}
    </div>
  );
}
