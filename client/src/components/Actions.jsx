/**
 * Barre d'action contextuelle : elle n'affiche que ce que le serveur attend
 * (`state.pending`). Aucune règle n'est décidée ici — le moteur refuserait de
 * toute façon une action illégale.
 *
 * En mode « même ordinateur », toutes les actions sont jouées au nom de `me`,
 * la joueuse du poste à qui le jeu demande quelque chose.
 */
import { useState, useEffect } from 'react';
import { boardOf, groupsOf, money, buildingLabels, buildingLevel, nextBuildStep, editionFor } from '../lib/board.js';
import { useT } from '../lib/i18n.js';
import { sendAction } from '../lib/socket.js';
import TokenIcon from './TokenIcon.jsx';
import { BillStack } from './Money.jsx';
import CardTargetModal from './CardTargetModal.jsx';
import MiniGameLog from './MiniGameLog.jsx';

function cardNeedsTarget(card) {
  const type = card?.action?.type ?? card?.ability?.type;
  return [
    'free_property',
    'take_two',
    'free_house',
    'shortcut',
    'trade_in',
    'go_green',
    'bank_fraud',
    'creative_zoning',
    'money_laundering',
    'on_the_lam',
    'bait_switch',
    'swindle',
    'insider_trading',
    'snitch',
    'framed',
    'loan_shark',
    'auction_hoax',
    'identity_theft',
    'good_ol_scam',
    'blackmail',
    'greasy_palms',
    'long_con',
    'forgery',
    'teleport',
    'swap_property',
  ].includes(type);
}

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

/**
 * Toutes les cartes de l'édition (extensions comprises), indexées par id.
 * Le client n'a besoin que de leur texte : les effets restent au serveur.
 */
function cardIndexOf(state) {
  const decks = editionFor(state).cards ?? {};
  return Object.fromEntries(
    Object.values(decks).flatMap((list) => (list ?? []).map((card) => [card.id, card])),
  );
}

/**
 * Le coffre des ventes : les cartes retournées au centre, et celles qu'on
 * détient. Ne s'affiche que si la partie en a un — le serveur l'annonce en
 * posant `state.saleVault`, le client ne connaît aucune extension par son nom.
 */
