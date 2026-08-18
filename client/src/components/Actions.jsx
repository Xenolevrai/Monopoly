/**
 * Barre d'action contextuelle : elle n'affiche que ce que le serveur attend
 * (`state.pending`). Aucune règle n'est décidée ici — le moteur refuserait de
 * toute façon une action illégale.
 *
 * En mode « même ordinateur », toutes les actions sont jouées au nom de `me`,
 * la joueuse du poste à qui le jeu demande quelque chose.
 */
import { useState } from 'react';
import { board, euros, groups } from '../lib/board.js';
import { sendAction } from '../lib/socket.js';
import TokenIcon from './TokenIcon.jsx';

function Button({ children, onClick, tone = 'primary', disabled, className = '' }) {
  const tones = {
    primary:
      'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-deep)] disabled:bg-black/15 disabled:text-black/40',
    ghost: 'bg-white border border-black/15 text-ink hover:bg-black/5 disabled:opacity-40',
    danger: 'bg-[#7a1015] text-white hover:bg-[#5d0c10] disabled:opacity-40',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded font-condensed text-sm uppercase tracking-wide transition-colors px-3 py-2 disabled:cursor-not-allowed ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Le titre de propriété, dans l'esprit des cartes du jeu. */
export function PropertyCard({ spaceId }) {
  const space = board[spaceId];
  if (!space) return null;
  const color = space.group ? groups[space.group]?.color : null;
  const rows =
    space.type === 'property'
      ? [
          ['Loyer terrain nu', space.rent[0]],
          ['Avec 1 maison', space.rent[1]],
          ['Avec 2 maisons', space.rent[2]],
          ['Avec 3 maisons', space.rent[3]],
          ['Avec 4 maisons', space.rent[4]],
          ['Avec hôtel', space.rent[5]],
        ]
      : space.type === 'railroad'
        ? space.rent.map((r, i) => [`${i + 1} gare${i ? 's' : ''} possédée${i ? 's' : ''}`, r])
        : [];

  return (
    <div className="overflow-hidden rounded border-2 border-ink bg-[var(--color-space)]">
      {color && (
        <div
          className="border-b-2 border-ink px-2 py-2 text-center"
          style={{ backgroundColor: color }}
        >
          <p className="font-condensed text-[13px] uppercase leading-tight text-ink">{space.name}</p>
        </div>
      )}
      <div className="p-2.5">
        {!color && (
          <p className="mb-1 text-center font-condensed text-[13px] uppercase">{space.name}</p>
        )}
        {rows.length > 0 && (
          <table className="w-full text-[11px]">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td className="py-px text-ink-soft">{label}</td>
                  <td className="tabular py-px text-right font-medium">{euros(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {space.type === 'utility' && (
          <p className="text-[11px] text-ink-soft">
            Loyer : 4 × le jet de dés, ou 10 × si les deux compagnies sont possédées.
          </p>
        )}
        <div className="mt-2 border-t border-black/15 pt-1.5 text-[11px] text-ink-soft">
          <p className="tabular">Prix d'achat : {euros(space.price)}</p>
          {space.houseCost && (
            <p className="tabular">
              Maison : {euros(space.houseCost)} · Hôtel : {euros(space.houseCost)} + 4 maisons
            </p>
          )}
          <p className="tabular">Valeur hypothécaire : {euros(space.mortgage)}</p>
        </div>
      </div>
    </div>
  );
}

function Roll({ payload, actor }) {
  if (!payload?.inJail) {
    return <Button onClick={() => sendAction({ type: 'ROLL_DICE' }, actor)}>Lancer les dés</Button>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-soft">
        En prison (tentative {payload.jailTurns + 1}/3). Faites un double, payez la caution, ou
        utilisez une carte.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => sendAction({ type: 'ROLL_DICE' }, actor)}>Tenter un double</Button>
        <Button
          tone="ghost"
          disabled={!payload.canPayBail}
          onClick={() => sendAction({ type: 'PAY_BAIL' }, actor)}
        >
          Payer {euros(payload.bail)}
        </Button>
        {payload.hasJailCard && (
          <Button tone="ghost" onClick={() => sendAction({ type: 'USE_JAIL_CARD' }, actor)}>
            Utiliser ma carte
          </Button>
        )}
      </div>
    </div>
  );
}

function BuyOrAuction({ payload, actor }) {
  return (
    <div className="space-y-3">
      <PropertyCard spaceId={payload.spaceId} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!payload.canAfford} onClick={() => sendAction({ type: 'BUY_PROPERTY' }, actor)}>
          Acheter — {euros(payload.price)}
        </Button>
        <Button tone="ghost" onClick={() => sendAction({ type: 'DECLINE_PROPERTY' }, actor)}>
          Refuser (enchère)
        </Button>
      </div>
      {!payload.canAfford && (
        <p className="text-xs text-[var(--color-accent)]">
          Fonds insuffisants : la propriété partira aux enchères.
        </p>
      )}
    </div>
  );
}

function Auction({ state, me, actor }) {
  const auction = state.auction;
  const [amount, setAmount] = useState(auction ? auction.highestBid + 10 : 10);
  if (!auction) return null;
  const highest = state.players.find((p) => p.id === auction.highestBidderId);

  return (
    <div className="space-y-3">
      <PropertyCard spaceId={auction.spaceId} />
      <p className="text-xs text-ink-soft">
        Enchère en cours : <span className="tabular font-semibold">{euros(auction.highestBid)}</span>
        {highest && <> — meilleure offre de {highest.name}</>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={auction.highestBid + 1}
          max={me?.cash ?? 0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="tabular w-28 rounded border border-black/20 bg-white px-2 py-2 text-sm"
        />
        <Button
          disabled={amount <= auction.highestBid || amount > (me?.cash ?? 0)}
          onClick={() => sendAction({ type: 'AUCTION_BID', amount }, actor)}
        >
          Miser
        </Button>
        <Button tone="ghost" onClick={() => sendAction({ type: 'AUCTION_PASS' }, actor)}>
          Passer
        </Button>
      </div>
    </div>
  );
}

function CardChoice({ payload, actor }) {
  return (
    <div className="flex flex-wrap gap-2">
      {payload.options.map((option) => (
        <Button
          key={option.index}
          onClick={() => sendAction({ type: 'CARD_CHOICE', optionIndex: option.index }, actor)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function Debt({ state, payload, actor, onOpenTrade, onOpenSettlement }) {
  const creditor = state.players.find((p) => p.id === payload.creditorId);
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Dette de{' '}
        <span className="tabular font-semibold text-[var(--color-accent)]">{euros(payload.amount)}</span>
        {creditor ? ` envers ${creditor.name}` : ' envers la banque'} ({payload.reason}).
      </p>
      <p className="text-xs text-ink-soft">
        Plusieurs portes de sortie : hypothéquer ou revendre ci-dessous, négocier avec les autres
        joueuses{creditor ? `, ou proposer un arrangement à ${creditor.name}` : ''}.
      </p>
      <div className="flex flex-wrap gap-2">
        {creditor && (
          <Button onClick={onOpenSettlement}>Proposer un arrangement à {creditor.name}</Button>
        )}
        <Button tone="ghost" onClick={onOpenTrade}>
          Négocier avec une autre
        </Button>
        <Button tone="danger" onClick={() => sendAction({ type: 'DECLARE_BANKRUPTCY' }, actor)}>
          Déclarer faillite
        </Button>
      </div>
      {!payload.canPay && !creditor && (
        <p className="text-xs text-[var(--color-accent)]">
          La banque n'accepte pas d'arrangement : sans fonds suffisants, c'est la faillite.
        </p>
      )}
    </div>
  );
}

/** Gestion du patrimoine : construire, revendre, hypothéquer. */
function Manage({ state, me }) {
  const owned = Object.values(state.properties).filter((p) => p.ownerId === me.id);
  if (!owned.length) return null;

  return (
    <div className="space-y-1.5">
      <h3 className="font-condensed text-[11px] uppercase tracking-[0.2em] text-ink-soft">
        Les biens de {me.name}
      </h3>
      <div className="scroll-thin max-h-52 space-y-1 overflow-y-auto pr-1">
        {owned
          .sort((a, b) => a.spaceId - b.spaceId)
          .map((prop) => {
            const space = board[prop.spaceId];
            const level = prop.hotel ? 5 : prop.houses;
            const btn = 'rounded border border-black/15 bg-white px-1.5 py-0.5 hover:bg-black/5';
            return (
              <div
                key={prop.spaceId}
                className="flex items-center gap-1.5 rounded border border-black/10 bg-white/70 px-2 py-1 text-[11px]"
              >
                {space.group && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/25"
                    style={{ backgroundColor: groups[space.group].color }}
                  />
                )}
                <span className="truncate">{space.shortName}</span>
                {level > 0 && (
                  <span className={prop.hotel ? 'text-[var(--color-hotel)]' : 'text-[var(--color-house)]'}>
                    {prop.hotel ? '▮' : '▪'.repeat(prop.houses)}
                  </span>
                )}
                {prop.mortgaged && <span className="text-[var(--color-accent)]">hyp.</span>}
                <span className="ml-auto flex gap-1">
                  {space.type === 'property' && !prop.mortgaged && (
                    <>
                      <button
                        className={btn}
                        title="Construire"
                        onClick={() => sendAction({ type: 'BUILD_HOUSE', spaceId: prop.spaceId }, me.id)}
                      >
                        +
                      </button>
                      {level > 0 && (
                        <button
                          className={btn}
                          title="Revendre une construction"
                          onClick={() => sendAction({ type: 'SELL_BUILDING', spaceId: prop.spaceId }, me.id)}
                        >
                          −
                        </button>
                      )}
                    </>
                  )}
                  {prop.mortgaged ? (
                    <button
                      className={btn}
                      title={`Lever l'hypothèque (${euros(Math.ceil(space.mortgage * 1.1))})`}
                      onClick={() => sendAction({ type: 'UNMORTGAGE', spaceId: prop.spaceId }, me.id)}
                    >
                      lever
                    </button>
                  ) : (
                    level === 0 && (
                      <button
                        className={btn}
                        title={`Hypothéquer (${euros(space.mortgage)})`}
                        onClick={() => sendAction({ type: 'MORTGAGE', spaceId: prop.spaceId }, me.id)}
                      >
                        hyp.
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

export default function Actions({ state, me, mine, onOpenTrade, onOpenSettlement }) {
  if (!me) return null;
  const { pending } = state;
  const actor = me.id;
  const mineTurn = pending.playerIds?.includes(me.id);
  const waitingFor = state.players.find((p) => p.id === pending.playerIds?.[0]);
  const hotSeat = mine.length > 1;
  const localIds = mine.map((p) => p.id);
  const pendingOffers = state.trades.filter(
    (t) => t.status === 'pending' && localIds.includes(t.toPlayerId),
  ).length;

  if (state.phase === 'finished') {
    const winner = state.players.find((p) => p.id === state.winnerId);
    return (
      <div className="panel rounded-lg p-4 text-center">
        <p className="font-condensed text-2xl uppercase tracking-widest">Partie terminée</p>
        <p className="mt-1 text-sm">{winner ? `${winner.name} remporte la partie !` : 'Match nul.'}</p>
      </div>
    );
  }

  return (
    <div className="panel space-y-3 rounded-lg p-4">
      {/* En mode partagé, on rappelle clairement à qui la souris doit passer. */}
      {hotSeat && mineTurn && (
        <div className="flex items-center gap-2 rounded border border-[var(--color-gold)]/50 bg-[var(--color-gold)]/10 px-2 py-1.5">
          <TokenIcon token={me.token} color={me.color} className="h-5 w-5" />
          <span className="font-condensed text-sm uppercase">À {me.name} de jouer</span>
        </div>
      )}

      {pendingOffers > 0 && (
        <button
          type="button"
          onClick={onOpenTrade}
          className="flex w-full items-center gap-2 rounded border border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 px-2 py-1.5 text-left"
        >
          <span className="font-condensed text-sm uppercase text-[var(--color-accent)]">
            {pendingOffers} offre{pendingOffers > 1 ? 's' : ''} en attente de votre réponse
          </span>
        </button>
      )}

      {!mineTurn && (
        <p className="text-sm text-ink-soft">
          {pending.kind === 'auction_bid'
            ? `Enchère : au tour de ${waitingFor?.name ?? '…'}`
            : `En attente de ${waitingFor?.name ?? '…'}`}
        </p>
      )}

      {mineTurn && pending.kind === 'roll' && <Roll payload={pending.payload} actor={actor} />}
      {mineTurn && pending.kind === 'draw_card' && (
        <div className="space-y-2">
          <p className="text-sm">
            {pending.payload.deck === 'chance' ? 'Case Chance' : 'Caisse de Communauté'} : piochez la
            carte du dessus du tas, au centre du plateau.
          </p>
          <Button onClick={() => sendAction({ type: 'DRAW_CARD' }, actor)}>Piocher une carte</Button>
        </div>
      )}
      {mineTurn && pending.kind === 'card_reveal' && (
        <div className="space-y-2">
          <p className="text-sm">« {pending.payload.text} »</p>
          <Button onClick={() => sendAction({ type: 'ACKNOWLEDGE_CARD' }, actor)}>J'applique</Button>
        </div>
      )}
      {mineTurn && pending.kind === 'buy_or_auction' && (
        <BuyOrAuction payload={pending.payload} actor={actor} />
      )}
      {mineTurn && pending.kind === 'auction_bid' && <Auction state={state} me={me} actor={actor} />}
      {mineTurn && pending.kind === 'card_choice' && <CardChoice payload={pending.payload} actor={actor} />}
      {mineTurn && pending.kind === 'pay_debt' && (
        <Debt
          state={state}
          payload={pending.payload}
          actor={actor}
          onOpenTrade={onOpenTrade}
          onOpenSettlement={onOpenSettlement}
        />
      )}
      {mineTurn && pending.kind === 'end_turn' && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => sendAction({ type: 'END_TURN' }, actor)}>
            {state.dice?.extraRoll ? 'Rejouer (double)' : 'Finir le tour'}
          </Button>
          <Button tone="ghost" onClick={onOpenTrade}>
            Échanger
          </Button>
        </div>
      )}

      {(!mineTurn || pending.kind !== 'end_turn') && state.phase === 'playing' && pending.kind !== 'pay_debt' && (
        <Button tone="ghost" onClick={onOpenTrade}>
          Négocier{pendingOffers > 0 ? ` (${pendingOffers} offre${pendingOffers > 1 ? 's' : ''})` : ''}
        </Button>
      )}

      <Manage state={state} me={me} />
    </div>
  );
}
