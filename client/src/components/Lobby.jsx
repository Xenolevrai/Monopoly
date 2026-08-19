/** Accueil (créer / rejoindre) puis salon d'attente avec le code à partager. */
import { useEffect, useState } from 'react';
import { socket } from '../lib/socket.js';
import { getEdition, DEFAULT_EDITION } from '../lib/board.js';
import TokenIcon from './TokenIcon.jsx';

// Avant qu'une partie n'existe (accueil, salon d'attente), il n'y a pas encore
// d'édition choisie : on affiche celle par défaut.
const rules = getEdition(DEFAULT_EDITION);

function Logo({ small = false }) {
  return (
    <div className="flex flex-col items-center">
      <div className="border-y-[3px] border-ink bg-[var(--color-accent)] px-6 py-1.5 shadow-[0_3px_0_rgba(0,0,0,.3)]">
        <p
          className={`font-condensed uppercase tracking-[0.18em] text-[#f7f4ea] ${
            small ? 'text-2xl' : 'text-4xl'
          }`}
        >
          Monopoly
        </p>
      </div>
      <p className="mt-1.5 font-condensed text-[11px] uppercase tracking-[0.5em] text-ink-soft">Paris</p>
    </div>
  );
}

/**
 * Choix du pion : un seul par personne, les pions déjà pris sont barrés.
 */
