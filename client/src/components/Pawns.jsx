/**
 * Les pions, dans une couche flottante au-dessus du plateau.
 *
 * Ils ne vivent pas à l'intérieur des cases : ils sont positionnés en pourcentage
 * du plateau et glissent d'une case à l'autre. C'est ce qui permet de vraiment
 * les animer — un pion qu'on déplace de case en case, comme à la main.
 */
import { useEffect, useRef, useState } from 'react';
import { spaceRect } from '../lib/board.js';
import TokenIcon from './TokenIcon.jsx';

const STEP_MS = 165; // durée d'un pas
const DIRECT_JUMP = 13; // au-delà, on saute directement (prison, carte « reculez »)

/**
 * Fait avancer chaque pion case par case vers sa position réelle.
 *
 * Un seul minuteur pour tout le plateau, monté une fois. Les positions visées
 * sont relues à chaque battement dans une ref : un déplacement qui arrive au
 * milieu d'une animation est donc pris en compte, au lieu de la bloquer.
 */
function useWalk(players) {
  const [shown, setShown] = useState({});
  const targets = useRef({});
  targets.current = Object.fromEntries(players.map((p) => [p.id, p.position]));

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
          const forward = (target - current + 40) % 40;
          const step = forward > 0 && forward < DIRECT_JUMP ? (current + 1) % 40 : target;
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

export default function Pawns({ players }) {
  const shown = useWalk(players);

  // Plusieurs pions sur la même case : on les décale en éventail.
  const perSpace = {};
  for (const player of players) {
    const space = shown[player.id] ?? player.position;
    (perSpace[space] ??= []).push(player.id);
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {players.map((player) => {
        const space = shown[player.id] ?? player.position;
        const moving = space !== player.position;
        const rect = spaceRect(space);
        const group = perSpace[space];
        const spread =
          group.length > 1 ? (group.indexOf(player.id) - (group.length - 1) / 2) * (rect.w * 0.4) : 0;

        return (
          <span
            key={player.id}
            className={`absolute flex items-center justify-center rounded-full border border-black/60 bg-[#fffdf7] ${
              moving ? 'pawn-hop' : ''
            }`}
            style={{
              left: `${rect.x + spread}%`,
              top: `${rect.y + rect.h * 0.2}%`,
              width: '2.2%',
              height: '2.2%',
              marginLeft: '-1.1%',
              marginTop: '-1.1%',
              opacity: player.bankrupt ? 0.3 : 1,
              transition: `left ${STEP_MS}ms ease-out, top ${STEP_MS}ms ease-out`,
              boxShadow: `0 0 0 1.5px ${player.color}66, 0 2px 5px rgba(0,0,0,.45)`,
            }}
            title={player.name}
          >
            <TokenIcon token={player.token} color={player.color} className="h-[74%] w-[74%]" />
          </span>
        );
      })}
    </div>
  );
}
