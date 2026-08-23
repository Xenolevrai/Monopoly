import { useState } from 'react';
import TokenIcon from './TokenIcon.jsx';
import { ownableSpaces, groupColor, money, boardOf } from '../lib/board.js';

export default function CardTargetModal({ card, state, me, onConfirm, onCancel }) {
  const isEn = state.locale === 'en';
  const actionType = card?.action?.type ?? card?.ability?.type;

  // Determine what kind of target selection is needed
  const needsUnownedProperty = [
    'free_property',
    'take_two',
    'money_laundering',
    'auction_hoax',
  ].includes(actionType);

  const needsOwnedProperty = [
    'free_house',
    'creative_zoning',
    'long_con',
  ].includes(actionType);

  const needsOpponentProperty = [
    'bank_fraud',
    'good_ol_scam',
    'forgery',
  ].includes(actionType);

  const needsPlayer = [
    'framed',
    'loan_shark',
    'snitch',
    'identity_theft',
    'blackmail',
  ].includes(actionType);

  const needsBoardSpace = [
    'shortcut',
    'on_the_lam',
    'teleport',
  ].includes(actionType);

  const needsTradeIn = ['trade_in', 'swindle'].includes(actionType);
  const needsBaitSwitch = ['bait_switch', 'swap_property'].includes(actionType);
  const needsGoGreen = actionType === 'go_green';

  // Selection states
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [giveSpaceId, setGiveSpaceId] = useState(null);
  const [takeSpaceId, setTakeSpaceId] = useState(null);
  const [selectedSectorId, setSelectedSectorId] = useState('green-jackpot');

  // Compute candidates
  const allBoard = boardOf(state);
  const allOwnables = ownableSpaces(state);

  const unownedSpaces = allOwnables.filter((s) => !state.properties[s.id]?.ownerId);

  const myProperties = allOwnables.filter((s) => state.properties[s.id]?.ownerId === me.id);

  const opponentProperties = allOwnables.filter((s) => {
    const prop = state.properties[s.id];
    return prop?.ownerId && prop.ownerId !== me.id;
  });

  const opponents = state.players.filter((p) => p.id !== me.id && !p.bankrupt);

  const greenSectors = [
    { id: 'green-jackpot', labelFr: 'JACKPOT !', labelEn: 'JACKPOT!', descFr: 'Prendre toute la cagnotte', descEn: 'Collect All Pot', icon: '💰' },
    { id: 'green-deal-mobile', labelFr: 'Deal Mobile', labelEn: 'Deal Mobile', descFr: 'Voiture dorée (gratuité loyers)', descEn: 'Golden Car (free rent)', icon: '🚗' },
    { id: 'green-free-house', labelFr: 'Maison offerte', labelEn: 'Free House', descFr: '1 maison gratuite', descEn: '1 free house build', icon: '🏠' },
    { id: 'green-buy-any', labelFr: 'Titre au choix', labelEn: 'Buy Any 1', descFr: 'Acheter 1 titre libre', descEn: 'Buy 1 free property', icon: '🏷️' },
  ];

  const handleValidate = () => {
    const payload = {};

    if (needsUnownedProperty || needsOwnedProperty || needsOpponentProperty || needsBoardSpace) {
      if (selectedSpaceId != null) {
        payload.spaceId = selectedSpaceId;
        payload.targetSpaceId = selectedSpaceId;
      }
    }

    if (needsPlayer) {
      if (selectedPlayerId != null) {
        payload.targetPlayerId = selectedPlayerId;
      }
    }

    if (needsTradeIn || needsBaitSwitch) {
      if (giveSpaceId != null) payload.giveSpaceId = giveSpaceId;
      if (giveSpaceId != null) payload.mySpaceId = giveSpaceId;
      if (takeSpaceId != null) payload.takeSpaceId = takeSpaceId;
      if (takeSpaceId != null) payload.targetSpaceId = takeSpaceId;
    }

    if (needsGoGreen) {
      payload.sectorId = selectedSectorId;
    }

    onConfirm(payload);
  };

  const isComplete = () => {
    if (needsUnownedProperty) return selectedSpaceId != null || unownedSpaces.length === 0;
    if (needsOwnedProperty) return selectedSpaceId != null || myProperties.length === 0;
    if (needsOpponentProperty) return selectedSpaceId != null || opponentProperties.length === 0;
    if (needsPlayer) return selectedPlayerId != null || opponents.length === 0;
    if (needsBoardSpace) return selectedSpaceId != null;
    if (needsTradeIn) return (giveSpaceId != null && takeSpaceId != null) || myProperties.length === 0 || unownedSpaces.length === 0;
    if (needsBaitSwitch) return (giveSpaceId != null && takeSpaceId != null) || myProperties.length === 0 || opponentProperties.length === 0;
    if (needsGoGreen) return selectedSectorId != null;
    return true;
  };

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border-2 border-amber-500/50 bg-stone-900 text-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête de la carte */}
        <div className="border-b border-white/15 bg-stone-800/80 p-4">
          <div className="flex items-center justify-between">
            <span className="font-condensed text-xs font-bold uppercase tracking-wider text-amber-400">
              {isEn ? 'Choose Target for Card' : 'Sélectionnez la cible de la carte'}
            </span>
            <button
              onClick={onCancel}
              className="text-stone-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>
          </div>
          <h3 className="mt-1 font-condensed text-xl font-bold uppercase text-white">
            {card.title}
          </h3>
          <p className="mt-1 text-xs text-stone-300 leading-snug">{card.text}</p>
        </div>

        {/* Corps de sélection */}
        <div className="scroll-thin flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. Sélection d'une propriété libre */}
          {needsUnownedProperty && (
            <div className="space-y-2">
              <p className="font-condensed text-xs font-bold uppercase tracking-wide text-amber-300">
                {isEn ? 'Select an unowned property on the board:' : 'Choisissez une propriété libre sur le plateau :'}
              </p>
              {unownedSpaces.length === 0 ? (
                <p className="text-xs text-stone-400 italic">
                  {isEn ? 'No unowned properties remaining.' : 'Aucune propriété libre disponible.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                  {unownedSpaces.map((sp) => {
                    const col = groupColor(state, sp);
                    const selected = selectedSpaceId === sp.id;
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => setSelectedSpaceId(sp.id)}
                        className={`flex items-center justify-between rounded-lg border p-2 text-left text-xs transition-all ${
                          selected
                            ? 'border-amber-400 bg-amber-500/20 text-white font-bold ring-2 ring-amber-400'
                            : 'border-white/15 bg-stone-800/80 text-stone-200 hover:bg-stone-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {col && (
                            <span
                              className="h-3 w-3 shrink-0 rounded-full border border-black/40"
                              style={{ backgroundColor: col }}
                            />
                          )}
                          <span className="truncate">{sp.name}</span>
                        </div>
                        <span className="shrink-0 text-[10px] text-amber-300">{money(state, sp.price)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Sélection d'une de ses propres propriétés */}
          {needsOwnedProperty && (
            <div className="space-y-2">
              <p className="font-condensed text-xs font-bold uppercase tracking-wide text-amber-300">
                {isEn ? 'Select one of your properties:' : 'Choisissez l’une de vos propriétés :'}
              </p>
              {myProperties.length === 0 ? (
                <p className="text-xs text-stone-400 italic">
                  {isEn ? 'You do not own any properties yet.' : 'Vous ne possédez encore aucune propriété.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                  {myProperties.map((sp) => {
                    const col = groupColor(state, sp);
                    const prop = state.properties[sp.id];
                    const selected = selectedSpaceId === sp.id;
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => setSelectedSpaceId(sp.id)}
                        className={`flex items-center justify-between rounded-lg border p-2 text-left text-xs transition-all ${
                          selected
                            ? 'border-amber-400 bg-amber-500/20 text-white font-bold ring-2 ring-amber-400'
                            : 'border-white/15 bg-stone-800/80 text-stone-200 hover:bg-stone-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {col && (
                            <span
                              className="h-3 w-3 shrink-0 rounded-full border border-black/40"
                              style={{ backgroundColor: col }}
                            />
                          )}
                          <span className="truncate">{sp.name}</span>
                        </div>
                        <span className="shrink-0 text-[10px] text-stone-300">
                          {prop?.hotel ? '🏨' : prop?.houses > 0 ? `🏠x${prop.houses}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. Sélection d'une propriété adverse */}
          {needsOpponentProperty && (
            <div className="space-y-2">
              <p className="font-condensed text-xs font-bold uppercase tracking-wide text-amber-300">
                {isEn ? 'Select an opponent property:' : 'Choisissez une propriété adverse :'}
              </p>
              {opponentProperties.length === 0 ? (
                <p className="text-xs text-stone-400 italic">
                  {isEn ? 'Opponents do not own any properties.' : 'Aucune propriété adverse disponible.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                  {opponentProperties.map((sp) => {
                    const col = groupColor(state, sp);
                    const prop = state.properties[sp.id];
                    const owner = state.players.find((p) => p.id === prop?.ownerId);
                    const selected = selectedSpaceId === sp.id;
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => setSelectedSpaceId(sp.id)}
                        className={`flex flex-col gap-1 rounded-lg border p-2 text-left text-xs transition-all ${
                          selected
                            ? 'border-amber-400 bg-amber-500/20 text-white font-bold ring-2 ring-amber-400'
                            : 'border-white/15 bg-stone-800/80 text-stone-200 hover:bg-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 overflow-hidden">
                          <div className="flex items-center gap-1.5 truncate">
                            {col && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: col }} />}
                            <span className="truncate font-semibold">{sp.name}</span>
                          </div>
                          <span className="shrink-0 text-[10px] text-amber-300">{money(state, sp.price)}</span>
                        </div>
                        {owner && (
                          <div className="flex items-center gap-1 text-[10px] text-stone-400">
                            <TokenIcon token={owner.token} color={owner.color} className="h-3 w-3" />
                            <span>{owner.name}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. Sélection d'une joueuse cible */}
          {needsPlayer && (
            <div className="space-y-2">
              <p className="font-condensed text-xs font-bold uppercase tracking-wide text-amber-300">
                {isEn ? 'Select a target player:' : 'Choisissez une joueuse cible :'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {opponents.map((opp) => {
                  const selected = selectedPlayerId === opp.id;
                  return (
                    <button
                      key={opp.id}
                      type="button"
                      onClick={() => setSelectedPlayerId(opp.id)}
                      className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
                        selected
                          ? 'border-amber-400 bg-amber-500/20 text-white font-bold ring-2 ring-amber-400'
                          : 'border-white/15 bg-stone-800/80 text-stone-200 hover:bg-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <TokenIcon token={opp.token} color={opp.color} className="h-6 w-6" />
                        <div>
                          <p className="font-bold text-sm">{opp.name}</p>
                          <p className="text-xs text-stone-400">{money(state, opp.cash)}</p>
                        </div>
                      </div>
                      {opp.inJail && <span className="text-xs text-rose-400 font-bold">⛓️ {isEn ? 'In Jail' : 'En prison'}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Sélection d'une case quelconque du plateau (Téléportation / En cavale / Raccourci) */}
          {needsBoardSpace && (
            <div className="space-y-2">
              <p className="font-condensed text-xs font-bold uppercase tracking-wide text-amber-300">
                {isEn ? 'Choose destination space on board:' : 'Choisissez la case de destination :'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto">
                {allBoard.map((sp) => {
                  const col = groupColor(state, sp);
                  const selected = selectedSpaceId === sp.id;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setSelectedSpaceId(sp.id)}
                      className={`flex items-center gap-1.5 rounded border p-1.5 text-left text-xs transition-all ${
                        selected
                          ? 'border-amber-400 bg-amber-500/20 text-white font-bold ring-2 ring-amber-400'
                          : 'border-white/15 bg-stone-800/80 text-stone-200 hover:bg-stone-700'
                      }`}
                    >
                      {col && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: col }} />}
                      <span className="truncate text-[11px]">{sp.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Échange de propriétés (Trade In / Reprise contre libre) */}
          {needsTradeIn && (
            <div className="space-y-3">
              <div>
                <p className="font-condensed text-xs font-bold uppercase tracking-wide text-amber-300">
                  1. {isEn ? 'Your property to give:' : 'Votre propriété à donner :'}
                </p>
                <div className="mt-1 grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                  {myProperties.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setGiveSpaceId(sp.id)}
                      className={`flex items-center gap-1.5 rounded border p-1.5 text-left text-xs ${
                        giveSpaceId === sp.id ? 'border-amber-400 bg-amber-500/20 text-white font-bold' : 'border-white/15 bg-stone-800'
                      }`}
                    >
                      <span className="truncate">{sp.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-condensed text-xs font-bold uppercase tracking-wide text-amber-300">
                  2. {isEn ? 'Unowned property to receive:' : 'Propriété libre à récupérer :'}
                </p>
                <div className="mt-1 grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                  {unownedSpaces.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setTakeSpaceId(sp.id)}
                      className={`flex items-center gap-1.5 rounded border p-1.5 text-left text-xs ${
                        takeSpaceId === sp.id ? 'border-amber-400 bg-amber-500/20 text-white font-bold' : 'border-white/15 bg-stone-800'
                      }`}
                    >
                      <span className="truncate">{sp.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7. Échange forcé contre propriété adverse (Bait & Switch / Swap Property) */}
          {needsBaitSwitch && (
            <div className="space-y-3">
              <div>
                <p className="font-condensed text-xs font-bold uppercase tracking-wide text-amber-300">
                  1. {isEn ? 'Your property to give:' : 'Votre propriété à échanger :'}
                </p>
                <div className="mt-1 grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                  {myProperties.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setGiveSpaceId(sp.id)}
                      className={`flex items-center gap-1.5 rounded border p-1.5 text-left text-xs ${
                        giveSpaceId === sp.id ? 'border-amber-400 bg-amber-500/20 text-white font-bold' : 'border-white/15 bg-stone-800'
                      }`}
                    >
                      <span className="truncate">{sp.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-condensed text-xs font-bold uppercase tracking-wide text-amber-300">
                  2. {isEn ? 'Opponent property to steal/swap:' : 'Propriété adverse à récupérer :'}
                </p>
                <div className="mt-1 grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                  {opponentProperties.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setTakeSpaceId(sp.id)}
                      className={`flex items-center gap-1.5 rounded border p-1.5 text-left text-xs ${
                        takeSpaceId === sp.id ? 'border-amber-400 bg-amber-500/20 text-white font-bold' : 'border-white/15 bg-stone-800'
                      }`}
                    >
                      <span className="truncate">{sp.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 8. Sélection de secteur vert (Go Green) */}
          {needsGoGreen && (
            <div className="space-y-2">
              <p className="font-condensed text-xs font-bold uppercase tracking-wide text-amber-300">
                {isEn ? 'Choose target Green Sector:' : 'Choisissez le secteur vert désiré :'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {greenSectors.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setSelectedSectorId(sec.id)}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-left ${
                      selectedSectorId === sec.id
                        ? 'border-emerald-400 bg-emerald-600/30 text-white font-bold ring-2 ring-emerald-400'
                        : 'border-white/15 bg-stone-800 text-stone-200'
                    }`}
                  >
                    <span className="text-xl">{sec.icon}</span>
                    <div>
                      <p className="text-xs font-bold">{isEn ? sec.labelEn : sec.labelFr}</p>
                      <p className="text-[10px] text-stone-400">{isEn ? sec.descEn : sec.descFr}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="border-t border-white/15 bg-stone-800/90 p-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/20 bg-stone-700 py-2 font-condensed text-xs font-bold uppercase tracking-wider text-stone-300 hover:bg-stone-600 transition-colors"
          >
            {isEn ? 'Cancel' : 'Annuler'}
          </button>

          <button
            type="button"
            disabled={!isComplete()}
            onClick={handleValidate}
            className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:hover:bg-amber-500 py-2 font-condensed text-xs font-bold uppercase tracking-wider text-stone-950 transition-colors shadow-lg"
          >
            {isEn ? 'Confirm & Play' : 'Valider & Jouer'}
          </button>
        </div>
      </div>
    </div>
  );
}
