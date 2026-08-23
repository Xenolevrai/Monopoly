import { useState, useEffect } from 'react';
import TokenIcon from './TokenIcon.jsx';
import { money } from '../lib/board.js';

const SPINNER_SECTORS = [
  { id: 'red-50', color: '#b91c1c', bg: '#dc2626', labelFr: '-50 €', labelEn: '-$50', subFr: 'au Jackpot', subEn: 'to Jackpot', icon: '💸' },
  { id: 'green-free-house', color: '#15803d', bg: '#16a34a', labelFr: 'MAISON', labelEn: 'FREE HOUSE', subFr: 'Offerte', subEn: 'Free Build', icon: '🏠' },
  { id: 'red-100', color: '#b91c1c', bg: '#dc2626', labelFr: '-100 €', labelEn: '-$100', subFr: 'au Jackpot', subEn: 'to Jackpot', icon: '💸' },
  { id: 'green-jackpot', color: '#15803d', bg: '#16a34a', labelFr: 'JACKPOT !', labelEn: 'JACKPOT!', subFr: 'Tout ramasser', subEn: 'Collect All', icon: '💰' },
  { id: 'red-150', color: '#b91c1c', bg: '#dc2626', labelFr: '-150 €', labelEn: '-$150', subFr: 'au Jackpot', subEn: 'to Jackpot', icon: '💸' },
  { id: 'green-dealmobile', color: '#15803d', bg: '#16a34a', labelFr: 'DEAL MOBILE', labelEn: 'DEAL MOBILE', subFr: 'Voiture dorée', subEn: 'Golden Car', icon: '🚗' },
  { id: 'red-200', color: '#b91c1c', bg: '#dc2626', labelFr: '-200 €', labelEn: '-$200', subFr: 'au Jackpot', subEn: 'to Jackpot', icon: '💸' },
  { id: 'green-property', color: '#15803d', bg: '#16a34a', labelFr: 'TITRE AU CHOIX', labelEn: 'BUY ANY 1', subFr: '1 Propriété libre', subEn: '1 Property', icon: '🏷️' },
];

