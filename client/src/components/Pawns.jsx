/**
 * Les pions, dans une couche flottante au-dessus du plateau.
 *
 * Ils ne vivent pas à l'intérieur des cases : ils sont positionnés en pourcentage
 * du plateau et glissent d'une case à l'autre. C'est ce qui permet de vraiment
 * les animer — un pion qu'on déplace de case en case, comme à la main.
 */
import { useEffect, useRef, useState } from 'react';
import { spaceRect, boardOf, editionFor } from '../lib/board.js';
import TokenIcon from './TokenIcon.jsx';

const STEP_MS = 260; // durée d'un pas — on prend le temps de voir le pion avancer
const DIRECT_JUMP = 13; // au-delà, on saute directement (prison, carte « reculez »)

/**
 * Fait avancer chaque pion case par case vers sa position réelle.
 *
 * Un seul minuteur pour tout le plateau, monté une fois. Les positions visées
 * sont relues à chaque battement dans une ref : un déplacement qui arrive au
 * milieu d'une animation est donc pris en compte, au lieu de la bloquer.
 */
function useWalk(state, players, hold) {
  const [shown, setShown] = useState({});
  const targets = useRef({});
  // Tant que les dés roulent, on garde les anciennes cibles : le pion ne part
  // qu'une fois le résultat connu, comme on attend que les dés s'arrêtent.
  if (!hold || Object.keys(targets.current).length === 0) {
    targets.current = Object.fromEntries(players.map((p) => [p.id, p.position]));
  }

  // Une joueuse qui apparaît (arrivée, reconnexion) est posée directement.
  useEffect(() => {
    setShown((prev) => {
      let next = prev;
      for (const player of players) {
        if (prev[player.id] !== undefined) continue;
        if (next === prev) next = { ...prev };
        next[player.id] = player.position;
      }
      return next;
    });
  }, [players.map((p) => p.id).join(',')]);

  useEffect(() => {
    const timer = setInterval(() => {
      setShown((prev) => {
        let next = prev;
        for (const [id, target] of Object.entries(targets.current)) {
          const current = prev[id];
          if (current === undefined || current === target) continue;
          const size = boardOf(state).length;
          const forward = (target - current + size) % size;
          const step = forward > 0 && forward < DIRECT_JUMP ? (current + 1) % size : target;
          if (next === prev) next = { ...prev };
          next[id] = step;
        }
        return next; // inchangé = aucun rendu déclenché
      });
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return shown;
}

export default function Pawns({ state, players, hold = false }) {
  const shown = useWalk(state, players, hold);

  // Plusieurs pions sur la même case : on les décale en éventail.
  const perSpace = {};
  for (const player of players) {
    const space = shown[player.id] ?? player.position;
    (perSpace[space] ??= []).push(player.id);
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <Hazards state={state} />
      <HazardPawn state={state} />
      {players.map((player) => {
        const space = shown[player.id] ?? player.position;
        const moving = space !== player.position;
        const rect = spaceRect(state, space);
        const group = perSpace[space];
        const spread =
          group.length > 1 ? (group.indexOf(player.id) - (group.length - 1) / 2) * (rect.w * 0.52) : 0;

        const isDealMobile = state.dealMobileOwnerId === player.id;

        return (
          <span
            key={player.id}
            className={`absolute flex items-center justify-center rounded-full border-2 bg-[#fffdf7] ${
              moving ? 'pawn-hop' : ''
            }`}
            style={{
              left: `${rect.x + spread}%`,
              top: `${rect.y + rect.h * 0.2}%`,
              width: '3.6%',
              height: '3.6%',
              marginLeft: '-1.8%',
              marginTop: '-1.8%',
              opacity: player.bankrupt ? 0.3 : 1,
              transition: `left ${STEP_MS}ms ease-in-out, top ${STEP_MS}ms ease-in-out`,
              borderColor: isDealMobile ? '#d4af37' : player.color,
              boxShadow: isDealMobile
                ? `0 0 0 2.5px #ffd700, 0 0 10px #ffd700, 0 3px 7px rgba(0,0,0,.5)`
                : `0 0 0 2px ${player.color}, 0 3px 7px rgba(0,0,0,.5)`,
              zIndex: moving ? 4 : isDealMobile ? 3 : 1,
            }}
            title={isDealMobile ? `${player.name} (Deal Mobile)` : player.name}
          >
            <TokenIcon
              token={isDealMobile ? 'deal_mobile' : player.token}
              color={isDealMobile ? '#b8860b' : player.color}
              className="h-[76%] w-[76%]"
            />
            {isDealMobile && (
              <span
                className="absolute -top-2.5 -right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-[9px] shadow-sm ring-1 ring-white"
                title="Deal Mobile : propriétés gratuites & 0 loyer !"
              >
                ★
              </span>
            )}
            {player.superJail && (
              <span
                className="absolute -top-2.5 -right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-400 text-[9px] text-white shadow-sm ring-1 ring-white"
                title="Super Prison !"
              >
                ⚡
              </span>
            )}
            {!player.superJail && player.inJail && !isDealMobile && (
              <span
                className="absolute -top-2.5 -right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-tr from-stone-700 to-zinc-500 text-[9px] text-white shadow-sm ring-1 ring-white"
                title="En Prison"
              >
                ⛓
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}


/**
 * Les cases piégées par le pion hostile. Rien à afficher tant que l'édition
 * n'en pose pas : le client ne connaît aucune édition par son nom, il lit
 * simplement `state.hazards`.
 */
function Hazards({ state }) {
  const marked = Object.keys(state.hazards ?? {});
  if (marked.length === 0) return null;

  return (
    <>
      {marked.map((spaceId) => {
        const rect = spaceRect(state, Number(spaceId));
        return (
          <span
            key={`hazard-${spaceId}`}
            className="absolute flex items-center justify-center rounded-full"
            style={{
              left: `${rect.x}%`,
              top: `${rect.y - rect.h * 0.22}%`,
              width: '2.6%',
              height: '2.6%',
              marginLeft: '-1.3%',
              marginTop: '-1.3%',
              background: 'radial-gradient(circle at 35% 30%, #ffb648, #d9531e 60%, #7d2408)',
              boxShadow: '0 0 8px rgba(255,150,40,.85), 0 2px 5px rgba(0,0,0,.55)',
            }}
            title="Piège"
          />
        );
      })}
    </>
  );
}

/** Le pion qui joue tout seul, posé sur le plateau comme les autres. */
function HazardPawn({ state }) {
  const pawn = state.hazardPawn;
  if (!pawn) return null;
  const label = editionFor(state).mechanics?.hazardPawn?.label ?? '';
  const rect = spaceRect(state, pawn.position);

  return (
    <span
      className="absolute flex items-center justify-center rounded-full border-2"
      style={{
        left: `${rect.x}%`,
        top: `${rect.y - rect.h * 0.24}%`,
        width: '4.2%',
        height: '4.2%',
        marginLeft: '-2.1%',
        marginTop: '-2.1%',
        borderColor: '#7bd44e',
        background: '#12210c',
        boxShadow: '0 0 0 2px #2f6b1f, 0 0 12px rgba(123,212,78,.75), 0 3px 8px rgba(0,0,0,.6)',
        transition: `left ${STEP_MS}ms ease-in-out, top ${STEP_MS}ms ease-in-out`,
        zIndex: 4,
      }}
      title={label}
    >
      <TokenIcon token="planeur" color="#7bd44e" className="h-[74%] w-[74%]" />
    </span>
  );
}
