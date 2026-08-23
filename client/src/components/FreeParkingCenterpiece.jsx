import { useState } from 'react';
import { money } from '../lib/board.js';
import { sendAction } from '../lib/socket.js';
import { FREE_PARKING_BONUS_CARDS } from '../../../shared/extensions.js';

const SPINNER_SECTORS = [
  { id: 'red-50', color: '#b91c1c', bg: '#dc2626', labelFr: '-50 €', labelEn: '-$50', subFr: 'Payer à la Cagnotte', subEn: 'Pay to Jackpot Pot', icon: '💸' },
  { id: 'green-free-house', color: '#15803d', bg: '#16a34a', labelFr: 'MAISON OFFERTE', labelEn: 'FREE HOUSE', subFr: '1 maison gratuite posée sans groupe', subEn: '1 free house build without full set', icon: '🏠' },
  { id: 'red-100', color: '#b91c1c', bg: '#dc2626', labelFr: '-100 €', labelEn: '-$100', subFr: 'Payer à la Cagnotte', subEn: 'Pay to Jackpot Pot', icon: '💸' },
  { id: 'green-jackpot', color: '#15803d', bg: '#16a34a', labelFr: 'JACKPOT !', labelEn: 'JACKPOT!', subFr: 'Remporter toute la cagnotte en liquide', subEn: 'Collect entire Jackpot cash pot', icon: '💰' },
  { id: 'red-150', color: '#b91c1c', bg: '#dc2626', labelFr: '-150 €', labelEn: '-$150', subFr: 'Payer à la Cagnotte', subEn: 'Pay to Jackpot Pot', icon: '💸' },
  { id: 'green-dealmobile', color: '#15803d', bg: '#16a34a', labelFr: 'DEAL MOBILE', labelEn: 'DEAL MOBILE', subFr: 'Voiture dorée (terrains gratuits & exonération loyers)', subEn: 'Golden Car (free lands & zero rent)', icon: '🚗' },
  { id: 'red-200', color: '#b91c1c', bg: '#dc2626', labelFr: '-200 €', labelEn: '-$200', subFr: 'Payer à la Cagnotte', subEn: 'Pay to Jackpot Pot', icon: '💸' },
  { id: 'green-property', color: '#15803d', bg: '#16a34a', labelFr: 'TITRE AU CHOIX', labelEn: 'BUY ANY 1', subFr: 'Acheter 1 propriété libre sur le plateau', subEn: 'Buy 1 unowned property on board', icon: '🏷️' },
];

