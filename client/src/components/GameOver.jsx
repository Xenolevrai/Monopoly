/**
 * L'écran de fin de partie.
 *
 * Il occupe le milieu de l'écran, chez tout le monde en même temps : une partie
 * qui s'arrête mérite mieux qu'une ligne dans un panneau latéral. On y lit le
 * podium, le détail du patrimoine de chacune, et on repart de là — soit en
 * regardant une dernière fois le plateau, soit en quittant pour rejouer.
 */
import { money } from '../lib/board.js';
import TokenIcon from './TokenIcon.jsx';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function GameOver({ state, onLeave, onClose }) {
  const standings = state.standings ?? [];
  const winner = state.players.find((p) => p.id === state.winnerId);
  const podium = standings.filter((entry) => !entry.bankrupt);
  const best = podium[0]?.worth || 1;

  return (
    <div className="fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="panel max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl">
        {/* Le bandeau, dans l'esprit du cartouche du plateau. */}
        <div className="border-b-[3px] border-ink bg-[var(--color-accent)] px-6 py-5 text-center">
          <p className="font-condensed text-sm uppercase tracking-[0.4em] text-white/80">
            Fin de la partie
          </p>
          {winner ? (
            <div className="mt-2 flex items-center justify-center gap-3">
              <TokenIcon token={winner.token} color="#fff" className="h-10 w-10" />
              <p className="font-condensed text-4xl uppercase tracking-[0.1em] text-white">
                {winner.name}
              </p>
            </div>
          ) : (
            <p className="mt-2 font-condensed text-3xl uppercase text-white">Match nul</p>
          )}
          <p className="mt-1 font-condensed text-xs uppercase tracking-[0.25em] text-white/80">
            {winner ? "l'emporte" : ''}
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-condensed text-base uppercase tracking-[0.2em]">Le compte final</h2>
            <span className="text-[11px] text-ink-soft">
              {state.turnCount} tours joués · partie {state.code}
            </span>
          </div>

          <ol className="space-y-2">
            {standings.map((entry, index) => {
              const player = state.players.find((p) => p.id === entry.playerId);
              const share = entry.bankrupt ? 0 : Math.round((entry.worth / best) * 100);
              return (
                <li
                  key={entry.playerId}
                  className={`relative overflow-hidden rounded border px-3 py-2 ${
                    index === 0 && !entry.bankrupt
                      ? 'border-[var(--color-accent)] bg-white'
                      : 'border-black/12 bg-white/70'
                  } ${entry.bankrupt ? 'opacity-60' : ''}`}
                >
                  {/* Une barre de fond proportionnelle au patrimoine : le rapport
                      de force se lit d'un coup d'œil. */}
                  <span
                    className="absolute inset-y-0 left-0 -z-0"
                    style={{
                      width: `${share}%`,
                      backgroundColor: `${player?.color ?? '#999'}1f`,
                    }}
                  />
                  <div className="relative flex items-center gap-3">
                    <span className="w-6 text-center font-condensed text-lg">
                      {entry.bankrupt ? '—' : (MEDALS[index] ?? index + 1)}
                    </span>
                    {player && (
                      <TokenIcon token={player.token} color={player.color} className="h-7 w-7 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-condensed text-lg uppercase leading-none">{entry.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-soft">
                        {entry.bankrupt
                          ? 'éliminée en cours de partie'
                          : `${money(state, entry.cash)} en poche · ${entry.properties} propriété${
                              entry.properties > 1 ? 's' : ''
                            } · ${entry.buildings} construction${entry.buildings > 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <span className="tabular ml-auto shrink-0 font-condensed text-xl text-[var(--color-money)]">
                      {entry.bankrupt ? '—' : money(state, entry.worth)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="text-center text-[11px] text-ink-soft">
            Classement au patrimoine : argent liquide + prix des propriétés + valeur des constructions.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onLeave}
              className="flex-1 rounded bg-[var(--color-accent)] py-2.5 font-condensed text-base uppercase tracking-wide text-white transition-colors hover:bg-[var(--color-accent-deep)]"
            >
              Quitter et créer une nouvelle partie
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-black/15 bg-white px-4 font-condensed text-sm uppercase hover:bg-black/5"
            >
              Revoir le plateau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