/** Roulette du Parc Gratuit diffusée à tous les joueurs */
function SpinnerBroadcastModal({ event, isEn, onClose }) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(true);
  const targetIndex = event.sectorIndex ?? 0;
  const sector = SPINNER_SECTORS[targetIndex] ?? SPINNER_SECTORS[0];

  useEffect(() => {
    const targetAngle = 360 * 5 + (270 - (targetIndex * 45 + 22.5));
    const timer = setTimeout(() => {
      setRotation(targetAngle);
    }, 50);

    const finishTimer = setTimeout(() => {
      setIsSpinning(false);
    }, 3300);

    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
    };
  }, [targetIndex]);

  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-sm w-full">
      {/* En-tête du joueur */}
      <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-400/20 px-4 py-1.5 backdrop-blur-md shadow-sm">
        <TokenIcon token={event.actorToken} color={event.actorColor} className="h-5 w-5" />
        <span className="font-condensed text-sm font-bold tracking-wide text-amber-950 uppercase">
          {event.actorName} {isEn ? 'spins the Free Parking Wheel!' : 'tourne la Roulette du Parc Gratuit !'}
        </span>
      </div>

      {/* Cadre de la Roulette SVG */}
      <div className="relative flex items-center justify-center p-2">
        {/* Curseur Aiguille en haut */}
        <div className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 drop-shadow-md">
          <div className="h-0 w-0 border-x-[12px] border-x-transparent border-t-[20px] border-t-amber-400 animate-bounce" />
        </div>

        {/* La Roue tournante */}
        <div
          className="h-56 w-56 rounded-full border-4 border-amber-500 bg-stone-900 shadow-2xl overflow-hidden"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 3.2s cubic-bezier(0.12, 0.8, 0.3, 1)',
          }}
        >
          <svg viewBox="0 0 200 200" className="h-full w-full">
            {SPINNER_SECTORS.map((sec, idx) => {
              const startAngle = (idx * 45 * Math.PI) / 180;
              const endAngle = ((idx + 1) * 45 * Math.PI) / 180;
              const x1 = 100 + 100 * Math.cos(startAngle);
              const y1 = 100 + 100 * Math.sin(startAngle);
              const x2 = 100 + 100 * Math.cos(endAngle);
              const y2 = 100 + 100 * Math.sin(endAngle);
              const midAngle = ((idx + 0.5) * 45 * Math.PI) / 180;
              const tx = 100 + 65 * Math.cos(midAngle);
              const ty = 100 + 65 * Math.sin(midAngle);
              const textRotate = (idx + 0.5) * 45 + 90;

              return (
                <g key={sec.id}>
                  <path
                    d={`M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`}
                    fill={sec.bg}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={tx}
                    y={ty}
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="Oswald, sans-serif"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${textRotate}, ${tx}, ${ty})`}
                  >
                    {isEn ? sec.labelEn : sec.labelFr}
                  </text>
                </g>
              );
            })}
            {/* Centre de la Roue */}
            <circle cx="100" cy="100" r="22" fill="#1c1917" stroke="#f59e0b" strokeWidth="3" />
            <text
              x="100"
              y="104"
              fill="#fbbf24"
              fontSize="12"
              fontWeight="bold"
              textAnchor="middle"
            >
              ★
            </text>
          </svg>
        </div>
      </div>

      {/* Résultat affiché après l'arrêt */}
      {!isSpinning && (
        <div className="fade-in space-y-2 w-full rounded-xl border-2 border-amber-500 bg-white/95 p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">{sector.icon}</span>
            <span className="font-condensed text-xl font-extrabold uppercase tracking-wide text-ink">
              {isEn ? sector.labelEn : sector.labelFr}
            </span>
          </div>
          <p className="text-xs font-semibold text-ink-soft">
            {isEn ? sector.subEn : sector.subFr}
          </p>

          {event.drawnBonusTitle && (
            <div className="mt-2 border-t border-amber-200 pt-2 text-xs text-amber-900">
              <span className="font-bold">🎁 {isEn ? 'Bonus Card Drawn:' : 'Carte Bonus piochée :'}</span>{' '}
              <span className="font-semibold italic">« {event.drawnBonusTitle} »</span>
              {event.drawnBonusText && (
                <p className="mt-1 text-[11px] text-ink-soft leading-tight">{event.drawnBonusText}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-lg bg-amber-600 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:bg-amber-700 transition-colors"
          >
            {isEn ? 'OK' : 'Compris'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Carte Jouée (Bonus, Corruption, Super Corruption, Vente) diffusée à tous */
function CardPlayedBroadcastModal({ event, isEn, onClose }) {
  const isCorruption = event.category === 'corruption';
  const isSuperCorruption = event.category === 'super_corruption';
  const isSale = event.category === 'sale';

  let badge = isEn ? 'Bonus Card Played' : 'Carte Bonus Activée';
  let themeBorder = 'border-amber-400 bg-gradient-to-b from-amber-50 to-white text-amber-950';
  let badgeColor = 'bg-amber-500 text-white';
  let icon = '🎁';

  if (isSuperCorruption) {
    badge = isEn ? 'SUPER CORRUPTION CARD' : 'CARTE SUPER CORRUPTION';
    themeBorder = 'border-purple-500 bg-gradient-to-b from-purple-950 via-purple-900 to-slate-900 text-purple-100 shadow-[0_0_35px_rgba(168,85,247,0.5)]';
    badgeColor = 'bg-purple-600 text-white animate-pulse';
    icon = '⚡';
  } else if (isCorruption) {
    badge = isEn ? 'CORRUPTION CARD' : 'CARTE CORRUPTION';
    themeBorder = 'border-blue-500 bg-gradient-to-b from-slate-900 to-slate-800 text-blue-100 shadow-xl';
    badgeColor = 'bg-blue-600 text-white';
    icon = '⚖️';
  } else if (isSale) {
    const isWin = event.cardType === 'instant_win';
    badge = isWin ? (isEn ? 'INSTANT WIN SALE CARD' : 'VICTOIRE IMMÉDIATE') : (isEn ? 'SALE VAULT CARD' : 'CARTE VENTE DU COFFRE');
    themeBorder = isWin
      ? 'border-emerald-500 bg-gradient-to-b from-emerald-950 to-green-900 text-white shadow-[0_0_35px_rgba(16,185,129,0.6)]'
      : 'border-emerald-500 bg-gradient-to-b from-emerald-50 to-white text-emerald-950 shadow-xl';
    badgeColor = isWin ? 'bg-emerald-500 text-white animate-bounce' : 'bg-emerald-600 text-white';
    icon = isWin ? '🏆' : '🗄️';
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-sm w-full">
      {/* Joueur initiateur */}
      <div className="flex items-center gap-2 rounded-full border border-black/15 bg-white/90 px-4 py-1.5 backdrop-blur-md shadow-md">
        <TokenIcon token={event.actorToken} color={event.actorColor} className="h-5 w-5" />
        <span className="font-condensed text-sm font-bold tracking-wide text-ink uppercase">
          {event.actorName} {isEn ? 'played a card!' : 'a activé une carte !'}
        </span>
      </div>

      {/* Rendu Carte Grand Format */}
      <div className={`card-flip relative w-full rounded-2xl border-4 p-5 text-center shadow-2xl ${themeBorder}`}>
        <span className={`inline-block rounded-full px-3 py-0.5 font-condensed text-[11px] font-extrabold uppercase tracking-widest ${badgeColor}`}>
          {icon} {badge}
        </span>

        <h3 className="mt-3 font-condensed text-2xl font-black uppercase tracking-wide">
          {event.title}
        </h3>

        <p className="mt-2 text-sm leading-relaxed font-medium opacity-90">
          {event.text}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-black/20 hover:bg-black/30 py-2 font-condensed text-xs font-bold uppercase tracking-wider transition-colors border border-white/20"
        >
          {isEn ? 'Dismiss' : 'Compris'}
        </button>
      </div>
    </div>
  );
}

/** Lancer de dé spécial (Buy Die, Escape Die, Heist Die) */
function SpecialDieBroadcastModal({ event, isEn, onClose }) {
  const isBuy = event.type === 'buy_die_rolled';
  const isEscape = event.type === 'escape_die_rolled';
  const isHeist = event.type === 'heist_die_rolled';

  let title = isEn ? 'Special Die Rolled' : 'Dé Spécial Lancé';
  let resultTitle = '';
  let resultDesc = '';
  let icon = '🎲';
  let badgeClass = 'bg-stone-800 text-white';

  if (isBuy) {
    title = isEn ? 'Buy Die (Buy Everything)' : "Dé d'Achat (Tout Acheter)";
    if (event.face?.type === 'buy_card') {
      icon = '🟢';
      badgeClass = 'bg-emerald-600 text-white';
      resultTitle = isEn ? 'BUY SALE CARD' : 'ACHAT DE CARTE';
      resultDesc = isEn ? 'May buy 1 Sale card from the Vault!' : 'Autorisé à acheter 1 carte au Coffre-Fort !';
    } else if (event.face?.type === 'force_discard') {
      icon = '🔴';
      badgeClass = 'bg-rose-600 text-white';
      resultTitle = isEn ? 'FORCE DISCARD' : 'DÉFAUSSE FORCÉE';
      resultDesc = isEn ? 'Forces an opponent to discard a Sale card!' : 'Force un adversaire à défausser 1 carte Vente !';
    } else {
      icon = '🟡';
      badgeClass = 'bg-amber-500 text-white';
      resultTitle = isEn ? 'REFRESH VAULT' : 'RENOUVELLEMENT DU COFFRE';
      resultDesc = isEn ? 'Replaces 1 card in the Sale Vault from the deck.' : 'Remplace 1 carte du Coffre-Fort par la pioche.';
    }
  } else if (isEscape) {
    title = isEn ? 'Escape Die (Chance)' : "Dé Évasion (Chance)";
    if (event.face?.isGreen) {
      icon = '🟢';
      badgeClass = 'bg-emerald-600 text-white';
      resultTitle = isEn ? `SUCCESS (+${event.face.count} CARDS)` : `ÉVASION RÉUSSIE (+${event.face.count} CARTES)`;
      resultDesc = isEn ? `Draws ${event.face.count} Corruption card(s)!` : `Pioche ${event.face.count} carte(s) Corruption !`;
    } else {
      icon = '👮‍♂️';
      badgeClass = 'bg-blue-700 text-white';
      resultTitle = isEn ? 'BUSTED BY POLICE!' : 'ARRESTATION PAR LA POLICE !';
      resultDesc = isEn ? 'Sent directly to Jail!' : 'Envoyé directement en Prison !';
    }
  } else if (isHeist) {
    title = isEn ? 'Heist Die (Community Chest)' : "Dé Casse (Caisse de communauté)";
    if (event.face?.isCash) {
      icon = '💵';
      badgeClass = 'bg-amber-600 text-white';
      resultTitle = isEn ? `HEIST SUCCESS (+${event.face.amount} €)` : `CASSE RÉUSSI (+${event.face.amount} €)`;
      resultDesc = isEn ? `Collects ${event.face.amount} € from the Bank!` : `Encaisse ${event.face.amount} € de la Banque !`;
    } else {
      icon = '👮‍♂️';
      badgeClass = 'bg-blue-700 text-white';
      resultTitle = isEn ? 'BUSTED BY POLICE!' : 'ARRESTATION PAR LA POLICE !';
      resultDesc = isEn ? 'Sent directly to Jail!' : 'Envoyé directement en Prison !';
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-sm w-full">
      <div className="flex items-center gap-2 rounded-full border border-black/15 bg-white/90 px-4 py-1.5 backdrop-blur-md shadow-md">
        <TokenIcon token={event.actorToken} color={event.actorColor} className="h-5 w-5" />
        <span className="font-condensed text-sm font-bold tracking-wide text-ink uppercase">
          {event.actorName} : {title}
        </span>
      </div>

      <div className="w-full rounded-2xl border-2 border-black/10 bg-white/95 p-5 text-center shadow-2xl backdrop-blur-md">
        <div className="text-4xl animate-bounce mb-2">{icon}</div>
        <span className={`inline-block rounded-full px-3 py-0.5 font-condensed text-xs font-extrabold uppercase tracking-widest ${badgeClass}`}>
          {resultTitle}
        </span>
        <p className="mt-3 text-sm font-semibold text-ink leading-snug">{resultDesc}</p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-stone-800 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:bg-stone-900 transition-colors"
        >
          {isEn ? 'OK' : 'Compris'}
        </button>
      </div>
    </div>
  );
}

/** Notification d'achat de propriété / titre / carte Vente */
function PurchaseBroadcastModal({ event, state, isEn, onClose }) {
  const isSpecial = event.isSpecial;
  const isSaleCard = event.type === 'sale_card_bought';

  let badge = isEn ? 'PURCHASE' : 'ACHAT';
  let badgeClass = 'bg-emerald-600 text-white';

  if (isSpecial) {
    badge = isEn ? 'SPECIAL LANDMARK' : 'TITRE DE COIN SPÉCIAL';
    badgeClass = 'bg-amber-600 text-white animate-pulse';
  } else if (isSaleCard) {
    badge = isEn ? 'SALE VAULT CARD' : 'CARTE VENTE DU COFFRE';
    badgeClass = 'bg-emerald-700 text-white';
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-sm w-full">
      <div className="flex items-center gap-2 rounded-full border border-black/15 bg-white/90 px-4 py-1.5 backdrop-blur-md shadow-md">
        <TokenIcon token={event.actorToken} color={event.actorColor} className="h-5 w-5" />
        <span className="font-condensed text-sm font-bold tracking-wide text-ink uppercase">
          {event.actorName}
        </span>
      </div>

      <div className="w-full rounded-2xl border-2 border-emerald-500/40 bg-white/95 p-5 text-center shadow-2xl backdrop-blur-md">
        <span className={`inline-block rounded-full px-3 py-0.5 font-condensed text-xs font-extrabold uppercase tracking-widest ${badgeClass}`}>
          {badge}
        </span>

        <h3 className="mt-2 font-condensed text-xl font-bold uppercase text-ink">
          {isSaleCard ? event.title : event.spaceName}
        </h3>

        <p className="mt-1 font-extrabold text-base text-[var(--color-money)]">
          {money(state, event.price)}
        </p>

        {isSpecial && (
          <p className="mt-2 text-xs font-medium text-amber-900 bg-amber-50 p-2 rounded border border-amber-200">
            🏰 {isEn ? 'Corner Deed: Progressive Corner Rent applies!' : 'Titre de Coin : Loyer de coin progressif selon le nombre détenu !'}
          </p>
        )}

        {isSaleCard && event.text && (
          <p className="mt-2 text-xs text-ink-soft leading-tight">{event.text}</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-emerald-700 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-800 transition-colors"
        >
          {isEn ? 'OK' : 'Fermer'}
        </button>
      </div>
    </div>
  );
}

/** Envoi en Prison / Super Prison */
function JailBroadcastModal({ event, isEn, onClose }) {
  const isSuper = event.tier === 'super';

  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-sm w-full">
      <div className="w-full rounded-2xl border-4 border-rose-600 bg-gradient-to-b from-rose-950 to-slate-950 p-5 text-center shadow-[0_0_40px_rgba(225,29,72,0.6)] text-white">
        <span className="text-4xl animate-bounce inline-block">⛓️</span>
        <h3 className="mt-2 font-condensed text-2xl font-black uppercase tracking-wider text-rose-400">
          {isSuper ? (isEn ? 'SUPER JAIL ALERT!' : 'ALERTE SUPER PRISON !') : (isEn ? 'SENT TO JAIL!' : 'ENVOI EN PRISON !')}
        </h3>

        <p className="mt-2 text-sm font-semibold text-rose-100">
          {event.targetName} {isEn ? 'was locked behind bars' : 'a été jeté derrière les barreaux'}
          {event.senderName ? (isEn ? ` by ${event.senderName}!` : ` par ${event.senderName} !`) : '!'}
        </p>

        {isSuper && (
          <p className="mt-2 text-xs text-rose-200 bg-rose-900/50 p-2 rounded border border-rose-700/50">
            ⚡ {isEn ? 'Draws 1 Super Corruption card per turn in Super Jail!' : 'Piochera 1 carte Super Corruption par tour passé en Super Prison !'}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-rose-600 hover:bg-rose-700 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white transition-colors"
        >
          {isEn ? 'Dismiss' : 'Compris'}
        </button>
      </div>
    </div>
  );
}

/**
 * Superposé au centre de l'écran pour TOUS les joueurs :
 * Diffuse en direct les cartes jouées, les spins de roulette, les dés spéciaux et les achats.
 */
export default function BroadcastOverlay({ state }) {
  const lastEvent = state?.lastEvent;
  const [currentEvent, setCurrentEvent] = useState(null);
  const [dismissedId, setDismissedId] = useState(null);
  const isEn = state?.locale === 'en';

  useEffect(() => {
    if (lastEvent && lastEvent.id && lastEvent.id !== dismissedId) {
      setCurrentEvent(lastEvent);
      const autoDismissDuration = lastEvent.type === 'spinner_spun' ? 6500 : 4500;
      const timer = setTimeout(() => {
        setCurrentEvent(null);
        setDismissedId(lastEvent.id);
      }, autoDismissDuration);
      return () => clearTimeout(timer);
    }
  }, [lastEvent?.id, dismissedId]);

  if (!currentEvent) return null;

  const handleDismiss = () => {
    setDismissedId(currentEvent.id);
    setCurrentEvent(null);
  };

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={handleDismiss}
    >
      <div
        className="relative z-50 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {currentEvent.type === 'spinner_spun' && (
          <SpinnerBroadcastModal event={currentEvent} isEn={isEn} onClose={handleDismiss} />
        )}

        {currentEvent.type === 'card_played' && (
          <CardPlayedBroadcastModal event={currentEvent} isEn={isEn} onClose={handleDismiss} />
        )}

        {(currentEvent.type === 'buy_die_rolled' ||
          currentEvent.type === 'escape_die_rolled' ||
          currentEvent.type === 'heist_die_rolled') && (
          <SpecialDieBroadcastModal event={currentEvent} isEn={isEn} onClose={handleDismiss} />
        )}

        {(currentEvent.type === 'property_bought' ||
          currentEvent.type === 'sale_card_bought') && (
          <PurchaseBroadcastModal event={currentEvent} state={state} isEn={isEn} onClose={handleDismiss} />
        )}

        {currentEvent.type === 'sent_to_jail' && (
          <JailBroadcastModal event={currentEvent} isEn={isEn} onClose={handleDismiss} />
        )}
      </div>
    </div>
  );
}