export function FreeParkingInspectionModal({ state, me, onClose, onSpin }) {
  const isEn = state.locale === 'en';
  const bonusDeckCount = typeof state.decks?.free_parking_bonus === 'number'
    ? state.decks.free_parking_bonus
    : (state.decks?.free_parking_bonus?.length ?? 32);

  const canSpin = state.pending?.kind === 'spin_spinner' && me && state.pending.playerIds?.includes(me.id);

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border-2 border-amber-500 bg-stone-900 text-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-amber-500/30 bg-gradient-to-r from-amber-950 via-stone-900 to-amber-950 p-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🎡</span>
            <div>
              <h3 className="font-condensed text-lg font-bold uppercase tracking-wider text-amber-300">
                {isEn ? 'Free Parking Jackpot Wheel & Cards' : 'Roulette & Cartes du Parc Gratuit Jackpot'}
              </h3>
              <p className="text-xs text-amber-200/70">
                {isEn ? 'Official Hasbro Expansion G0718' : 'Extension officielle Hasbro G0718'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-lg font-bold">
            ✕
          </button>
        </div>

        {/* Contenu avec onglets / défilement */}
        <div className="scroll-thin flex-1 overflow-y-auto p-4 space-y-5">
          {/* Cagnotte Jackpot actuelle */}
          <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20 p-3 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="text-3xl">💰</span>
              <div>
                <p className="font-condensed text-xs font-bold uppercase tracking-widest text-amber-400">
                  {isEn ? 'Current Jackpot Pot' : 'Cagnotte Jackpot Actuelle'}
                </p>
                <p className="font-extrabold text-2xl text-[var(--color-money)]">
                  {money(state, state.freeParkingPot ?? 0)}
                </p>
              </div>
            </div>
            {canSpin && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSpin?.();
                }}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 font-condensed text-xs font-extrabold uppercase tracking-wider text-stone-950 shadow-lg animate-pulse"
              >
                🎲 {isEn ? 'SPIN THE WHEEL NOW!' : 'LANCER LA ROULETTE MAINTENANT !'}
              </button>
            )}
          </div>

          {/* Les 8 secteurs de la Roulette */}
          <div className="space-y-2">
            <h4 className="font-condensed text-xs font-bold uppercase tracking-wider text-amber-300">
              🎡 {isEn ? 'The 8 Sectors of the Wheel' : 'Les 8 Secteurs de la Roulette'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SPINNER_SECTORS.map((sec) => (
                <div
                  key={sec.id}
                  className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-stone-800/80 p-2.5 text-xs shadow-sm"
                >
                  <span className="text-xl shrink-0">{sec.icon}</span>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: sec.bg }}
                      />
                      <p className="font-bold text-white truncate">
                        {isEn ? sec.labelEn : sec.labelFr}
                      </p>
                    </div>
                    <p className="text-[11px] text-stone-400 leading-tight">
                      {isEn ? sec.subEn : sec.subFr}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Les Cartes Bonus attachées à la roulette */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-condensed text-xs font-bold uppercase tracking-wider text-amber-300">
                🃏 {isEn ? 'Bonus Cards Deck' : 'Paquet de Cartes Bonus'} ({bonusDeckCount} {isEn ? 'cards' : 'cartes'})
              </h4>
              <span className="text-[10px] text-stone-400">
                {isEn ? 'Drawn on every Free Parking spin' : 'Piochée à chaque tour de roulette'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
              {FREE_PARKING_BONUS_CARDS.slice(0, 12).map((card) => (
                <div
                  key={card.id}
                  className="flex flex-col justify-between rounded-lg border border-amber-500/20 bg-amber-950/20 p-2.5 text-xs"
                >
                  <div>
                    <span className="font-bold text-amber-200">{card.title}</span>
                    <p className="mt-1 text-[11px] text-stone-300 leading-tight">{card.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pied de modale */}
        <div className="border-t border-white/10 bg-stone-800/90 p-3 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-stone-700 hover:bg-stone-600 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-stone-200 transition-colors"
          >
            {isEn ? 'Close' : 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pièce maîtresse centrale de la Roulette du Parc Gratuit posée au centre du plateau */
export default function FreeParkingCenterpiece({ state, me, onSpin }) {
  const [inspectOpen, setInspectOpen] = useState(false);
  const isEn = state.locale === 'en';
  const canSpin = state.pending?.kind === 'spin_spinner' && me && state.pending.playerIds?.includes(me.id);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canSpin) onSpin?.();
          else setInspectOpen(true);
        }}
        className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-950/80 via-stone-900/90 to-amber-950/80 p-3 shadow-2xl transition-all hover:scale-105 hover:border-amber-400 cursor-pointer backdrop-blur-sm"
        style={{ width: 'clamp(140px, 30cqw, 240px)', height: 'clamp(140px, 30cqw, 240px)' }}
        title={isEn ? 'Click to inspect the Free Parking Wheel & Cards' : 'Cliquez pour inspecter la Roulette & les Cartes du Parc Gratuit'}
      >
        {/* Curseur aiguille dorée */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 drop-shadow">
          <div className="h-0 w-0 border-x-[8px] border-x-transparent border-t-[12px] border-t-amber-400" />
        </div>

        {/* Roue SVG miniature */}
        <div className="relative h-24 w-24 rounded-full border-2 border-amber-400 shadow-md overflow-hidden animate-[spin_40s_linear_infinite] group-hover:animate-[spin_10s_linear_infinite]">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            {SPINNER_SECTORS.map((sec, idx) => {
              const startAngle = (idx * 45 * Math.PI) / 180;
              const endAngle = ((idx + 1) * 45 * Math.PI) / 180;
              const x1 = 100 + 100 * Math.cos(startAngle);
              const y1 = 100 + 100 * Math.sin(startAngle);
              const x2 = 100 + 100 * Math.cos(endAngle);
              const y2 = 100 + 100 * Math.sin(endAngle);
              return (
                <path
                  key={sec.id}
                  d={`M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`}
                  fill={sec.bg}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              );
            })}
            <circle cx="100" cy="100" r="28" fill="#1c1917" stroke="#f59e0b" strokeWidth="3" />
            <text x="100" y="105" fill="#fbbf24" fontSize="18" fontWeight="bold" textAnchor="middle">
              ★
            </text>
          </svg>
        </div>

        {/* Titre & Cagnotte */}
        <div className="mt-2 text-center space-y-0.5">
          <p className="font-condensed text-[11px] font-extrabold uppercase tracking-wider text-amber-300 drop-shadow">
            {isEn ? 'FREE PARKING WHEEL' : 'ROULETTE PARC GRATUIT'}
          </p>
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-100">
            <span>💰</span>
            <span className="tabular font-extrabold text-[var(--color-money)]">
              {money(state, state.freeParkingPot ?? 0)}
            </span>
          </div>
        </div>

        {/* Badge interactif */}
        {canSpin ? (
          <span className="absolute -bottom-2 rounded-full bg-amber-500 px-2.5 py-0.5 font-condensed text-[10px] font-extrabold uppercase tracking-wide text-stone-950 shadow-md animate-bounce">
            🎲 {isEn ? 'SPIN NOW!' : 'LANCER !'}
          </span>
        ) : (
          <span className="mt-1 text-[9px] text-amber-300/80 uppercase font-semibold group-hover:text-amber-200">
            🔍 {isEn ? 'Inspect Wheel & Cards' : 'Inspecter Roulette & Cartes'}
          </span>
        )}
      </button>

      {inspectOpen && (
        <FreeParkingInspectionModal
          state={state}
          me={me}
          onClose={() => setInspectOpen(false)}
          onSpin={onSpin}
        />
      )}
    </>
  );
}