function TokenPicker({ value, onChange, taken = [] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {rules.tokens.map((item) => {
        const isTaken = taken.includes(item.id);
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            disabled={isTaken}
            onClick={() => onChange(item.id)}
            title={isTaken ? `${item.label} — déjà pris` : item.label}
            className={`flex flex-col items-center gap-1 rounded border px-2 py-2 transition-all ${
              selected
                ? 'border-[var(--color-accent)] bg-white shadow-[0_0_0_2px_rgba(179,36,44,.2)]'
                : 'border-black/12 bg-white/70 hover:bg-white'
            } ${isTaken ? 'cursor-not-allowed opacity-35' : ''}`}
          >
            <TokenIcon
              token={item.id}
              color={isTaken ? '#9a938a' : item.color}
              className="h-9 w-9"
              title={item.label}
            />
            <span className="font-condensed text-[10px] uppercase tracking-wide">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Les parties laissées en plan sur ce serveur. On reprend la sienne d'un clic,
 * sans avoir noté le code la semaine dernière.
 */
function ResumeList({ onResume }) {
  const [games, setGames] = useState([]);

  useEffect(() => {
    fetch('/api/games')
      .then((r) => r.json())
      .then((data) => setGames(data.games ?? []))
      .catch(() => setGames([]));
  }, []);

  if (!games.length) return null;

  const when = (at) => {
    if (!at) return '';
    const days = Math.floor((Date.now() - at) / 86400000);
    if (days === 0) return "aujourd'hui";
    if (days === 1) return 'hier';
    return `il y a ${days} jours`;
  };

  return (
    <div className="space-y-2">
      <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
        Reprendre une partie
      </p>
      {games.slice(0, 4).map((game) => (
        <button
          key={game.code}
          type="button"
          onClick={() => onResume(game)}
          className="flex w-full items-center gap-2 rounded border border-black/12 bg-white/70 px-3 py-2 text-left hover:bg-white"
        >
          <span className="tabular font-condensed text-lg tracking-[0.15em]">{game.code}</span>
          <span className="flex -space-x-1">
            {game.players.map((p) => (
              <TokenIcon key={p.id} token={p.token} color={p.color} className="h-5 w-5" title={p.name} />
            ))}
          </span>
          <span className="ml-auto text-right text-[11px] text-ink-soft">
            {game.players.map((p) => p.name).join(', ')}
            <br />
            tour {game.turnCount} · {when(game.lastPlayed)}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Home({ error }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState(rules.tokens[0].id);

  const create = () => socket.emit('game:create', { name, token });
  const join = () => socket.emit('game:join', { code: code.toUpperCase(), name, token });

  /** Reprendre une partie sauvegardée : on se remet dans la peau de sa joueuse. */
  const resume = (game) => {
    const known = game.players.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
    if (known) {
      socket.emit('game:rejoin', { code: game.code, playerIds: [known.id] });
    } else {
      setCode(game.code);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel w-full max-w-md space-y-5 rounded-xl p-7">
        <Logo />

        <label className="block font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
          Votre pseudo
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Julie"
            className="mt-1 w-full rounded border border-black/20 bg-white px-3 py-2 font-sans text-sm normal-case tracking-normal text-ink"
          />
        </label>

        <div className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
          Votre pion
          <div className="mt-1.5">
            <TokenPicker value={token} onChange={setToken} />
          </div>
        </div>

        <button
          type="button"
          disabled={!name.trim()}
          onClick={create}
          className="w-full rounded bg-[var(--color-accent)] py-2.5 font-condensed text-base uppercase tracking-wide text-white transition-colors hover:bg-[var(--color-accent-deep)] disabled:bg-black/15 disabled:text-black/40"
        >
          Créer une partie
        </button>

        <div className="flex items-center gap-2 font-condensed text-[10px] uppercase tracking-widest text-ink-soft">
          <span className="h-px flex-1 bg-black/15" />
          ou rejoindre
          <span className="h-px flex-1 bg-black/15" />
        </div>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="CODE"
            className="tabular w-full rounded border border-black/20 bg-white px-3 py-2 text-center font-condensed text-lg tracking-[0.4em]"
          />
          <button
            type="button"
            disabled={!name.trim() || code.length !== 6}
            onClick={join}
            className="shrink-0 rounded border border-black/15 bg-white px-4 font-condensed text-sm uppercase hover:bg-black/5 disabled:opacity-40"
          >
            Rejoindre
          </button>
        </div>

        <ResumeList onResume={resume} />

        <p className="text-center text-[11px] text-ink-soft">
          Une partie interrompue se retrouve ici : tapez votre pseudo puis cliquez dessus.
        </p>

        {error && <p className="text-center text-sm text-[var(--color-accent)]">{error}</p>}
      </div>
    </div>
  );
}

/** Formulaire d'ajout d'une joueuse supplémentaire sur ce même ordinateur. */
function AddLocalPlayer({ taken, onCancel }) {
  const free = rules.tokens.find((t) => !taken.includes(t.id));
  const [name, setName] = useState('');
  const [token, setToken] = useState(free?.id ?? rules.tokens[0].id);

  const add = () => {
    socket.emit('game:add-local', { name, token });
    setName('');
    onCancel();
  };

  return (
    <div className="space-y-3 rounded border border-black/12 bg-white/70 p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        placeholder="Pseudo de la joueuse"
        className="w-full rounded border border-black/20 bg-white px-3 py-2 text-sm"
        autoFocus
      />
      <TokenPicker value={token} onChange={setToken} taken={taken} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!name.trim() || taken.includes(token)}
          onClick={add}
          className="flex-1 rounded bg-[var(--color-accent)] py-2 font-condensed text-sm uppercase text-white hover:bg-[var(--color-accent-deep)] disabled:bg-black/15 disabled:text-black/40"
        >
          Ajouter
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-black/15 bg-white px-3 font-condensed text-sm uppercase hover:bg-black/5"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

/** Barre discrète en jeu : code, tour, et arrêt de la partie. */
export function GameMenu({ state, mine, onLeave, onShowRecap }) {
  const [confirming, setConfirming] = useState(false);

  if (!mine.length) return null;

  // Partie terminée : on ne propose plus que de revoir le compte ou de partir.
  if (state.phase === 'finished') {
    return (
      <div className="panel flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs">
        <span className="font-condensed uppercase text-[var(--color-accent)]">Partie terminée</span>
        <button
          type="button"
          onClick={onShowRecap}
          className="rounded border border-black/15 bg-white px-2 py-1 font-condensed uppercase hover:bg-black/5"
        >
          Revoir le compte final
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="ml-auto rounded bg-[var(--color-accent)] px-2 py-1 font-condensed uppercase text-white hover:bg-[var(--color-accent-deep)]"
        >
          Quitter et rejouer
        </button>
      </div>
    );
  }

  if (state.phase !== 'playing') return null;

  return (
    <div className="panel flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs">
      <span className="tabular font-condensed tracking-[0.15em]">{state.code}</span>
      <span className="text-ink-soft">tour {state.turnCount}</span>
      <span className="ml-auto text-ink-soft">
        La partie est sauvegardée : fermez tout, elle vous attendra.
      </span>
      {confirming ? (
          <span className="flex items-center gap-1.5">
            <span className="text-ink-soft">Tout le monde est d'accord ?</span>
            <button
              type="button"
              onClick={() => socket.emit('game:end')}
              className="rounded bg-[var(--color-accent)] px-2 py-1 font-condensed uppercase text-white hover:bg-[var(--color-accent-deep)]"
            >
              Oui, terminer
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded border border-black/15 bg-white px-2 py-1 font-condensed uppercase hover:bg-black/5"
            >
              Non
            </button>
          </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded border border-black/15 bg-white px-2 py-1 font-condensed uppercase hover:bg-black/5"
        >
          Terminer la partie
        </button>
      )}
    </div>
  );
}

export function WaitingRoom({ state, mine, onLeave }) {
  const localIds = new Set(mine.map((p) => p.id));
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const taken = state.players.map((p) => p.token);
  const full = state.players.length >= rules.playerCount.max;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* le code reste lisible à l'écran */
    }
  };

  const toggle = (key) => socket.emit('game:settings', { settings: { [key]: !state.settings[key] } });

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel w-full max-w-lg space-y-5 rounded-xl p-7">
        <Logo small />

        <div className="text-center">
          <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
            Code de la partie
          </p>
          <button
            onClick={copy}
            className="tabular mt-1 font-condensed text-5xl tracking-[0.25em] transition-opacity hover:opacity-70"
            title="Copier"
          >
            {state.code}
          </button>
          <p className="mt-1 text-[11px] text-ink-soft">
            {copied ? 'Copié !' : 'À dicter aux joueuses qui nous rejoignent à distance.'}
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
            Joueuses ({state.players.length}/{rules.playerCount.max})
          </p>
          {state.players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-2 rounded border border-black/10 bg-white/70 px-3 py-2"
            >
              <TokenIcon token={player.token} color={player.color} className="h-6 w-6" />
              <span className="font-condensed text-[15px] uppercase">{player.name}</span>
              {localIds.has(player.id) && (
                <span className="rounded bg-[var(--color-gold)]/20 px-1 font-condensed text-[10px] uppercase text-[#6b5216]">
                  sur cet écran
                </span>
              )}
              {localIds.has(player.id) && mine.length > 1 && (
                <button
                  onClick={() => socket.emit('game:remove-local', { playerId: player.id })}
                  className="ml-auto text-xs text-ink-soft hover:text-[var(--color-accent)]"
                  title="Retirer cette joueuse"
                >
                  ✕
                </button>
              )}
              {!player.connected && (
                <span className="ml-auto text-[10px] text-[var(--color-accent)]">absente</span>
              )}
            </div>
          ))}

          {adding ? (
            <AddLocalPlayer taken={taken} onCancel={() => setAdding(false)} />
          ) : (
            <button
              type="button"
              disabled={full}
              onClick={() => setAdding(true)}
              className="w-full rounded border border-dashed border-black/25 bg-white/40 py-2 font-condensed text-sm uppercase tracking-wide hover:bg-white/80 disabled:opacity-40"
            >
              {full ? 'Partie complète' : '+ Ajouter une joueuse sur cet ordinateur'}
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
            Règles maison
          </p>
          {[
            ['freeParkingPot', "Cagnotte sur le Parc Gratuit (les taxes s'y accumulent)"],
            ['auctionOnDecline', "Enchère quand une joueuse refuse d'acheter (règle officielle)"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={Boolean(state.settings[key])}
                onChange={() => toggle(key)}
                className="accent-[var(--color-accent)]"
              />
              {label}
            </label>
          ))}
        </div>

        {/* Tout le monde peut lancer : on se met d'accord de vive voix, la première
            qui a la souris clique. */}
        <button
          type="button"
          disabled={state.players.length < rules.playerCount.min}
          onClick={() => socket.emit('game:start')}
          className="w-full rounded bg-[var(--color-accent)] py-2.5 font-condensed text-base uppercase tracking-wide text-white transition-colors hover:bg-[var(--color-accent-deep)] disabled:bg-black/15 disabled:text-black/40"
        >
          {state.players.length < rules.playerCount.min
            ? `Il faut au moins ${rules.playerCount.min} joueuses`
            : 'Lancer la partie'}
        </button>
        <p className="text-center text-[11px] text-ink-soft">
          Quand tout le monde est là, n'importe qui peut lancer.
        </p>

        <button onClick={onLeave} className="w-full text-center text-xs text-ink-soft hover:text-ink">
          Quitter
        </button>
      </div>
    </div>
  );
}
