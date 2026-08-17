/** Accueil (créer / rejoindre) puis salon d'attente avec le code à partager. */
import { useState } from 'react';
import { socket } from '../lib/socket.js';
import rules from '../../../shared/data/rules.json';

function Logo() {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
        <rect
          x="16"
          y="16"
          width="32"
          height="32"
          transform="rotate(45 32 32)"
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="1.5"
        />
        <text
          x="32"
          y="42"
          textAnchor="middle"
          fontFamily="Cormorant Garamond, serif"
          fontSize="30"
          fill="var(--color-gold-soft)"
        >
          M
        </text>
      </svg>
      <h1 className="font-display text-4xl tracking-[0.35em] text-gold-soft">MONOPOLY</h1>
      <p className="text-[11px] uppercase tracking-[0.5em] text-muted">Paris</p>
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
      <div className="gilt w-full max-w-md space-y-6 rounded-xl bg-night-soft/80 p-8">
        <Logo />

        <div className="space-y-3">
          <label className="block text-xs uppercase tracking-widest text-muted">
            Votre pseudo
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="Julie"
              className="mt-1 w-full rounded-md border border-white/10 bg-night px-3 py-2 text-sm normal-case tracking-normal text-parchment"
            />
          </label>

          <div className="text-xs uppercase tracking-widest text-muted">
            Votre pion
            <div className="mt-1.5 flex flex-wrap gap-2">
              {rules.tokens.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setToken(item.id)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] normal-case tracking-normal transition-colors ${
                    token === item.id ? 'bg-white/15 ring-1 ring-gold/60' : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}` }}
                  />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            disabled={!name.trim()}
            onClick={create}
            className="w-full rounded-md bg-gold/90 py-2.5 font-medium text-night transition-colors hover:bg-gold-soft disabled:bg-gold/30"
          >
            Créer une partie
          </button>

          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-white/10" />
            ou
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="CODE"
              className="tabular w-full rounded-md border border-white/10 bg-night px-3 py-2 text-center text-lg tracking-[0.4em]"
            />
            <button
              type="button"
              disabled={!name.trim() || code.length !== 6}
              onClick={join}
              className="shrink-0 rounded-md bg-white/10 px-4 text-sm hover:bg-white/20 disabled:opacity-40"
            >
              Rejoindre
            </button>
          </div>
        </div>

        {error && <p className="text-center text-sm text-rose-300">{error}</p>}
      </div>
    </div>
  );
}

export function WaitingRoom({ state, me, onLeave }) {
  const isHost = state.hostId === me?.id;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* le code reste lisible à l'écran */
    }
  };

  const toggle = (key) =>
    socket.emit('game:settings', { settings: { [key]: !state.settings[key] } });

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="gilt w-full max-w-lg space-y-6 rounded-xl bg-night-soft/80 p-8">
        <Logo />

        <div className="text-center">
          <p className="text-[11px] uppercase tracking-widest text-muted">Code de la partie</p>
          <button
            onClick={copy}
            className="tabular mt-1 font-display text-5xl tracking-[0.3em] text-gold-soft transition-opacity hover:opacity-80"
            title="Copier"
          >
            {state.code}
          </button>
          <p className="mt-1 text-[11px] text-muted">
            {copied ? 'Copié !' : 'Cliquez pour copier, puis partagez-le à vos amies.'}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">
            Joueuses ({state.players.length}/{rules.maxPlayers})
          </p>
          {state.players.map((player) => (
            <div key={player.id} className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: player.color, boxShadow: `0 0 8px ${player.color}` }}
              />
              <span>{player.name}</span>
              {player.id === state.hostId && (
                <span className="text-[10px] uppercase tracking-widest text-gold-soft">hôte</span>
              )}
              {player.id === me?.id && <span className="text-[10px] text-muted">(vous)</span>}
              {!player.connected && <span className="ml-auto text-[10px] text-rose-300">absente</span>}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">Règles maison</p>
          {[
            ['freeParkingPot', 'Cagnotte sur le Parc Gratuit (les taxes s\'y accumulent)'],
            ['auctionOnDecline', 'Enchère quand une joueuse refuse d\'acheter (règle officielle)'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-xs text-parchment/85">
              <input
                type="checkbox"
                checked={Boolean(state.settings[key])}
                disabled={!isHost}
                onChange={() => toggle(key)}
                className="accent-[var(--color-gold)]"
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
            className="w-full rounded-md bg-gold/90 py-2.5 font-medium text-night transition-colors hover:bg-gold-soft disabled:bg-gold/30"
          >
            {state.players.length < rules.minPlayers
              ? `Il faut au moins ${rules.minPlayers} joueuses`
              : 'Lancer la partie'}
          </button>
        ) : (
          <p className="text-center text-sm text-muted">
            En attente que l'hôte lance la partie…
          </p>
        )}

        <button onClick={onLeave} className="w-full text-center text-xs text-muted hover:text-parchment">
          Quitter
        </button>
      </div>
    </div>
  );
}
