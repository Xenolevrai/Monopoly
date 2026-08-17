/**
 * Barre d'action contextuelle : elle n'affiche que ce que le serveur attend
 * (`state.pending`). Aucune règle n'est décidée ici — le moteur refuserait de
 * toute façon une action illégale.
 */
import { useState } from 'react';
import { board, euros } from '../lib/board.js';
import { sendAction } from '../lib/socket.js';

function Button({ children, onClick, tone = 'gold', disabled, className = '' }) {
  const tones = {
    gold: 'bg-gold/90 text-night hover:bg-gold-soft disabled:bg-gold/30',
    ghost: 'bg-white/5 text-parchment hover:bg-white/10 disabled:opacity-40',
    danger: 'bg-rose-600/80 text-white hover:bg-rose-500 disabled:opacity-40',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Fiche d'une propriété : prix, loyers, hypothèque. */
export function PropertyCard({ spaceId }) {
  const space = board[spaceId];
  if (!space) return null;
  const rows =
    space.type === 'property'
      ? [
          ['Loyer nu', space.rent[0]],
          ['1 maison', space.rent[1]],
          ['2 maisons', space.rent[2]],
          ['3 maisons', space.rent[3]],
          ['4 maisons', space.rent[4]],
          ['Hôtel', space.rent[5]],
        ]
      : space.type === 'railroad'
        ? space.rent.map((r, i) => [`${i + 1} gare${i ? 's' : ''}`, r])
        : [];

  return (
    <div className="rounded-md border border-white/10 bg-night-soft/80 p-3">
      <p className="font-display text-base text-gold-soft">{space.name}</p>
      <p className="tabular text-xs text-muted">Prix : {euros(space.price)}</p>
      {rows.length > 0 && (
        <table className="mt-2 w-full text-[11px]">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="text-muted">
                <td className="py-px">{label}</td>
                <td className="tabular py-px text-right text-parchment/90">{euros(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {space.type === 'utility' && (
        <p className="mt-2 text-[11px] text-muted">
          Loyer : dés × 4 (une compagnie) ou × 10 (les deux).
        </p>
      )}
      {space.houseCost && (
        <p className="mt-2 tabular text-[11px] text-muted">
          Maison : {euros(space.houseCost)} · Hypothèque : {euros(space.mortgage)}
        </p>
      )}
    </div>
  );
}

function Roll({ me, payload }) {
  if (!payload?.inJail) {
    return <Button onClick={() => sendAction({ type: 'ROLL_DICE' })}>Lancer les dés</Button>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        Vous êtes en prison (tentative {payload.jailTurns + 1}/3). Faites un double, payez la caution,
        ou utilisez une carte.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => sendAction({ type: 'ROLL_DICE' })}>Tenter un double</Button>
        <Button
          tone="ghost"
          disabled={!payload.canPayBail}
          onClick={() => sendAction({ type: 'PAY_BAIL' })}
        >
          Payer {euros(payload.bail)}
        </Button>
        {payload.hasJailCard && (
          <Button tone="ghost" onClick={() => sendAction({ type: 'USE_JAIL_CARD' })}>
            Utiliser ma carte
          </Button>
        )}
      </div>
    </div>
  );
}

function BuyOrAuction({ payload }) {
  return (
    <div className="space-y-3">
      <PropertyCard spaceId={payload.spaceId} />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!payload.canAfford}
          onClick={() => sendAction({ type: 'BUY_PROPERTY' })}
        >
          Acheter pour {euros(payload.price)}
        </Button>
        <Button tone="ghost" onClick={() => sendAction({ type: 'DECLINE_PROPERTY' })}>
          Refuser (mise aux enchères)
        </Button>
      </div>
      {!payload.canAfford && (
        <p className="text-xs text-rose-300">Fonds insuffisants : la propriété partira aux enchères.</p>
      )}
    </div>
  );
}

function Auction({ state, me }) {
  const auction = state.auction;
  const [amount, setAmount] = useState(auction ? auction.highestBid + 10 : 10);
  if (!auction) return null;
  const highest = state.players.find((p) => p.id === auction.highestBidderId);

  return (
    <div className="space-y-3">
      <PropertyCard spaceId={auction.spaceId} />
      <p className="text-xs text-muted">
        Enchère en cours :{' '}
        <span className="tabular text-gold-soft">{euros(auction.highestBid)}</span>
        {highest && <> — meilleure offre de {highest.name}</>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={auction.highestBid + 1}
          max={me?.cash ?? 0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="tabular w-28 rounded-md border border-white/10 bg-night px-2 py-2 text-sm"
        />
        <Button
          disabled={amount <= auction.highestBid || amount > (me?.cash ?? 0)}
          onClick={() => sendAction({ type: 'AUCTION_BID', amount })}
        >
          Miser
        </Button>
        <Button tone="ghost" onClick={() => sendAction({ type: 'AUCTION_PASS' })}>
          Passer
        </Button>
      </div>
    </div>
  );
}

function CardChoice({ payload }) {
  return (
    <div className="flex flex-wrap gap-2">
      {payload.options.map((option) => (
        <Button
          key={option.index}
          onClick={() => sendAction({ type: 'CARD_CHOICE', optionIndex: option.index })}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function Debt({ state, payload }) {
  const creditor = state.players.find((p) => p.id === payload.creditorId);
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Vous devez <span className="tabular text-rose-300">{euros(payload.amount)}</span>
        {creditor ? ` à ${creditor.name}` : ' à la banque'} ({payload.reason}).
      </p>
      <p className="text-xs text-muted">
        {payload.canPay
          ? 'Hypothéquez ou revendez des constructions ci-dessous pour réunir la somme.'
          : "Vous ne pouvez plus réunir cette somme : il ne reste que la faillite."}
      </p>
      <Button tone="danger" onClick={() => sendAction({ type: 'DECLARE_BANKRUPTCY' })}>
        Déclarer faillite
      </Button>
    </div>
  );
}

/** Gestion du patrimoine : construire, revendre, hypothéquer. */
function Manage({ state, me }) {
  const owned = Object.values(state.properties).filter((p) => p.ownerId === me.id);
  if (!owned.length) return null;

  return (
    <div className="space-y-1.5">
      <h3 className="text-[11px] uppercase tracking-widest text-muted">Mes biens</h3>
      <div className="scroll-thin max-h-56 space-y-1 overflow-y-auto pr-1">
        {owned
          .sort((a, b) => a.spaceId - b.spaceId)
          .map((prop) => {
            const space = board[prop.spaceId];
            const level = prop.hotel ? 5 : prop.houses;
            return (
              <div
                key={prop.spaceId}
                className="flex items-center gap-1.5 rounded bg-white/5 px-2 py-1 text-[11px]"
              >
                <span className="truncate">{space.shortName}</span>
                {level > 0 && (
                  <span className="text-emerald-400">{prop.hotel ? '▮' : '▪'.repeat(prop.houses)}</span>
                )}
                {prop.mortgaged && <span className="text-amber-400/80">hypo.</span>}
                <span className="ml-auto flex gap-1">
                  {space.type === 'property' && !prop.mortgaged && (
                    <>
                      <button
                        className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20"
                        title="Construire"
                        onClick={() => sendAction({ type: 'BUILD_HOUSE', spaceId: prop.spaceId })}
                      >
                        +
                      </button>
                      {level > 0 && (
                        <button
                          className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20"
                          title="Revendre une construction"
                          onClick={() => sendAction({ type: 'SELL_BUILDING', spaceId: prop.spaceId })}
                        >
                          −
                        </button>
                      )}
                    </>
                  )}
                  {prop.mortgaged ? (
                    <button
                      className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20"
                      title={`Lever l'hypothèque (${euros(Math.ceil(space.mortgage * 1.1))})`}
                      onClick={() => sendAction({ type: 'UNMORTGAGE', spaceId: prop.spaceId })}
                    >
                      lever
                    </button>
                  ) : (
                    level === 0 && (
                      <button
                        className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20"
                        title={`Hypothéquer (${euros(space.mortgage)})`}
                        onClick={() => sendAction({ type: 'MORTGAGE', spaceId: prop.spaceId })}
                      >
                        hypo.
                      </button>
                    )
                  )}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default function Actions({ state, me, onOpenTrade }) {
  if (!me) return null;
  const { pending } = state;
  const mine = pending.playerIds?.includes(me.id);
  const current = state.players[state.currentPlayerIndex];

  if (state.phase === 'finished') {
    const winner = state.players.find((p) => p.id === state.winnerId);
    return (
      <div className="gilt-soft rounded-lg bg-night-soft/80 p-4 text-center">
        <p className="font-display text-2xl text-gold-soft">Partie terminée</p>
        <p className="mt-1 text-sm">{winner ? `${winner.name} remporte la partie !` : 'Match nul.'}</p>
      </div>
    );
  }

  return (
    <div className="gilt-soft space-y-3 rounded-lg bg-night-soft/80 p-4">
      {!mine && (
        <p className="text-sm text-muted">
          {pending.kind === 'auction_bid'
            ? 'Enchère en cours…'
            : `En attente de ${state.players.find((p) => p.id === pending.playerIds?.[0])?.name ?? current?.name}…`}
        </p>
      )}

      {mine && pending.kind === 'roll' && <Roll me={me} payload={pending.payload} />}
      {mine && pending.kind === 'buy_or_auction' && <BuyOrAuction payload={pending.payload} />}
      {pending.kind === 'auction_bid' && mine && <Auction state={state} me={me} />}
      {mine && pending.kind === 'card_choice' && <CardChoice payload={pending.payload} />}
      {mine && pending.kind === 'pay_debt' && <Debt state={state} payload={pending.payload} />}
      {mine && pending.kind === 'end_turn' && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => sendAction({ type: 'END_TURN' })}>
            {state.dice?.extraRoll ? 'Rejouer (double)' : 'Finir mon tour'}
          </Button>
          <Button tone="ghost" onClick={onOpenTrade}>
            Proposer un échange
          </Button>
        </div>
      )}

      {!mine && state.phase === 'playing' && (
        <Button tone="ghost" onClick={onOpenTrade}>
          Proposer un échange
        </Button>
      )}

      <Manage state={state} me={me} />
    </div>
  );
}
