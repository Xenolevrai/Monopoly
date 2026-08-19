/**
 * Barre d'action contextuelle : elle n'affiche que ce que le serveur attend
 * (`state.pending`). Aucune règle n'est décidée ici — le moteur refuserait de
 * toute façon une action illégale.
 *
 * En mode « même ordinateur », toutes les actions sont jouées au nom de `me`,
 * la joueuse du poste à qui le jeu demande quelque chose.
 */
import { useState } from 'react';
import { boardOf, groupsOf, money, buildingLabels, editionFor } from '../lib/board.js';
import { useT } from '../lib/i18n.js';
import { sendAction } from '../lib/socket.js';
import TokenIcon from './TokenIcon.jsx';
import { BillStack } from './Money.jsx';

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
export function PropertyCard({ state, spaceId }) {
  const t = useT(state);
  const space = boardOf(state)[spaceId];
  if (!space) return null;
  const color = space.group ? groupsOf(state)[space.group]?.color : null;
  const labels = buildingLabels(state);
  const rows =
    space.type === 'property'
      ? [
          [t('bareRent'), space.rent[0]],
          [t('withN', 1, labels.house.toLowerCase()), space.rent[1]],
          [t('withN', 2, labels.houses.toLowerCase()), space.rent[2]],
          [t('withN', 3, labels.houses.toLowerCase()), space.rent[3]],
          [t('withN', 4, labels.houses.toLowerCase()), space.rent[4]],
          ...(editionFor(state).mechanics.hotels
            ? [[t('withOne', labels.hotel.toLowerCase()), space.rent[5]]]
            : []),
        ]
      : space.type === 'railroad'
        ? space.rent.map((r, i) => [
            t('ownedCount', i + 1, groupsOf(state)[space.group]?.label ?? ''),
            r,
          ])
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
                  <td className="tabular py-px text-right font-medium">{money(state, value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {space.type === 'utility' && (
          <p className="text-[11px] text-ink-soft">
            {t('utilityRent', space.rentMultipliers[0], space.rentMultipliers[1])}
          </p>
        )}
        <div className="mt-2 border-t border-black/15 pt-1.5 text-[11px] text-ink-soft">
          <p className="tabular">
            {t('price')} : {money(state, space.price)}
          </p>
          {space.houseCost && (
            <p className="tabular">
              {labels.house} : {money(state, space.houseCost)}
              {editionFor(state).mechanics.hotels && (
                <>
                  {' · '}
                  {labels.hotel} : {money(state, space.houseCost)} + 4 {labels.houses.toLowerCase()}
                </>
              )}
            </p>
          )}
          {editionFor(state).mechanics.mortgage && (
            <p className="tabular">
              {t('mortgageValue')} : {money(state, space.mortgage)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Roll({ state, payload, actor }) {
  const t = useT(state);
  if (!payload?.inJail) {
    return <Button onClick={() => sendAction({ type: 'ROLL_DICE' }, actor)}>{t('rollDice')}</Button>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-soft">
        {t('inJailFor', payload.jailTurns + 1, editionFor(state).jail.maxTurns)}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => sendAction({ type: 'ROLL_DICE' }, actor)}>{t('tryDouble')}</Button>
        <Button
          tone="ghost"
          disabled={!payload.canPayBail}
          onClick={() => sendAction({ type: 'PAY_BAIL' }, actor)}
        >
          {t('payBail')} {money(state, payload.bail)}
        </Button>
        {payload.hasJailCard && (
          <Button tone="ghost" onClick={() => sendAction({ type: 'USE_JAIL_CARD' }, actor)}>
            {t('useCard')}
          </Button>
        )}
      </div>
    </div>
  );
}

function BuyOrAuction({ state, me, payload, actor }) {
  const t = useT(state);
  const edition = editionFor(state);
  // `payload.canAfford` est figé au moment où la case a été résolue : si l'on
  // hypothèque un bien entre-temps pour réunir la somme, il faut relire le
  // solde courant plutôt que ce cliché, sans quoi le bouton reste grisé alors
  // que l'argent est là.
  const canAfford = me.cash >= payload.price;
  return (
    <div className="space-y-3">
      <PropertyCard state={state} spaceId={payload.spaceId} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!canAfford} onClick={() => sendAction({ type: 'BUY_PROPERTY' }, actor)}>
          {edition.vocabulary?.buy ?? t('buy')} — {money(state, payload.price)}
        </Button>
        <Button tone="ghost" onClick={() => sendAction({ type: 'DECLINE_PROPERTY' }, actor)}>
          {t('decline')}
        </Button>
      </div>
      {!canAfford && (
        <p className="text-xs text-[var(--color-accent)]">
          {t(edition.mechanics.mortgage ? 'cannotAfford' : 'cannotAffordNoMortgage')}
        </p>
      )}
    </div>
  );
}

function Auction({ state, me, actor }) {
  const t = useT(state);
  const auction = state.auction;
  const [amount, setAmount] = useState(auction ? String(auction.highestBid + 10) : '10');
  if (!auction) return null;
  const highest = state.players.find((p) => p.id === auction.highestBidderId);
  const numericAmount = amount === '' ? 0 : Number(amount);

  // Un <input type="number"> contrôlé par un state numérique laisse parfois un
  // zéro de tête sur mobile (« 0350 ») : on travaille en chaîne de chiffres et on
  // nettoie nous-mêmes, ce qui marche pareil sur tous les claviers.
  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    setAmount(digits);
  };

  return (
    <div className="space-y-3">
      <PropertyCard state={state} spaceId={auction.spaceId} />
      <p className="text-xs text-ink-soft">
        Enchère en cours : <span className="tabular font-semibold">{money(state, auction.highestBid)}</span>
        {highest && <> — meilleure offre de {highest.name}</>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={amount}
          onChange={handleChange}
          className="tabular w-28 rounded border border-black/20 bg-white px-2 py-2 text-sm"
        />
        <Button
          disabled={numericAmount <= auction.highestBid || numericAmount > (me?.cash ?? 0)}
          onClick={() => sendAction({ type: 'AUCTION_BID', amount: numericAmount }, actor)}
        >
          {t('bid')}
        </Button>
        <Button tone="ghost" onClick={() => sendAction({ type: 'AUCTION_PASS' }, actor)}>
          {t('pass')}
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

function Debt({ state, me, payload, actor, onOpenTrade, onOpenSettlement }) {
  const t = useT(state);
  const creditor = state.players.find((p) => p.id === payload.creditorId);
  const hasCash = me.cash >= payload.amount;

  return (
    <div className="space-y-2">
      <p className="text-sm">
        {creditor ? 'Loyer' : 'À payer'} :{' '}
        <span className="tabular font-semibold text-[var(--color-accent)]">{money(state, payload.amount)}</span>
        {creditor ? ` pour ${creditor.name}` : ' à la banque'} ({payload.reason}).
      </p>

      {/* Ce qu'on pose sur la table si l'on paie comptant. */}
      {hasCash && (
        <div className="rounded border border-black/10 bg-white p-2">
          <p className="mb-1 text-[11px] text-ink-soft">{t('billsToHand')}</p>
          <BillStack state={state} amount={payload.amount} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button disabled={!hasCash} onClick={() => sendAction({ type: 'PAY_DEBT' }, actor)}>
          {t('pay')} {money(state, payload.amount)}
        </Button>
        {creditor && (
          <Button tone="ghost" onClick={onOpenSettlement}>
            {t('arrangeWith', creditor.name)}
          </Button>
        )}
        <Button tone="ghost" onClick={onOpenTrade}>
          {t('negotiateElsewhere')}
        </Button>
        {editionFor(state).mechanics.bankruptcyEliminates && (
          <Button tone="danger" onClick={() => sendAction({ type: 'DECLARE_BANKRUPTCY' }, actor)}>
            {t('bankruptcy')}
          </Button>
        )}
      </div>

      <p className="text-xs text-ink-soft">
        {creditor
          ? `Rien n'est prélevé d'office : vous pouvez payer, proposer à ${creditor.name} des terrains ou un mélange des deux, ou vendre quelque chose d'abord.`
          : 'Hypothéquez ou revendez ci-dessous pour réunir la somme.'}
      </p>

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
  const board = boardOf(state);
  const groups = groupsOf(state);
  const labels = buildingLabels(state);
  const t = useT(state);
  // Une édition sans hypothèque ne doit pas montrer le bouton : il serait refusé.
  const canMortgage = editionFor(state).mechanics.mortgage;

  return (
    <div className="space-y-1.5">
      <h3 className="font-condensed text-[11px] uppercase tracking-[0.2em] text-ink-soft">
        {t('myAssets', me.name)}
      </h3>
      <div className="scroll-thin max-h-52 space-y-1 overflow-y-auto pr-1">
        {owned
          .sort((a, b) => a.spaceId - b.spaceId)
          .map((prop) => {
            const space = board[prop.spaceId];
            const level = prop.hotel ? 5 : prop.houses;
            const btn = 'rounded border border-black/15 bg-white px-1.5 py-1 hover:bg-black/5';
            // Les infobulles (`title`) ne s'affichent jamais au doigt : le prix doit
            // être écrit en toutes lettres sur le bouton, pas seulement au survol.
            return (
              <div
                key={prop.spaceId}
                className={`flex flex-wrap items-center gap-1.5 rounded border px-2 py-1.5 text-[11px] ${
                  prop.mortgaged
                    ? 'border-dashed border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5'
                    : 'border-black/10 bg-white/70'
                }`}
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
                {prop.mortgaged && (
                  <span className="rounded-sm bg-[var(--color-accent)] px-1 py-0.5 font-condensed text-[9px] uppercase tracking-wide text-white">
                    {t('mortgaged')}
                  </span>
                )}
                <span className="ml-auto flex gap-1">
                  {space.type === 'property' && !prop.mortgaged && (
                    <>
                      <button
                        className={btn}
                        title={`${t("build")} (${labels.house.toLowerCase()})`}
                        onClick={() => sendAction({ type: 'BUILD_HOUSE', spaceId: prop.spaceId }, me.id)}
                      >
                        +
                      </button>
                      {level > 0 && (
                        <button
                          className={btn}
                          title={`${t("sellBuilding")} (${labels.house.toLowerCase()})`}
                          onClick={() => sendAction({ type: 'SELL_BUILDING', spaceId: prop.spaceId }, me.id)}
                        >
                          −
                        </button>
                      )}
                    </>
                  )}
                  {canMortgage &&
                    (prop.mortgaged ? (
                      <button
                        className={btn}
                        onClick={() => sendAction({ type: 'UNMORTGAGE', spaceId: prop.spaceId }, me.id)}
                      >
                        {t('unmortgage')} ({money(state, Math.ceil(space.mortgage * 1.1))})
                      </button>
                    ) : (
                      level === 0 && (
                        <button
                          className={btn}
                          onClick={() => sendAction({ type: 'MORTGAGE', spaceId: prop.spaceId }, me.id)}
                        >
                          {t('mortgage')} ({money(state, space.mortgage)})
                        </button>
                      )
                    ))}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default function Actions({ state, me, mine, onOpenTrade, onOpenSettlement }) {
  const t = useT(state);
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
    const standings = state.standings ?? [];
    return (
      <div className="panel space-y-2 rounded-lg p-4">
        <p className="text-center font-condensed text-2xl uppercase tracking-widest">{t('gameOver')}</p>
        <p className="text-center text-sm">
          {winner ? `${winner.name} l'emporte !` : 'Match nul.'}
        </p>
        {standings.length > 0 && (
          <ol className="space-y-1 pt-1">
            {standings.map((entry, index) => {
              const player = state.players.find((p) => p.id === entry.playerId);
              return (
                <li
                  key={entry.playerId}
                  className="flex items-center gap-2 rounded border border-black/10 bg-white px-2 py-1 text-sm"
                >
                  <span className="font-condensed text-ink-soft">{index + 1}.</span>
                  {player && <TokenIcon token={player.token} color={player.color} className="h-4 w-4" />}
                  <span className="font-condensed uppercase">{entry.name}</span>
                  <span className="tabular ml-auto font-semibold text-[var(--color-money)]">
                    {money(state, entry.worth)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="text-center text-[11px] text-ink-soft">
          Classement au patrimoine : liquide, propriétés et constructions.
        </p>
      </div>
    );
  }

  return (
    <div className="panel space-y-3 rounded-lg p-4">
      {/* En mode partagé, on rappelle clairement à qui la souris doit passer. */}
      {hotSeat && mineTurn && (
        <div className="flex items-center gap-2 rounded border border-[var(--color-gold)]/50 bg-[var(--color-gold)]/10 px-2 py-1.5">
          <TokenIcon token={me.token} color={me.color} className="h-5 w-5" />
          <span className="font-condensed text-sm uppercase">{t('yourTurn', me.name)}</span>
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
            ? t('auctionTurn', waitingFor?.name ?? '…')
            : t('waitingFor', waitingFor?.name ?? '…')}
        </p>
      )}

      {mineTurn && pending.kind === 'roll' && (
        <Roll state={state} payload={pending.payload} actor={actor} />
      )}
      {mineTurn && pending.kind === 'draw_card' && (
        <div className="space-y-2">
          <p className="text-sm">
            {t('drawFromPile', editionFor(state).theming?.decks?.[pending.payload.deck]?.label)}
          </p>
          <Button onClick={() => sendAction({ type: 'DRAW_CARD' }, actor)}>{t('drawCard')}</Button>
        </div>
      )}
      {mineTurn && pending.kind === 'card_reveal' && (
        <div className="space-y-2">
          <p className="text-sm">« {pending.payload.text} »</p>
          <Button onClick={() => sendAction({ type: 'ACKNOWLEDGE_CARD' }, actor)}>{t('applyCard')}</Button>
        </div>
      )}
      {mineTurn && pending.kind === 'buy_or_auction' && (
        <BuyOrAuction state={state} me={me} payload={pending.payload} actor={actor} />
      )}
      {mineTurn && pending.kind === 'auction_bid' && <Auction state={state} me={me} actor={actor} />}
      {mineTurn && pending.kind === 'card_choice' && <CardChoice payload={pending.payload} actor={actor} />}
      {mineTurn && pending.kind === 'pay_debt' && (
        <Debt
          state={state}
          me={me}
          payload={pending.payload}
          actor={actor}
          onOpenTrade={onOpenTrade}
          onOpenSettlement={onOpenSettlement}
        />
      )}
      {mineTurn && pending.kind === 'end_turn' && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => sendAction({ type: 'END_TURN' }, actor)}>
            {state.dice?.extraRoll ? t('playAgain') : t('endTurn')}
          </Button>
          <Button tone="ghost" onClick={onOpenTrade}>
            {t('trade')}
          </Button>
        </div>
      )}

      {(!mineTurn || pending.kind !== 'end_turn') && state.phase === 'playing' && pending.kind !== 'pay_debt' && (
        <Button tone="ghost" onClick={onOpenTrade}>
          {t('negotiate')}{pendingOffers > 0 ? ` (${pendingOffers})` : ''}
        </Button>
      )}

      <Manage state={state} me={me} />
    </div>
  );
}
