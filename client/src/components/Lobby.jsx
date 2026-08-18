/** Accueil (créer / rejoindre) puis salon d'attente avec le code à partager. */
import { useState } from 'react';
import { socket } from '../lib/socket.js';
import rules from '../../../shared/data/rules.json';
import TokenIcon from './TokenIcon.jsx';

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

export function Home({ error }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState(rules.tokens[0].id);

  const create = () => socket.emit('game:create', { name, token });
  const join = () => socket.emit('game:join', { code: code.toUpperCase(), name, token });

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

export function WaitingRoom({ state, mine, onLeave }) {
  const localIds = new Set(mine.map((p) => p.id));
  const isHost = localIds.has(state.hostId);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const taken = state.players.map((p) => p.token);
  const full = state.players.length >= rules.maxPlayers;

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
            Joueuses ({state.players.length}/{rules.maxPlayers})
          </p>
          {state.players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-2 rounded border border-black/10 bg-white/70 px-3 py-2"
            >
              <TokenIcon token={player.token} color={player.color} className="h-6 w-6" />
              <span className="font-condensed text-[15px] uppercase">{player.name}</span>
              {player.id === state.hostId && (
                <span className="font-condensed text-[10px] uppercase tracking-widest text-[var(--color-accent)]">
                  hôte
                </span>
              )}
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
                disabled={!isHost}
                onChange={() => toggle(key)}
                className="accent-[var(--color-accent)]"
              />
              {label}
            </label>
          ))}
        </div>

        {isHost ? (
          <button
            type="button"
            disabled={state.players.length < rules.minPlayers}
            onClick={() => socket.emit('game:start')}
            className="w-full rounded bg-[var(--color-accent)] py-2.5 font-condensed text-base uppercase tracking-wide text-white transition-colors hover:bg-[var(--color-accent-deep)] disabled:bg-black/15 disabled:text-black/40"
          >
            {state.players.length < rules.minPlayers
              ? `Il faut au moins ${rules.minPlayers} joueuses`
              : 'Lancer la partie'}
          </button>
        ) : (
          <p className="text-center text-sm text-ink-soft">En attente que l'hôte lance la partie…</p>
        )}

        <button onClick={onLeave} className="w-full text-center text-xs text-ink-soft hover:text-ink">
          Quitter
        </button>
      </div>
    </div>
  );
}