function SaleVault({ state, me, actor, onPlayCard }) {
  const t = useT(state);
  if (!state.saleVault) return null;
  const cards = cardIndexOf(state);
  const held = me?.saleCards ?? [];
  const drawnTurns = me?.saleCardsDrawnTurn ?? {};

  return (
    <div className="space-y-3 rounded-lg border-2 border-emerald-600/40 bg-gradient-to-b from-emerald-50/80 to-green-50/50 p-3 shadow-md">
      {/* Présentoir du Coffre-Fort (3 cartes visibles) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-emerald-950">
            <span>🗄️</span>
            <span>{t('saleVault')}</span>
          </div>
          <span className="text-[10px] text-emerald-800 font-semibold uppercase">3 cartes en vente</span>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-3">
          {(state.saleVault.visible ?? []).map((cardId) => {
            const card = cards[cardId];
            const price = card?.price ?? 150;
            const tagLabel = card?.cardType === 'single_use' ? t('singleUse') : card?.cardType === 'ability' ? t('ability') : t('instantWin');
            const borderCol = card?.cardType === 'single_use' ? 'border-stone-300 bg-stone-50/90' : card?.cardType === 'ability' ? 'border-amber-300 bg-amber-50/90' : 'border-emerald-400 bg-emerald-50/90';
            const badgeBg = card?.cardType === 'single_use' ? 'bg-stone-200 text-stone-800' : card?.cardType === 'ability' ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900';

            return (
              <div
                key={cardId}
                className={`flex flex-col justify-between rounded-md border p-2 text-xs shadow-sm ${borderCol}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-ink truncate text-[11px]">{card?.title ?? cardId}</span>
                    <span className="font-extrabold text-emerald-800 shrink-0 text-[10px]">{money(state, price)}</span>
                  </div>
                  <span className={`inline-block text-[9px] font-condensed font-bold uppercase px-1 py-0.2 rounded ${badgeBg}`}>
                    {tagLabel}
                  </span>
                  <p className="text-[10px] text-ink-soft leading-tight line-clamp-3">{card?.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main de cartes Vente détenues par la joueuse (Max 3) */}
      {held.length > 0 && (
        <div className="space-y-1.5 border-t border-emerald-200/80 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-emerald-950">
              <span>🃏</span>
              <span>{t('saleCards')} ({held.length}/3)</span>
            </div>
          </div>

          <div className="grid gap-1.5">
            {held.map((cardId) => {
              const card = cards[cardId];
              const drawnThisTurn = drawnTurns[cardId] === state.turnCount;
              const isSingleUse = card?.cardType === 'single_use' || card?.action;
              const isTurn = state.pending?.playerIds?.includes(me?.id) && state.pending?.kind === 'end_turn';
              const canPlay = isTurn && isSingleUse && !drawnThisTurn;

              return (
                <div
                  key={cardId}
                  className="flex items-center gap-2.5 rounded-md border border-emerald-300 bg-white p-2 text-xs shadow-sm"
                >
                  <span className="text-base">{card?.cardType === 'instant_win' ? '🏆' : card?.cardType === 'ability' ? '⭐' : '⚡'}</span>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-emerald-950">{card?.title ?? cardId}</p>
                      <span className="text-[9px] font-condensed font-bold uppercase text-ink-soft">
                        {card?.cardType === 'single_use' ? t('singleUse') : card?.cardType === 'ability' ? t('ability') : t('instantWin')}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-soft leading-tight">{card?.text}</p>
                    {drawnThisTurn && isSingleUse && (
                      <p className="text-[10px] text-amber-700 italic">{t('cardWaitNextTurn')}</p>
                    )}
                  </div>
                  {canPlay && (
                    <Button
                      tone="primary"
                      className="!px-2.5 !py-1 !text-xs font-bold !bg-emerald-600 hover:!bg-emerald-700 !text-white shrink-0"
                      onClick={() => onPlayCard ? onPlayCard(card, 'PLAY_SALE_CARD', cardId) : sendAction({ type: 'PLAY_SALE_CARD', cardId }, actor)}
                    >
                      {t('playCard')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const SPINNER_SECTORS = [
  { id: 'red-50', color: '#b91c1c', bg: '#dc2626', labelFr: '-50 €', labelEn: '-$50', subFr: 'au Jackpot', subEn: 'to Jackpot' },
  { id: 'green-dealmobile', color: '#15803d', bg: '#16a34a', labelFr: 'DEAL MOBILE', labelEn: 'DEAL MOBILE', subFr: 'Voiture dorée', subEn: 'Golden Car' },
  { id: 'red-100', color: '#b91c1c', bg: '#dc2626', labelFr: '-100 €', labelEn: '-$100', subFr: 'au Jackpot', subEn: 'to Jackpot' },
  { id: 'green-jackpot', color: '#15803d', bg: '#16a34a', labelFr: 'JACKPOT !', labelEn: 'JACKPOT!', subFr: 'Tout ramasser', subEn: 'Collect All' },
  { id: 'red-150', color: '#b91c1c', bg: '#dc2626', labelFr: '-150 €', labelEn: '-$150', subFr: 'au Jackpot', subEn: 'to Jackpot' },
  { id: 'green-house', color: '#15803d', bg: '#16a34a', labelFr: 'MAISON', labelEn: 'FREE HOUSE', subFr: 'Gratuite', subEn: 'Free Build' },
  { id: 'red-200', color: '#b91c1c', bg: '#dc2626', labelFr: '-200 €', labelEn: '-$200', subFr: 'au Jackpot', subEn: 'to Jackpot' },
  { id: 'green-property', color: '#15803d', bg: '#16a34a', labelFr: 'ACHAT LIBRE', labelEn: 'BUY ANY 1', subFr: '1 Propriété', subEn: '1 Property' },
];

function FreeParkingSpinnerComponent({ state, actor }) {
  const t = useT(state);
  const isEn = state.locale === 'en';
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const lastSpin = state.freeParkingSpinner;
  const targetIndex = lastSpin?.sectorIndex ?? 0;

  // Quand un résultat arrive ou qu'on clique
  useEffect(() => {
    if (lastSpin?.timestamp && !spinning) {
      // Rotation exacte pour aligner le secteur gagnant sous l'aiguille du haut (270°)
      const exactAngle = 360 * 5 + (247.5 - targetIndex * 45);
      setRotation(exactAngle);
      setShowResult(true);
    }
  }, [lastSpin?.timestamp, targetIndex]);

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    setShowResult(false);

    // Déclenchement visuel d'une rotation rapide avec plusieurs tours complets
    const extraRounds = 5 + Math.floor(Math.random() * 3);
    const estimatedAngle = rotation + extraRounds * 360 + Math.floor(Math.random() * 360);
    setRotation(estimatedAngle);

    sendAction({ type: 'SPIN_SPINNER' }, actor);

    setTimeout(() => {
      setSpinning(false);
      setShowResult(true);
    }, 2900);
  };

  const wonSector = lastSpin?.sector ?? (targetIndex != null ? SPINNER_SECTORS[targetIndex] : null);
  const isGreen = wonSector?.bg === '#16a34a';

  return (
    <div className="flex flex-col items-center gap-3.5 rounded-xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-50 via-amber-100/70 to-yellow-50/90 p-4 shadow-xl backdrop-blur-sm casino-glow">
      <div className="flex items-center gap-2">
        <span className="text-base animate-bounce">🎰</span>
        <span className="font-condensed text-sm font-bold uppercase tracking-widest text-amber-950">
          {t('freeParkingSpinnerTitle')}
        </span>
        <span className="text-base animate-bounce">🎰</span>
      </div>

      {/* Roulette Casino SVG avec clous et ampoules lumineuses */}
      <div className="relative h-60 w-60 drop-shadow-2xl">
        {/* Aiguille supérieure avec clic/battement */}
        <div className="absolute left-1/2 -top-2.5 z-30 -translate-x-1/2">
          <div className={spinning ? 'needle-ticking' : ''}>
            <svg width="26" height="32" viewBox="0 0 24 28">
              <defs>
                <linearGradient id="needle-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="50%" stopColor="#ffd700" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
              </defs>
              <path
                d="M12 27 L3 5 Q12 1 21 5 Z"
                fill="url(#needle-grad)"
                stroke="#78350f"
                strokeWidth="1.8"
                filter="drop-shadow(0 3px 5px rgba(0,0,0,0.6))"
              />
              <circle cx="12" cy="7" r="3.2" fill="#ffffff" stroke="#78350f" strokeWidth="1" />
            </svg>
          </div>
        </div>

        {/* Roue tournante */}
        <svg
          viewBox="0 0 200 200"
          className="h-full w-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning || lastSpin ? 'transform 2.8s cubic-bezier(0.12, 0.92, 0.18, 1)' : 'none',
          }}
        >
          <defs>
            <radialGradient id="gold-rim" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="#d97706" />
              <stop offset="90%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#78350f" />
            </radialGradient>
            <radialGradient id="hub-gold" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#92400e" />
            </radialGradient>
          </defs>

          {/* Bordure extérieure dorée texturée */}
          <circle cx="100" cy="100" r="99" fill="url(#gold-rim)" stroke="#451a03" strokeWidth="2.5" />
          <circle cx="100" cy="100" r="93.5" fill="#fef3c7" stroke="#b45309" strokeWidth="1.2" />

          {/* 8 secteurs de 45 degrés */}
          {SPINNER_SECTORS.map((sector, i) => {
            const startAngle = (i * 45 * Math.PI) / 180;
            const endAngle = ((i + 1) * 45 * Math.PI) / 180;
            const midAngle = ((i + 0.5) * 45 * Math.PI) / 180;

            const x1 = 100 + 91 * Math.cos(startAngle);
            const y1 = 100 + 91 * Math.sin(startAngle);
            const x2 = 100 + 91 * Math.cos(endAngle);
            const y2 = 100 + 91 * Math.sin(endAngle);

            const tx = 100 + 64 * Math.cos(midAngle);
            const ty = 100 + 64 * Math.sin(midAngle);
            const textRot = i * 45 + 22.5 + 90;

            return (
              <g key={sector.id}>
                <path
                  d={`M100 100 L${x1} ${y1} A91 91 0 0 1 ${x2} ${y2} Z`}
                  fill={sector.bg}
                  stroke="#ffffff"
                  strokeWidth="1.4"
                />
                <g transform={`translate(${tx} ${ty}) rotate(${textRot})`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    style={{
                      font: "bold 8.2px 'Oswald', system-ui, sans-serif",
                      letterSpacing: '0.4px',
                      textShadow: '0 1px 2px rgba(0,0,0,0.85)',
                    }}
                  >
                    {isEn ? sector.labelEn : sector.labelFr}
                  </text>
                  <text
                    y="7.8"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#fef08a"
                    style={{
                      font: "6px system-ui, sans-serif",
                      fontWeight: 600,
                      textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                    }}
                  >
                    {isEn ? sector.subEn : sector.subFr}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Ampoules de casino clignotantes sur le pourtour */}
          {Array.from({ length: 16 }).map((_, idx) => {
            const a = (idx * 22.5 * Math.PI) / 180;
            const cx = 100 + 95.5 * Math.cos(a);
            const cy = 100 + 95.5 * Math.sin(a);
            return (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r="2.2"
                className={idx % 2 === 0 ? 'bulb-even' : 'bulb-odd'}
                stroke="#78350f"
                strokeWidth="0.6"
              />
            );
          })}

          {/* Moyeu central doré 3D */}
          <circle cx="100" cy="100" r="23" fill="#78350f" />
          <circle cx="100" cy="100" r="21" fill="url(#hub-gold)" stroke="#fff" strokeWidth="1" />
          <circle cx="100" cy="100" r="13" fill="#b45309" opacity="0.6" />
          <circle cx="100" cy="100" r="10" fill="#fbbf24" />
          <text
            x="100"
            y="101"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#78350f"
            style={{ font: "bold 10px system-ui, sans-serif" }}
          >
            ★
          </text>
        </svg>
      </div>

      {/* Bannière de révélation du résultat avec effet pop */}
      {showResult && wonSector && !spinning && (
        <div
          className={`winner-pop w-full rounded-lg border-2 p-3 text-center shadow-md ${
            isGreen
              ? 'border-emerald-500/80 bg-gradient-to-r from-emerald-600 to-green-500 text-white'
              : 'border-rose-500/80 bg-gradient-to-r from-rose-700 to-red-600 text-white'
          }`}
        >
          <p className="font-condensed text-xs uppercase tracking-widest text-amber-200 font-bold">
            {isGreen ? '✨ Secteur Vert Gagnant !' : '💥 Secteur Rouge !'}
          </p>
          <p className="text-base font-extrabold tracking-wide drop-shadow-sm">
            {isEn ? wonSector.labelEn : wonSector.labelFr}
          </p>
          <p className="text-xs text-amber-100 opacity-95">
            {isEn ? wonSector.subEn : wonSector.subFr} • 🎴 +1 Carte Bonus piochée !
          </p>
        </div>
      )}

      {/* Bouton de lancement stylé et étincelant */}
      <button
        type="button"
        disabled={spinning}
        onClick={handleSpin}
        className="w-full relative overflow-hidden rounded-lg bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 px-4 py-3 font-condensed text-base font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          <span>🎰</span>
          <span>{spinning ? (isEn ? 'La roulette tourne…' : 'La roulette tourne…') : t('spinSpinner')}</span>
          <span>🎰</span>
        </span>
      </button>
    </div>
  );
}

function ChooseRentOrChipModal({ state, payload, actor }) {
  const t = useT(state);
  const tenant = state.players.find((p) => p.id === payload.tenantId);
  const space = boardOf(state)[payload.spaceId];
  const rent = payload.rent ?? 0;
  const isDealMobile = payload.dealMobile;

  return (
    <div className="space-y-3 rounded-lg border-2 border-amber-500/50 bg-gradient-to-b from-amber-50 to-white p-4 shadow-lg">
      <p className="font-condensed text-xs uppercase tracking-wider text-amber-900 font-bold">
        {t('chooseRentOrChip')}
      </p>
      <p className="text-sm leading-snug">
        <strong>{tenant?.name ?? '…'}</strong> s'arrête sur <strong>{space?.name ?? '…'}</strong>.
      </p>
      {isDealMobile ? (
        <p className="rounded bg-amber-100 p-2 text-xs font-semibold text-amber-900">
          🚗 {tenant?.name} conduit le Deal Mobile : aucun loyer n'est dû ! Vous pouvez prendre 1 jeton Spin à la banque.
        </p>
      ) : (
        <p className="text-xs text-ink-soft">
          Vous pouvez encaisser le loyer de <strong>{money(state, rent)}</strong> ou préférer prendre 1 jeton Spin à la banque.
        </p>
      )}

      <div className="flex flex-col gap-2 pt-1">
        {!isDealMobile && rent > 0 && (
          <Button
            onClick={() => sendAction({ type: 'CHOOSE_RENT_OR_CHIP', choice: 'rent' }, actor)}
            className="w-full"
          >
            {t('takeRent', money(state, rent))}
          </Button>
        )}
        <Button
          tone="ghost"
          onClick={() => sendAction({ type: 'CHOOSE_RENT_OR_CHIP', choice: 'chip' }, actor)}
          className="w-full !border-amber-500/40 !bg-amber-100/70 hover:!bg-amber-200"
        >
          🪙 {t('takeChip')}
        </Button>
      </div>
    </div>
  );
}

function FreeParkingBonusSection({ state, me, actor, isTurn, onPlayCard }) {
  const t = useT(state);
  const cards = cardIndexOf(state);
  const spinChips = me?.spinChips ?? 0;
  const bonusCards = me?.bonusCards ?? [];

  if (spinChips === 0 && bonusCards.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-amber-400/40 bg-gradient-to-br from-amber-50/80 to-yellow-50/60 p-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-condensed text-xs font-bold uppercase tracking-wider text-amber-950">
          🎁 {t('bonusCards')} & {t('spinChips')}
        </span>
        {spinChips > 0 && (
          <span className="rounded-full bg-amber-400/30 px-2 py-0.5 font-condensed text-xs font-bold text-amber-950">
            🪙 {spinChips}
          </span>
        )}
      </div>

      {isTurn && spinChips > 0 && (
        <Button
          tone="ghost"
          className="w-full !border-amber-500/50 !bg-amber-200/80 !text-amber-950 font-bold hover:!bg-amber-300"
          onClick={() => sendAction({ type: 'USE_SPIN_CHIP' }, actor)}
        >
          🎰 {t('useSpinChip')}
        </Button>
      )}

      {bonusCards.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {bonusCards.map((cardId) => {
            const card = cards[cardId];
            return (
              <div
                key={cardId}
                className="flex items-start justify-between gap-2 rounded border border-amber-200 bg-white/90 p-2 text-xs shadow-xs"
              >
                <div className="flex-1 space-y-0.5">
                  <p className="font-bold text-amber-950">{card?.title ?? card?.text ?? cardId}</p>
                  {card?.title && <p className="text-[11px] text-ink-soft leading-tight">{card.text}</p>}
                </div>
                {isTurn && (
                  <Button
                    tone="ghost"
                    className="!px-2.5 !py-1 !text-xs font-bold !bg-amber-100 hover:!bg-amber-200 shrink-0"
                    onClick={() => onPlayCard ? onPlayCard(card, 'PLAY_BONUS_CARD', cardId) : sendAction({ type: 'PLAY_BONUS_CARD', cardId }, actor)}
                  >
                    {t('playCard')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EscapeDieComponent({ state, actor }) {
  const t = useT(state);
  const [rolling, setRolling] = useState(false);
  const isEn = state.locale === 'en';

  const lastRoll = state.escapeDie;
  const face = lastRoll?.face;

  const handleRoll = () => {
    if (rolling) return;
    setRolling(true);
    sendAction({ type: 'ROLL_ESCAPE_DIE' }, actor);
    setTimeout(() => {
      setRolling(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-emerald-600/50 bg-gradient-to-b from-emerald-50 via-emerald-100/60 to-green-50 p-4 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-xl">🏃</span>
        <span className="font-condensed text-sm font-bold uppercase tracking-wider text-emerald-950">
          {t('escapeDie')}
        </span>
        <span className="text-xl">🚓</span>
      </div>

      <p className="text-center text-xs text-emerald-900/80">
        {t('escapeDieHint')}
      </p>

      <div className={`relative flex h-24 w-24 items-center justify-center rounded-2xl border-2 shadow-inner transition-transform duration-500 ${
        face?.isPolice ? 'border-blue-700 bg-blue-600 text-white' : 'border-emerald-600 bg-emerald-500 text-white'
      } ${rolling ? 'animate-spin' : ''}`}>
        {face ? (
          <div className="flex flex-col items-center justify-center text-center p-1">
            <span className="text-2xl">{face.isPolice ? '👮‍♂️' : '🎴'}</span>
            <span className="font-condensed text-sm font-black uppercase tracking-wider mt-0.5 leading-tight">
              {isEn ? face.labelEn : face.labelFr}
            </span>
          </div>
        ) : (
          <span className="text-3xl">🎲</span>
        )}
      </div>

      <Button
        tone="primary"
        className="!w-full !py-2.5 font-bold uppercase tracking-wider !bg-emerald-600 hover:!bg-emerald-700 !text-white shadow-md"
        disabled={rolling}
        onClick={handleRoll}
      >
        {t('rollEscapeDie')}
      </Button>
    </div>
  );
}

function HeistDieComponent({ state, actor }) {
  const t = useT(state);
  const [rolling, setRolling] = useState(false);
  const isEn = state.locale === 'en';

  const lastRoll = state.heistDie;
  const face = lastRoll?.face;

  const handleRoll = () => {
    if (rolling) return;
    setRolling(true);
    sendAction({ type: 'ROLL_HEIST_DIE' }, actor);
    setTimeout(() => {
      setRolling(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-indigo-600/50 bg-gradient-to-b from-indigo-50 via-indigo-100/60 to-purple-50 p-4 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-xl">💰</span>
        <span className="font-condensed text-sm font-bold uppercase tracking-wider text-indigo-950">
          {t('heistDie')}
        </span>
        <span className="text-xl">🚨</span>
      </div>

      <p className="text-center text-xs text-indigo-900/80">
        {t('heistDieHint')}
      </p>

      <div className={`relative flex h-24 w-24 items-center justify-center rounded-2xl border-2 shadow-inner transition-transform duration-500 ${
        face?.isPolice ? 'border-red-700 bg-red-600 text-white' : 'border-amber-600 bg-amber-500 text-white'
      } ${rolling ? 'animate-spin' : ''}`}>
        {face ? (
          <div className="flex flex-col items-center justify-center text-center p-1">
            <span className="text-2xl">{face.isPolice ? '👮‍♂️' : '💵'}</span>
            <span className="font-condensed text-sm font-black uppercase tracking-wider mt-0.5 leading-tight">
              {isEn ? face.labelEn : face.labelFr}
            </span>
          </div>
        ) : (
          <span className="text-3xl">🎲</span>
        )}
      </div>

      <Button
        tone="primary"
        className="!w-full !py-2.5 font-bold uppercase tracking-wider !bg-indigo-600 hover:!bg-indigo-700 !text-white shadow-md"
        disabled={rolling}
        onClick={handleRoll}
      >
        {t('rollHeistDie')}
      </Button>
    </div>
  );
}

function BuyDieComponent({ state, actor }) {
  const t = useT(state);
  const [rolling, setRolling] = useState(false);
  const isEn = state.locale === 'en';

  const lastRoll = state.buyDie;
  const face = lastRoll?.face;

  const handleRoll = () => {
    if (rolling) return;
    setRolling(true);
    sendAction({ type: 'ROLL_BUY_DIE' }, actor);
    setTimeout(() => {
      setRolling(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-emerald-600/50 bg-gradient-to-b from-emerald-50 via-green-100/60 to-emerald-50 p-4 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-xl">🗄️</span>
        <span className="font-condensed text-sm font-bold uppercase tracking-wider text-emerald-950">
          {t('buyDie')}
        </span>
        <span className="text-xl">🎲</span>
      </div>

      <p className="text-center text-xs text-emerald-900/80">
        {t('buyDieHint')}
      </p>

      <div className={`relative flex h-24 w-24 items-center justify-center rounded-2xl border-2 shadow-inner transition-transform duration-500 ${
        face?.type === 'buy_card' ? 'border-emerald-700 bg-emerald-600 text-white' :
        face?.type === 'force_discard' ? 'border-red-700 bg-red-600 text-white' :
        face?.type === 'refresh_vault' ? 'border-amber-600 bg-amber-500 text-white' :
        'border-emerald-600 bg-emerald-500 text-white'
      } ${rolling ? 'animate-spin' : ''}`}>
        {face ? (
          <div className="flex flex-col items-center justify-center text-center p-1">
            <span className="text-2xl">
              {face.type === 'buy_card' ? '🟢 ⬆️' : face.type === 'force_discard' ? '🔴 ❌' : '🟡 🔄'}
            </span>
            <span className="font-condensed text-sm font-black uppercase tracking-wider mt-0.5 leading-tight">
              {isEn ? face.labelEn : face.labelFr}
            </span>
          </div>
        ) : (
          <span className="text-3xl">🎲</span>
        )}
      </div>

      <Button
        tone="primary"
        className="!w-full !py-2.5 font-bold uppercase tracking-wider !bg-emerald-600 hover:!bg-emerald-700 !text-white shadow-md"
        disabled={rolling}
        onClick={handleRoll}
      >
        {t('rollBuyDie')}
      </Button>
    </div>
  );
}

function BuySaleCardModal({ state, me, payload, actor }) {
  const t = useT(state);
  const cards = cardIndexOf(state);
  const [discardCardId, setDiscardCardId] = useState(me?.saleCards?.[0] ?? null);
  const mustDiscard = payload.mustDiscardFirst;
  const ownsBank = me?.saleCards?.some((cId) => cards[cId]?.ability?.type === 'the_bank');

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-emerald-600/50 bg-emerald-50/95 p-3.5 shadow-md">
      <div className="flex items-center gap-2">
        <span className="text-lg">🗄️</span>
        <p className="font-condensed text-sm font-bold uppercase text-emerald-950">
          {t('saleVault')} — {t('buySaleCard')}
        </p>
      </div>

      {mustDiscard && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs">
          <p className="font-bold text-amber-900 mb-1">{t('chooseDiscardPrompt')}</p>
          <div className="flex flex-wrap gap-1.5">
            {(me?.saleCards ?? []).map((cId) => {
              const c = cards[cId];
              const selected = discardCardId === cId;
              return (
                <button
                  key={cId}
                  type="button"
                  onClick={() => setDiscardCardId(cId)}
                  className={`px-2 py-1 rounded text-xs border ${
                    selected ? 'border-red-600 bg-red-100 font-bold text-red-900' : 'border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  {c?.title ?? cId}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-2">
        {(payload.visibleCards ?? []).map((cardId) => {
          const card = cards[cardId];
          const price = card?.price ?? 150;
          const canAfford = ownsBank || (me?.cash ?? 0) >= price;
          const tagLabel = card?.cardType === 'single_use' ? t('singleUse') : card?.cardType === 'ability' ? t('ability') : t('instantWin');
          const tagBg = card?.cardType === 'single_use' ? 'bg-stone-200 text-stone-800' : card?.cardType === 'ability' ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900';

          return (
            <div
              key={cardId}
              className="flex items-start justify-between gap-2.5 rounded-md border border-emerald-300 bg-white p-2.5 text-xs shadow-sm"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-950 text-sm">{card?.title ?? cardId}</span>
                  <span className={`text-[10px] font-condensed font-bold uppercase px-1.5 py-0.5 rounded ${tagBg}`}>
                    {tagLabel}
                  </span>
                  <span className="font-bold text-ink-soft ml-auto">{money(state, price)}</span>
                </div>
                <p className="text-[11px] text-ink-soft leading-tight">{card?.text}</p>
              </div>
              <Button
                tone="primary"
                className="!px-3 !py-1.5 !text-xs font-bold !bg-emerald-600 hover:!bg-emerald-700 !text-white shrink-0 self-center"
                disabled={!canAfford || (mustDiscard && !discardCardId)}
                onClick={() => sendAction({ type: 'BUY_SALE_CARD', cardId, discardCardId: mustDiscard ? discardCardId : null }, actor)}
              >
                {t('buySaleCard')}
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        tone="ghost"
        className="!w-full !py-1.5 text-xs font-bold !border-emerald-300 hover:!bg-emerald-100 text-emerald-900"
        onClick={() => sendAction({ type: 'END_TURN' }, actor)}
      >
        {t('skipAction')}
      </Button>
    </div>
  );
}

function ForceDiscardModal({ state, payload, actor }) {
  const t = useT(state);
  const cards = cardIndexOf(state);

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-red-600/50 bg-red-50/95 p-3.5 shadow-md">
      <div className="flex items-center gap-2">
        <span className="text-lg">❌</span>
        <p className="font-condensed text-sm font-bold uppercase text-red-950">
          {t('forceDiscard')}
        </p>
      </div>

      <p className="text-xs text-red-900">
        {t('chooseVictimPrompt')}
      </p>

      <div className="grid gap-2">
        {(payload.victimIds ?? []).map((vId) => {
          const victim = state.players.find((p) => p.id === vId);
          if (!victim) return null;

          return (
            <div key={vId} className="rounded-md border border-red-200 bg-white p-2 text-xs space-y-1.5">
              <p className="font-bold text-red-950 flex items-center gap-1.5">
                <TokenIcon token={victim.token} color={victim.color} className="h-4 w-4" />
                <span>{victim.name}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(victim.saleCards ?? []).map((cardId) => {
                  const card = cards[cardId];
                  return (
                    <Button
                      key={cardId}
                      tone="danger"
                      className="!px-2.5 !py-1 !text-xs font-bold"
                      onClick={() => sendAction({ type: 'FORCE_DISCARD_SALE_CARD', targetPlayerId: vId, targetCardId: cardId }, actor)}
                    >
                      Défausser « {card?.title ?? cardId} »
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        tone="ghost"
        className="!w-full !py-1.5 text-xs font-bold !border-red-300 hover:!bg-red-100 text-red-900"
        onClick={() => sendAction({ type: 'END_TURN' }, actor)}
      >
        {t('skipAction')}
      </Button>
    </div>
  );
}

function RefreshVaultModal({ state, payload, actor }) {
  const t = useT(state);
  const cards = cardIndexOf(state);

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-amber-600/50 bg-amber-50/95 p-3.5 shadow-md">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔄</span>
        <p className="font-condensed text-sm font-bold uppercase text-amber-950">
          {t('refreshVault')}
        </p>
      </div>

      <p className="text-xs text-amber-900">
        {t('chooseCardToReplace')}
      </p>

      <div className="grid gap-2">
        {(payload.visibleCards ?? []).map((cardId) => {
          const card = cards[cardId];
          return (
            <div
              key={cardId}
              className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-white p-2.5 text-xs shadow-sm"
            >
              <div className="space-y-0.5 flex-1">
                <p className="font-bold text-amber-950">{card?.title ?? cardId}</p>
                <p className="text-[11px] text-ink-soft">{card?.text}</p>
              </div>
              <Button
                tone="primary"
                className="!px-3 !py-1.5 !text-xs font-bold !bg-amber-600 hover:!bg-amber-700 !text-white shrink-0"
                onClick={() => sendAction({ type: 'REFRESH_SALE_VAULT', cardId }, actor)}
              >
                Remplacer
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        tone="ghost"
        className="!w-full !py-1.5 text-xs font-bold !border-amber-300 hover:!bg-amber-100 text-amber-900"
        onClick={() => sendAction({ type: 'END_TURN' }, actor)}
      >
        {t('skipAction')}
      </Button>
    </div>
  );
}

function JailDecisionModal({ state, payload, actor }) {
  const t = useT(state);
  const bailAmount = money(state, payload.bail);

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border-2 border-stone-600/40 bg-stone-50 p-3.5 shadow-md">
      <div className="flex items-center gap-2">
        <span className="text-lg">⛓️</span>
        <p className="font-condensed text-sm font-bold uppercase text-stone-900">
          {t('jailDecision')} — {t('inJailFor', payload.jailTurns, 3)}
        </p>
      </div>

      <p className="text-xs text-stone-700">
        Vous avez passé {payload.jailTurns} tour(s) en prison et pioché 1 carte Corruption. Que souhaitez-vous faire ?
      </p>

      <div className="flex flex-col gap-2 pt-1">
        <Button
          tone="primary"
          className="!w-full !py-2 font-bold !bg-emerald-600 hover:!bg-emerald-700 !text-white"
          disabled={!payload.canPayBail}
          onClick={() => sendAction({ type: 'PAY_BAIL' }, actor)}
        >
          {t('payNormalJailBail', bailAmount)}
        </Button>

        {payload.canStay && (
          <Button
            tone="ghost"
            className="!w-full !py-2 font-bold !border-stone-400 hover:!bg-stone-200"
            onClick={() => sendAction({ type: 'STAY_IN_JAIL' }, actor)}
          >
            {t('stayInNormalJail')}
          </Button>
        )}
      </div>
    </div>
  );
}

function LeaveSuperJailModal({ state, payload, actor }) {
  const t = useT(state);
  const bailCash = money(state, editionFor(state).mechanics?.superJailBailCash ?? 300);

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border-2 border-blue-700/50 bg-blue-50 p-3.5 shadow-md">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚡</span>
        <p className="font-condensed text-sm font-bold uppercase text-blue-950">
          {t('superJailDecision')} — {t('inSuperJailFor', payload.superJailTurns, 3)}
        </p>
      </div>

      <p className="text-xs text-blue-900">
        Envoyé(e) en Super Prison par <strong>{payload.senderName}</strong>. Tour {payload.superJailTurns}/3.
      </p>

      <div className="flex flex-col gap-2 pt-1">
        {payload.canGiveCards && (
          <Button
            tone="primary"
            className="!w-full !py-2 font-bold !bg-indigo-600 hover:!bg-indigo-700 !text-white"
            onClick={() => sendAction({ type: 'LEAVE_SUPER_JAIL', choice: 'cards' }, actor)}
          >
            {t('giveSuperCards', payload.collectedCardsCount, payload.senderName)}
          </Button>
        )}

        <Button
          tone="primary"
          className="!w-full !py-2 font-bold !bg-blue-600 hover:!bg-blue-700 !text-white"
          disabled={!payload.canPayCash}
          onClick={() => sendAction({ type: 'LEAVE_SUPER_JAIL', choice: 'cash' }, actor)}
        >
          {t('paySuperJailBail', bailCash, payload.senderName)}
        </Button>

        {payload.canStay && (
          <Button
            tone="ghost"
            className="!w-full !py-2 font-bold !border-blue-400 hover:!bg-blue-200"
            onClick={() => sendAction({ type: 'STAY_IN_JAIL' }, actor)}
          >
            {t('stayInSuperJail')}
          </Button>
        )}
      </div>
    </div>
  );
}

function CorruptionSection({ state, me, actor, isTurn, onPlayCard }) {
  const t = useT(state);
  const cards = cardIndexOf(state);
  const corruption = me?.corruptionCards ?? [];
  const superCorruption = me?.superCorruptionCards ?? [];
  const drawnTurns = me?.cardsDrawnTurn ?? {};

  if (!corruption.length && !superCorruption.length) return null;

  return (
    <div className="space-y-3 rounded-lg border-2 border-orange-500/40 bg-gradient-to-b from-orange-50/90 to-amber-50/60 p-3 shadow-md">
      {corruption.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-orange-950">
              <span>⚖️</span>
              <span>{t('corruptionCards')} ({corruption.length})</span>
            </div>
          </div>
          <div className="grid gap-1.5">
            {corruption.map((cardId) => {
              const card = cards[cardId];
              const drawnThisTurn = drawnTurns[cardId] === state.turnCount;
              const canPlay = isTurn && (!drawnThisTurn || card?.reaction);

              return (
                <div
                  key={cardId}
                  className="flex items-center gap-2.5 rounded-md border border-orange-200 bg-white/90 p-2 text-xs shadow-sm"
                >
                  <span className="text-base">⚖️</span>
                  <div className="flex-1 space-y-0.5">
                    <p className="font-bold text-orange-950">{card?.title ?? card?.text ?? cardId}</p>
                    {card?.title && <p className="text-[11px] text-ink-soft leading-tight">{card.text}</p>}
                    {drawnThisTurn && !card?.reaction && (
                      <p className="text-[10px] text-amber-700 italic">{t('cardWaitNextTurn')}</p>
                    )}
                  </div>
                  {canPlay && (
                    <Button
                      tone="ghost"
                      className="!px-2.5 !py-1 !text-xs font-bold !bg-orange-100 hover:!bg-orange-200 shrink-0"
                      onClick={() => onPlayCard ? onPlayCard(card, 'PLAY_CORRUPTION_CARD', cardId) : sendAction({ type: 'PLAY_CORRUPTION_CARD', cardId }, actor)}
                    >
                      {t('playCard')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {superCorruption.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-blue-950">
              <span>⚡</span>
              <span>{t('superCorruptionCards')} ({superCorruption.length})</span>
            </div>
          </div>
          <div className="grid gap-1.5">
            {superCorruption.map((cardId) => {
              const card = cards[cardId];
              const drawnThisTurn = drawnTurns[cardId] === state.turnCount;
              const canPlay = isTurn && (!drawnThisTurn || card?.reaction);

              return (
                <div
                  key={cardId}
                  className="flex items-center gap-2.5 rounded-md border border-blue-300 bg-blue-50/90 p-2 text-xs shadow-sm"
                >
                  <span className="text-base">⚡</span>
                  <div className="flex-1 space-y-0.5">
                    <p className="font-bold text-blue-950">{card?.title ?? card?.text ?? cardId}</p>
                    {card?.title && <p className="text-[11px] text-ink-soft leading-tight">{card.text}</p>}
                    {drawnThisTurn && !card?.reaction && (
                      <p className="text-[10px] text-blue-700 italic">{t('cardWaitNextTurn')}</p>
                    )}
                  </div>
                  {canPlay && (
                    <Button
                      tone="primary"
                      className="!px-2.5 !py-1 !text-xs font-bold !bg-blue-600 hover:!bg-blue-700 !text-white shrink-0"
                      onClick={() => onPlayCard ? onPlayCard(card, 'PLAY_SUPER_CORRUPTION_CARD', cardId) : sendAction({ type: 'PLAY_SUPER_CORRUPTION_CARD', cardId }, actor)}
                    >
                      {t('playCard')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Le titre de propriété, dans l'esprit des cartes du jeu. */
/**
 * Noir ou blanc, selon ce qui se lit le mieux sur cette couleur.
 *
 * Les bandeaux de groupe vont du jaune vif au bleu nuit : une encre fixe est
 * forcément illisible sur l'une des deux. On calcule donc la luminance relative
 * (formule WCAG) et l'on tranche.
 */
export function readableOn(hex) {
  if (!hex?.startsWith('#') || hex.length < 7) return 'var(--color-space-ink)';
  const channel = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.42 ? '#12100c' : '#ffffff';
}

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

  // La fiche s'écrit sur `--color-space`, qui peut être sombre (Spider-Man) là
  // où les panneaux restent clairs. Elle a donc sa propre encre : réutiliser
  // celle des panneaux donnait du texte invisible, mesuré à 1,01:1.
  const onCard = { color: 'var(--color-space-ink)' };
  const onCardSoft = { color: 'var(--color-space-ink-soft)' };

  return (
    <div
      className="overflow-hidden rounded border-2 bg-[var(--color-space)]"
      style={{ borderColor: 'var(--color-space-ink)' }}
    >
      {color && (
        <div
          className="border-b-2 px-2 py-2 text-center"
          style={{ backgroundColor: color, borderColor: 'var(--color-space-ink)' }}
        >
          {/* Le bandeau porte la couleur du groupe : son encre se choisit sur
              cette couleur-là, pas sur le fond de la fiche. */}
          <p
            className="font-condensed text-[13px] uppercase leading-tight"
            style={{ color: readableOn(color) }}
          >
            {space.name}
          </p>
        </div>
      )}
      <div className="p-2.5">
        {!color && (
          <p className="mb-1 text-center font-condensed text-[13px] uppercase" style={onCard}>
            {space.name}
          </p>
        )}
        {rows.length > 0 && (
          <table className="w-full text-[11px]">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td className="py-px" style={onCardSoft}>{label}</td>
                  <td className="tabular py-px text-right font-medium" style={onCard}>
                    {money(state, value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {space.type === 'utility' && (
          <p className="text-[11px]" style={onCardSoft}>
            {t('utilityRent', space.rentMultipliers[0], space.rentMultipliers[1])}
          </p>
        )}
        <div className="mt-2 border-t border-current/20 pt-1.5 text-[11px]" style={onCardSoft}>
          <p className="tabular">
            {t('price')} : <span style={onCard}>{money(state, space.price)}</span>
          </p>
          {space.houseCost > 0 && (
            <>
              <p className="tabular">
                {labels.house} : <span style={onCard}>{money(state, space.houseCost)}</span>
                {editionFor(state).mechanics.hotels && (
                  <>
                    {' · '}
                    {labels.hotel} : <span style={onCard}>{money(state, space.houseCost)}</span>
                    {' + 4 '}
                    {labels.houses.toLowerCase()}
                  </>
                )}
              </p>
              {/* Ce qu'on récupère en revendant : la moitié, comme dans la boîte.
                  L'écrire évite d'avoir à le deviner au moment de se refaire. */}
              <p className="tabular">
                {t('resaleValue')} : <span style={onCard}>{money(state, space.houseCost / 2)}</span>
                <span className="opacity-70"> · {t('halfOfCost')}</span>
              </p>
            </>
          )}
          {editionFor(state).mechanics.mortgage && (
            <p className="tabular">
              {t('mortgageValue')} : <span style={onCard}>{money(state, space.mortgage)}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Roll({ state, payload, actor }) {
  const t = useT(state);
  // Un pouvoir de camp peut annoncer la carte du dessus. Le serveur décide s'il
  // y a quelque chose à montrer ; le client se contente de l'afficher.
  const peek = payload?.peek ? (
    <p className="rounded border border-black/10 bg-black/5 px-2 py-1.5 text-xs italic leading-snug">
      {t('spiderSense')} « {payload.peek} »
    </p>
  ) : null;

  // Un ticket de bus se joue à la place du lancer. Le serveur ne pose la clé
  // que quand c'est réellement possible : le client se contente de l'afficher.
  const tickets = payload?.busTickets ?? [];

  if (!payload?.inJail) {
    return (
      <div className="space-y-2">
        {peek}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => sendAction({ type: 'ROLL_DICE' }, actor)}>{t('rollDice')}</Button>
          {tickets.map((ticket) => (
            <Button
              key={ticket.id}
              tone="ghost"
              onClick={() => sendAction({ type: 'USE_BUS_TICKET', ticketId: ticket.id }, actor)}
            >
              🚌 {t('useBusTicketInstead')}
              {ticket.expires ? ' ⚠' : ''}
            </Button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {peek}
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

/**
 * Choisir une case parmi celles que le serveur propose.
 *
 * Trois situations passent par ici — triple identique, descente d'un ticket de
 * bus, propriété à mettre en vente — et c'est le serveur qui dit laquelle
 * (`reason`) et ce qu'il en fera (`then`). Le client ne décide rien : il liste
 * les cases recevables, avec ce qui les distingue (couleur du groupe, prix,
 * propriétaire), et renvoie celle qu'on désigne.
 */
function ChooseSpace({ state, payload, actor }) {
  const t = useT(state);
  const board = boardOf(state);
  const groups = groupsOf(state);
  const title =
    payload.reason === 'auction' ? t('chooseSpaceAuction')
    : payload.reason === 'bus_ticket' ? t('chooseSpaceBus')
    : t('chooseSpaceTriple');

  return (
    <div className="space-y-2">
      <p className="text-sm">{title}</p>
      {payload.expires && (
        <p className="text-xs text-[var(--color-accent)]">⚠ {t('busTicketExpires')}</p>
      )}
      <div className="scroll-thin grid max-h-64 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
        {payload.spaceIds.map((id) => {
          const space = board[id];
          const prop = state.properties?.[id];
          const owner = prop?.ownerId ? state.players.find((p) => p.id === prop.ownerId) : null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => sendAction({ type: 'CHOOSE_SPACE', spaceId: id }, actor)}
              className="flex items-center gap-1.5 rounded border border-black/15 bg-white px-2 py-1.5 text-left text-[11px] hover:bg-black/5"
            >
              {space.group && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/25"
                  style={{ backgroundColor: groups[space.group]?.color }}
                />
              )}
              <span className="truncate">{space.shortName}</span>
              {space.price != null && (
                <span className="tabular ml-auto shrink-0 text-ink-soft">{money(state, space.price)}</span>
              )}
              {owner && (
                <span
                  className="ml-1 h-2 w-2 shrink-0 rounded-full border border-black/30"
                  style={{ backgroundColor: owner.color }}
                  title={owner.name}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Face Bus du dé rapide : prendre le car, ou empocher un ticket pour plus tard. */
function BusChoice({ state, payload, actor }) {
  const t = useT(state);
  return (
    <div className="space-y-2">
      <p className="text-sm">🚌 {t('busChoiceTitle')}</p>
      <div className="flex flex-wrap gap-2">
        {payload.canUse &&
          payload.tickets.map((ticket) => (
            <Button
              key={ticket.id}
              onClick={() => sendAction({ type: 'BUS_CHOICE', choice: 'use', ticketId: ticket.id }, actor)}
            >
              {t('useBusTicket')}
              {ticket.expires ? ' ⚠' : ''}
            </Button>
          ))}
        {payload.canTake && (
          <Button tone="ghost" onClick={() => sendAction({ type: 'BUS_CHOICE', choice: 'take' }, actor)}>
            {t('takeBusTicket')}
          </Button>
        )}
      </div>
      {payload.canTake && <p className="text-xs text-ink-soft">{t('busPoolLeft', payload.poolLeft)}</p>}
    </div>
  );
}

/**
 * Les tickets de bus en main. Rien à afficher tant que la partie n'en distribue
 * pas : le client lit `me.busTickets`, il ne connaît aucune édition par son nom.
 */
function BusTicketsSection({ state, me }) {
  const t = useT(state);
  const held = me?.busTickets ?? [];
  if (!held.length) return null;

  return (
    <div className="space-y-1 rounded-lg border border-[#1f4f8f]/35 bg-[#1f4f8f]/5 p-2">
      <div className="flex items-center gap-1.5 font-condensed text-[11px] font-bold uppercase tracking-wider">
        <span>🚌</span>
        <span>{t('busTickets')} ({held.length})</span>
      </div>
      <ul className="space-y-0.5 text-[11px] text-ink-soft">
        {held.map((ticket) => (
          <li key={ticket.id}>
            {t('useBusTicket')}
            {ticket.expires && (
              <span className="text-[var(--color-accent)]"> — ⚠ {t('busTicketExpires')}</span>
            )}
          </li>
        ))}
      </ul>
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
export function Manage({ state, me }) {
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
      <div className="flex items-center gap-2">
        <h3 className="font-condensed text-[11px] uppercase tracking-[0.2em] text-ink-soft">
          {t('myAssets', me.name)}
        </h3>
        {/* On ne défait qu'un geste réversible, et seulement le sien : jamais un
            jet de dés ni une carte, qui reviendrait à rejouer le hasard une fois
            le résultat connu. Le bouton n'apparaît donc que quand il y a
            vraiment quelque chose à reprendre. */}
        {state.undoable?.playerId === me.id && (
          <button
            type="button"
            title={t('undoHint')}
            onClick={() => sendAction({ type: 'UNDO' }, me.id)}
            className="ml-auto rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2 py-0.5 font-condensed text-[10px] uppercase tracking-wide text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
          >
            ↶ {t('undo')}
          </button>
        )}
      </div>
      <div className="scroll-thin max-h-52 space-y-1 overflow-y-auto pr-1">
        {owned
          .sort((a, b) => a.spaceId - b.spaceId)
          .map((prop) => {
            const space = board[prop.spaceId];
            const level = buildingLevel(prop);
            const btn = 'rounded border border-black/15 bg-white px-1.5 py-1 text-[10px] hover:bg-black/5';
            // Ce que le prochain clic pose et ce qui le bloque : maison, hôtel,
            // gratte-ciel ou dépôt, selon la case et ce que la boîte autorise.
            // Le moteur reste seul juge — ceci n'habille que le bouton.
            const step = nextBuildStep(state, prop, t);
            const groupSpaces = space.group ? groups[space.group].spaces : [];
            // Le groupe entier doit être nu pour hypothéquer quoi que ce soit —
            // sauf un dépôt, qui ne gèle que sa propre gare.
            const groupBuilt = space.type === 'railroad'
              ? Boolean(prop.depot)
              : groupSpaces.some((id) => buildingLevel(state.properties[id]) > 0);
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
                {(level > 0 || prop.depot) && (
                  <span
                    className={
                      prop.skyscraper || prop.depot
                        ? 'text-[#1f4f8f]'
                        : prop.hotel
                          ? 'text-[var(--color-hotel)]'
                          : 'text-[var(--color-house)]'
                    }
                    title={prop.skyscraper ? labels.skyscraper : prop.depot ? labels.depot : undefined}
                  >
                    {prop.depot ? '▬' : prop.skyscraper ? '▯' : prop.hotel ? '▮' : '▪'.repeat(prop.houses)}
                  </span>
                )}
                {prop.mortgaged && (
                  <span className="rounded-sm bg-[var(--color-accent)] px-1 py-0.5 font-condensed text-[9px] uppercase tracking-wide text-white">
                    {t('mortgaged')}
                  </span>
                )}
                <span className="ml-auto flex flex-wrap justify-end gap-1">
                  {!prop.mortgaged && (
                    <>
                      {/* Les prix sont écrits sur les boutons, pas en infobulle :
                          une infobulle ne s'ouvre jamais au doigt, et l'on ne doit
                          pas avoir à deviner ce qu'un clic va coûter. */}
                      {step && (
                        <button
                          className={`${btn} tabular disabled:opacity-35`}
                          disabled={Boolean(step.blocked)}
                          title={step.blocked ?? undefined}
                          onClick={() => sendAction({ type: 'BUILD_HOUSE', spaceId: prop.spaceId }, me.id)}
                        >
                          + {step.label} {money(state, step.cost)}
                        </button>
                      )}
                      {(level > 0 || prop.depot) && (
                        <button
                          className={`${btn} tabular`}
                          onClick={() => sendAction({ type: 'SELL_BUILDING', spaceId: prop.spaceId }, me.id)}
                        >
                          − {t('sellBuilding')}{' '}
                          {money(state, prop.depot ? (step?.cost ?? 100) / 2 : space.houseCost / 2)}
                        </button>
                      )}
                    </>
                  )}
                  {canMortgage &&
                    (prop.mortgaged ? (
                      <button
                        className={`${btn} tabular`}
                        onClick={() => sendAction({ type: 'UNMORTGAGE', spaceId: prop.spaceId }, me.id)}
                      >
                        {t('unmortgage')} ({money(state, Math.ceil(space.mortgage * 1.1))})
                      </button>
                    ) : (
                      // Règle officielle : tout le groupe doit être nu, pas
                      // seulement ce terrain-là. Le bouton se grise plutôt que de
                      // disparaître, avec la raison au survol — sinon on cherche
                      // pourquoi l'hypothèque a disparu.
                      <button
                        className={`${btn} tabular disabled:opacity-35`}
                        disabled={groupBuilt}
                        title={groupBuilt ? t('groupStillBuilt') : undefined}
                        onClick={() => sendAction({ type: 'MORTGAGE', spaceId: prop.spaceId }, me.id)}
                      >
                        {t('mortgage')} ({money(state, space.mortgage)})
                      </button>
                    ))}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default function Actions({ state, me, mine, onOpenTrade, onOpenSettlement, onOpenFullLog }) {
  const t = useT(state);
  const [targetingCard, setTargetingCard] = useState(null);

  if (!me) return null;
  const { pending } = state;
  const actor = me.id;
  const mineTurn = pending.playerIds?.includes(me.id);
  const waitingFor = state.players.find((p) => p.id === pending.playerIds?.[0]);
  const hotSeat = mine.length > 1;
  const localIds = mine.map((p) => p.id);
  const incomingTrades = state.trades.filter(
    (t) => t.status === 'pending' && localIds.includes(t.toPlayerId),
  );
  const pendingOffers = incomingTrades.length;
  const firstProposerId = incomingTrades[0]?.fromPlayerId;

  const handlePlayCard = (card, actionType, cardId) => {
    if (cardNeedsTarget(card)) {
      setTargetingCard({ card, actionType, cardId });
    } else {
      sendAction({ type: actionType, cardId }, actor);
    }
  };

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
    <div className="space-y-3">
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
          onClick={() => onOpenTrade(firstProposerId)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border-2 border-amber-500 bg-amber-50 px-3 py-2 text-left shadow-sm hover:bg-amber-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-base animate-bounce">📬</span>
            <span className="font-condensed text-xs font-bold uppercase text-amber-950">
              {pendingOffers} offre{pendingOffers > 1 ? 's' : ''} d'échange reçue{pendingOffers > 1 ? 's' : ''}
            </span>
          </div>
          <span className="rounded bg-amber-500 px-2 py-0.5 font-condensed text-[10px] font-bold uppercase text-white">
            Voir & Négocier →
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
      {mineTurn && pending.kind === 'reroll' && (
        <div className="space-y-2">
          <p className="text-sm">
            {t('rerollAsk', (pending.payload.values ?? []).join(' + '), pending.payload.total)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => sendAction({ type: 'KEEP_ROLL' }, actor)}>{t('keepRoll')}</Button>
            <Button tone="ghost" onClick={() => sendAction({ type: 'REROLL_DICE' }, actor)}>
              {t('rerollDice')}
            </Button>
          </div>
        </div>
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
      {mineTurn && pending.kind === 'roll_escape_die' && (
        <EscapeDieComponent state={state} actor={actor} />
      )}
      {mineTurn && pending.kind === 'roll_heist_die' && (
        <HeistDieComponent state={state} actor={actor} />
      )}
      {mineTurn && pending.kind === 'jail_decision' && (
        <JailDecisionModal state={state} payload={pending.payload} actor={actor} />
      )}
      {mineTurn && pending.kind === 'leave_super_jail' && (
        <LeaveSuperJailModal state={state} payload={pending.payload} actor={actor} />
      )}
      {mineTurn && pending.kind === 'spin_spinner' && (
        <FreeParkingSpinnerComponent state={state} actor={actor} />
      )}
      {mineTurn && pending.kind === 'choose_rent_or_chip' && (
        <ChooseRentOrChipModal state={state} payload={pending.payload} actor={actor} />
      )}
      {mineTurn && pending.kind === 'buy_sale_card' && (
        <BuySaleCardModal state={state} me={me} payload={pending.payload} actor={actor} />
      )}
      {mineTurn && pending.kind === 'force_discard_sale_card' && (
        <ForceDiscardModal state={state} payload={pending.payload} actor={actor} />
      )}
      {mineTurn && pending.kind === 'refresh_sale_vault' && (
        <RefreshVaultModal state={state} payload={pending.payload} actor={actor} />
      )}
      {mineTurn && pending.kind === 'buy_or_auction' && (
        <BuyOrAuction state={state} me={me} payload={pending.payload} actor={actor} />
      )}
      {mineTurn && pending.kind === 'auction_bid' && <Auction state={state} me={me} actor={actor} />}
      {mineTurn && pending.kind === 'card_choice' && <CardChoice payload={pending.payload} actor={actor} />}
      {mineTurn && pending.kind === 'choose_space' && (
        <ChooseSpace state={state} payload={pending.payload} actor={actor} />
      )}
      {mineTurn && pending.kind === 'bus_choice' && (
        <BusChoice state={state} payload={pending.payload} actor={actor} />
      )}
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
          {/* Proposé par le serveur seulement quand le jet reste à faire. */}
          {pending.payload?.canRollBuyDie && (
            <Button tone="ghost" onClick={() => sendAction({ type: 'ROLL_BUY_DIE' }, actor)}>
              {t('buyDie')}
            </Button>
          )}
          <Button tone="ghost" onClick={() => onOpenTrade()}>
            {t('trade')}
          </Button>
        </div>
      )}

      <CorruptionSection state={state} me={me} actor={actor} isTurn={mineTurn && pending.kind === 'end_turn'} onPlayCard={handlePlayCard} />
      <FreeParkingBonusSection state={state} me={me} actor={actor} isTurn={mineTurn && pending.kind === 'end_turn'} onPlayCard={handlePlayCard} />
      <SaleVault state={state} me={me} actor={actor} onPlayCard={handlePlayCard} />
      <BusTicketsSection state={state} me={me} />

      {(!mineTurn || pending.kind !== 'end_turn') && state.phase === 'playing' && pending.kind !== 'pay_debt' && (
        <Button tone="ghost" onClick={() => onOpenTrade()}>
          {t('negotiate')}{pendingOffers > 0 ? ` (${pendingOffers})` : ''}
        </Button>
      )}

      <MiniGameLog state={state} onOpenFullLog={onOpenFullLog} />

      {targetingCard && (
        <CardTargetModal
          card={targetingCard.card}
          state={state}
          me={me}
          onConfirm={(payload) => {
            sendAction({ type: targetingCard.actionType, cardId: targetingCard.cardId, payload }, actor);
            setTargetingCard(null);
          }}
          onCancel={() => setTargetingCard(null)}
        />
      )}
    </div>
  );
}
