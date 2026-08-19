/** Accueil (créer / rejoindre) puis salon d'attente avec le code à partager. */
import { useEffect, useState } from 'react';
import { socket } from '../lib/socket.js';
import { getEdition, listEditions, DEFAULT_EDITION, DEFAULT_LOCALE, LOCALES } from '../lib/board.js';
import { translator } from '../lib/i18n.js';
import TokenIcon from './TokenIcon.jsx';
import Rules from './Rules.jsx';
import Calculator from './Calculator.jsx';

/**
 * Le bandeau titre prend les couleurs de l'édition choisie : on voit à quoi on
 * s'apprête à jouer avant même d'avoir lu le nom.
 */
function Logo({ edition, small = false }) {
  const accent = edition?.theming?.decks?.chance?.color ?? 'var(--color-accent)';
  return (
    <div className="flex flex-col items-center">
      <div
        className="border-y-[3px] border-ink px-6 py-1.5 shadow-[0_3px_0_rgba(0,0,0,.3)]"
        style={{ backgroundColor: accent }}
      >
        <p
          className={`font-condensed uppercase tracking-[0.18em] text-[#f7f4ea] ${
            small ? 'text-2xl' : 'text-4xl'
          }`}
        >
          {edition?.theming?.centerTitle ?? 'Monopoly'}
        </p>
      </div>
      <p className="mt-1.5 font-condensed text-[11px] uppercase tracking-[0.5em] text-ink-soft">
        {edition?.theming?.centerSubtitle ?? 'Paris'}
      </p>
    </div>
  );
}

/**
 * La galerie : une carte par édition, avec ce qui change vraiment d'une boîte à
 * l'autre. On choisit sa boîte avant de créer la partie, comme on la sort de
 * l'étagère.
 */
function EditionGallery({ value, onChange, locale, t }) {
  const editions = listEditions(locale);
  if (editions.length < 2) return null;

  return (
    <div className="space-y-2">
      <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
        {t('whichBox')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {editions.map((edition) => {
          const selected = edition.id === value;
          const accent = edition.theming?.decks?.chance?.color ?? '#b3242c';
          return (
            <button
              key={edition.id}
              type="button"
              onClick={() => onChange(edition.id)}
              className={`flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-all ${
                selected
                  ? 'border-ink bg-white shadow-[0_2px_0_rgba(0,0,0,.25)]'
                  : 'border-black/12 bg-white/60 hover:bg-white'
              }`}
            >
              <span className="flex w-full items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-black/25 font-condensed text-[13px] text-white"
                  style={{ backgroundColor: accent }}
                >
                  {edition.theming?.decks?.chance?.glyph ?? '?'}
                </span>
                <span className="font-condensed text-[15px] uppercase leading-tight">
                  {edition.name}
                </span>
              </span>
              <span className="text-[11px] text-ink-soft">{edition.theme}</span>
              <span className="text-[11px] leading-snug">{edition.summary}</span>
              <span className="mt-0.5 font-condensed text-[10px] uppercase tracking-wide text-ink-soft">
                {edition.playerCount.min}–{edition.playerCount.max} · {edition.boardSize}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Le choix de la langue : la boîte se joue en français ou en anglais. */
function LocalePicker({ value, onChange, t }) {
  const LABELS = { fr: 'Français', en: 'English' };
  return (
    <div className="space-y-1.5">
      <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
        {t('language')}
      </p>
      <div className="flex gap-2">
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            className={`flex-1 rounded border-2 py-2 font-condensed text-sm uppercase tracking-wide transition-all ${
              value === code
                ? 'border-ink bg-white'
                : 'border-black/12 bg-white/60 hover:bg-white'
            }`}
          >
            {LABELS[code]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Le rappel de ce qui distingue cette édition, pour celles qui rejoignent. */
function EditionBriefing({ edition }) {
  const m = edition.mechanics;
  const points = [
    `Monnaie : ${edition.currency.label} — ${edition.currency.startingAmount} au départ, ${edition.currency.goBonus} par tour de plateau.`,
    edition.buildingLabels
      ? `Constructions : ${edition.buildingLabels.houses.toLowerCase()} et ${edition.buildingLabels.hotels.toLowerCase()}.`
      : null,
    m.mortgage ? "L'hypothèque est autorisée." : "Pas d'hypothèque dans cette édition.",
    m.auctions ? "Refuser d'acheter met la case aux enchères." : null,
    `Piles : ${Object.values(edition.theming.decks).map((d) => d.label).join(' et ')}.`,
  ].filter(Boolean);

  return (
    <div className="rounded border border-black/12 bg-white/60 p-3">
      <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
        {edition.name}
      </p>
      <p className="mb-1.5 text-[11px] text-ink-soft">{edition.theme}</p>
      <ul className="space-y-0.5 text-[11px] leading-snug">
        {points.map((point) => (
          <li key={point}>· {point}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Choix du camp, quand l'édition en propose un : les maisons de Poudlard.
 * Contrairement aux pions, plusieurs joueuses peuvent partager une maison.
 */
function FactionPicker({ edition, value, onChange }) {
  const factions = edition.factions;
  if (!factions) return null;

  return (
    <div className="space-y-1.5">
      <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
        {factions.prompt ?? factions.label}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {factions.options.map((faction) => {
          const selected = value === faction.id;
          return (
            <button
              key={faction.id}
              type="button"
              onClick={() => onChange(faction.id)}
              className={`flex flex-col items-center gap-1 rounded border-2 px-2 py-2 transition-all ${
                selected ? 'border-ink bg-white' : 'border-black/12 bg-white/60 hover:bg-white'
              }`}
            >
              <span
                className="h-7 w-7 rounded-full border-2 border-black/25"
                style={{ backgroundColor: faction.color }}
              />
              <span className="font-condensed text-[10px] uppercase leading-tight">{faction.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Choix du pion : un seul par personne, les pions déjà pris sont barrés.
 */
function TokenPicker({ edition, value, onChange, taken = [] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {edition.tokens.map((item) => {
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
function ResumeList({ t, locale }) {
  // `null` = jamais chargé, `[]` = chargé mais vide : les deux ont un rendu
  // différent, pour ne pas laisser croire qu'un chargement raté est une liste
  // vide. On expose un onglet à cliquer plutôt qu'un chargement automatique et
  // silencieux : sans lui, une partie introuvable ne laissait paraître
  // strictement rien à l'écran, pas même une erreur.
  const [expanded, setExpanded] = useState(false);
  const [games, setGames] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openCode, setOpenCode] = useState(null);
  const [picked, setPicked] = useState([]);

  const load = () => {
    setLoading(true);
    fetch('/api/games')
      .then((r) => r.json())
      .then((data) => setGames(data.games ?? []))
      .catch(() => setGames([]))
      .finally(() => setLoading(false));
  };

  // On relit la liste à chaque ouverture de l'onglet : une partie quittée il y
  // a cinq minutes doit apparaître tout de suite.
  useEffect(() => {
    if (expanded) load();
  }, [expanded]);

  const when = (at) => {
    if (!at) return '';
    const days = Math.floor((Date.now() - at) / 86400000);
    if (locale === 'en') {
      if (days === 0) return 'today';
      if (days === 1) return 'yesterday';
      return `${days} days ago`;
    }
    if (days === 0) return "aujourd'hui";
    if (days === 1) return 'hier';
    return `il y a ${days} jours`;
  };

  const open = (code) => {
    setOpenCode(code === openCode ? null : code);
    setPicked([]);
  };

  const toggle = (playerId) =>
    setPicked((list) =>
      list.includes(playerId) ? list.filter((id) => id !== playerId) : [...list, playerId],
    );

  const rejoin = (code) => socket.emit('game:rejoin', { code, playerIds: picked });

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded border border-black/15 bg-white/70 px-3 py-2 font-condensed text-[11px] uppercase tracking-widest text-ink-soft hover:bg-white"
        aria-expanded={expanded}
      >
        {t('resumeGame')}
        <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-condensed text-[10px] uppercase tracking-widest text-ink-soft">
              {t('seeGamesInProgress')}
            </p>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded border border-black/15 bg-white px-2 py-0.5 font-condensed text-[10px] uppercase hover:bg-black/5 disabled:opacity-50"
            >
              {t('refresh')}
            </button>
          </div>

          {loading && games === null && (
            <p className="text-[11px] text-ink-soft">{t('loadingGames')}</p>
          )}

          {games !== null && !games.length && (
            <div className="space-y-1 rounded border border-black/12 bg-white/70 px-3 py-2.5">
              <p className="text-[11px] text-ink-soft">{t('noGamesFound')}</p>
              <p className="text-[10px] text-ink-soft">{t('noGamesHint')}</p>
            </div>
          )}

          {games?.slice(0, 6).map((game) => {
          const isOpen = game.code === openCode;
          return (
            <div key={game.code} className="overflow-hidden rounded border border-black/12 bg-white/70">
              <button
                type="button"
                onClick={() => open(game.code)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white"
              >
                <span className="tabular font-condensed text-lg tracking-[0.15em]">{game.code}</span>
                <span className="flex -space-x-1">
                  {game.players.map((p) => (
                    <TokenIcon
                      key={p.id}
                      token={p.token}
                      color={p.color}
                      className="h-5 w-5"
                      title={p.name}
                    />
                  ))}
                </span>
                <span className="ml-auto text-right text-[11px] leading-tight text-ink-soft">
                  {getEdition(game.editionId, game.locale).name}
                  <br />
                  {t('turn')} {game.turnCount} · {when(game.lastPlayed)}
                </span>
              </button>

              {/* On reprend sa place en se désignant : ni pseudo à retaper, ni code
                  à retrouver, et ça marche depuis un téléphone qui n'a jamais joué. */}
              {isOpen && (
                <div className="space-y-2 border-t border-black/10 px-3 py-2.5">
                  <p className="text-[11px] text-ink-soft">
                    {t('whoResumes')}
                  </p>
                  <div className="space-y-1">
                    {game.players.map((player) => {
                      const selected = picked.includes(player.id);
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => toggle(player.id)}
                          className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors ${
                            selected
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                              : 'border-black/10 bg-white hover:bg-black/5'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] leading-none text-white ${
                              selected ? 'border-[var(--color-accent)] bg-[var(--color-accent)]' : 'border-black/25'
                            }`}
                          >
                            {selected ? '✓' : ''}
                          </span>
                          <TokenIcon token={player.token} color={player.color} className="h-5 w-5" />
                          <span className="font-condensed text-sm uppercase">{player.name}</span>
                          {player.bankrupt && (
                            <span className="text-[10px] text-ink-soft">{t('eliminated')}</span>
                          )}
                          {player.connected && !player.bankrupt && (
                            <span className="ml-auto text-[10px] text-[var(--color-money)]">
                              {t('alreadyBack')}
                            </span>
                          )}
                        </button>
                      );
                  })}
                </div>
                <button
                  type="button"
                  disabled={!picked.length}
                  onClick={() => rejoin(game.code)}
                  className="w-full rounded bg-[var(--color-accent)] py-2 font-condensed text-sm uppercase text-white hover:bg-[var(--color-accent-deep)] disabled:bg-black/15 disabled:text-black/40"
                >
                  {picked.length > 1 ? t('resumeSeveral', picked.length) : t('resumeMine')}
                </button>
              </div>
            )}
          </div>
        );
          })}
        </div>
      )}
    </div>
  );
}

export function Home({ error }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [locale, setLocale] = useState(DEFAULT_LOCALE);
  const [editionId, setEditionId] = useState(DEFAULT_EDITION);
  const edition = getEdition(editionId, locale);
  const t = translator(locale);
  const [token, setToken] = useState(edition.tokens[0].id);
  const [faction, setFaction] = useState(edition.factions?.options[0].id ?? null);

  // Changer d'édition change la boîte de pions et les camps : on reprend les
  // premiers de la nouvelle plutôt que de garder des choix qui n'existent pas ici.
  const chooseEdition = (id) => {
    const next = getEdition(id, locale);
    setEditionId(id);
    setToken(next.tokens[0].id);
    setFaction(next.factions?.options[0].id ?? null);
  };

  const create = () => socket.emit('game:create', { name, token, editionId, faction, locale });
  const join = () => socket.emit('game:join', { code: code.toUpperCase(), name, token, faction });

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel w-full max-w-lg space-y-5 rounded-xl p-7">
        <Logo edition={edition} />

        <label className="block font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
          {t('yourName')}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder={t('namePlaceholder')}
            className="mt-1 w-full rounded border border-black/20 bg-white px-3 py-2 font-sans text-sm normal-case tracking-normal text-ink"
          />
        </label>

        <LocalePicker value={locale} onChange={setLocale} t={t} />

        <EditionGallery value={editionId} onChange={chooseEdition} locale={locale} t={t} />

        <FactionPicker edition={edition} value={faction} onChange={setFaction} />

        <div className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
          {t('yourToken')}
          <div className="mt-1.5">
            <TokenPicker edition={edition} value={token} onChange={setToken} />
          </div>
        </div>

        <button
          type="button"
          disabled={!name.trim()}
          onClick={create}
          className="w-full rounded bg-[var(--color-accent)] py-2.5 font-condensed text-base uppercase tracking-wide text-white transition-colors hover:bg-[var(--color-accent-deep)] disabled:bg-black/15 disabled:text-black/40"
        >
          {t('createGame')} — {edition.name}
        </button>

        <div className="flex items-center gap-2 font-condensed text-[10px] uppercase tracking-widest text-ink-soft">
          <span className="h-px flex-1 bg-black/15" />
          {t('orJoin')}
          <span className="h-px flex-1 bg-black/15" />
        </div>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder={t("code")}
            className="tabular w-full rounded border border-black/20 bg-white px-3 py-2 text-center font-condensed text-lg tracking-[0.4em]"
          />
          <button
            type="button"
            disabled={!name.trim() || code.length !== 6}
            onClick={join}
            className="shrink-0 rounded border border-black/15 bg-white px-4 font-condensed text-sm uppercase hover:bg-black/5 disabled:opacity-40"
          >
            {t('join')}
          </button>
        </div>

        <ResumeList t={t} locale={locale} />

        <p className="text-center text-[11px] text-ink-soft">{t('resumeHint')}</p>

        {error && <p className="text-center text-sm text-[var(--color-accent)]">{error}</p>}
      </div>
    </div>
  );
}

/** Formulaire d'ajout d'une joueuse supplémentaire sur ce même ordinateur. */
function AddLocalPlayer({ t, edition, taken, takenFactions = [], onCancel }) {
  const free = edition.tokens.find((t) => !taken.includes(t.id));
  const [name, setName] = useState('');
  const [token, setToken] = useState(free?.id ?? edition.tokens[0].id);
  // On propose d'emblée une maison encore libre : quatre cartes de maison pour
  // quatre joueuses, autant ne pas les faire toutes atterrir à Gryffondor.
  const [faction, setFaction] = useState(
    edition.factions?.options.find((f) => !takenFactions.includes(f.id))?.id ??
      edition.factions?.options[0].id ??
      null,
  );

  const add = () => {
    socket.emit('game:add-local', { name, token, faction });
    setName('');
    onCancel();
  };

  return (
    <div className="space-y-3 rounded border border-black/12 bg-white/70 p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        placeholder={t("localName")}
        className="w-full rounded border border-black/20 bg-white px-3 py-2 text-sm"
        autoFocus
      />
      <TokenPicker edition={edition} value={token} onChange={setToken} taken={taken} />
      <FactionPicker edition={edition} value={faction} onChange={setFaction} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!name.trim() || taken.includes(token)}
          onClick={add}
          className="flex-1 rounded bg-[var(--color-accent)] py-2 font-condensed text-sm uppercase text-white hover:bg-[var(--color-accent-deep)] disabled:bg-black/15 disabled:text-black/40"
        >
          {t('add')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-black/15 bg-white px-3 font-condensed text-sm uppercase hover:bg-black/5"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}

/** Barre discrète en jeu : code, tour, et arrêt de la partie. */
export function GameMenu({ state, mine, onLeave, onShowRecap }) {
  const [confirming, setConfirming] = useState(false);
  const t = translator(state.locale);

  if (!mine.length) return null;

  // Partie terminée : on ne propose plus que de revoir le compte ou de partir.
  if (state.phase === 'finished') {
    return (
      <div className="panel flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs">
        <span className="font-condensed uppercase text-[var(--color-accent)]">{t('gameOver')}</span>
        <button
          type="button"
          onClick={onShowRecap}
          className="rounded border border-black/15 bg-white px-2 py-1 font-condensed uppercase hover:bg-black/5"
        >
          {t('seeRecap')}
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="ml-auto rounded bg-[var(--color-accent)] px-2 py-1 font-condensed uppercase text-white hover:bg-[var(--color-accent-deep)]"
        >
          {t('quitAndReplay')}
        </button>
      </div>
    );
  }

  if (state.phase !== 'playing') return null;

  return (
    <div className="panel flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs">
      <span className="tabular font-condensed tracking-[0.15em]">{state.code}</span>
      <span className="text-ink-soft">{t('turn')} {state.turnCount}</span>
      <Rules state={state} />
      <Calculator state={state} />
      <span className="ml-auto text-ink-soft">
        {t('saved')}
      </span>
      {confirming ? (
          <span className="flex items-center gap-1.5">
            <span className="text-ink-soft">{t('agreed')}</span>
            <button
              type="button"
              onClick={() => socket.emit('game:end')}
              className="rounded bg-[var(--color-accent)] px-2 py-1 font-condensed uppercase text-white hover:bg-[var(--color-accent-deep)]"
            >
              {t('yesEnd')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded border border-black/15 bg-white px-2 py-1 font-condensed uppercase hover:bg-black/5"
            >
              {t('no')}
            </button>
          </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded border border-black/15 bg-white px-2 py-1 font-condensed uppercase hover:bg-black/5"
        >
          {t('endGame')}
        </button>
      )}
    </div>
  );
}

export function WaitingRoom({ state, mine, onLeave }) {
  const edition = getEdition(state.editionId, state.locale);
  const t = translator(state.locale);
  const localIds = new Set(mine.map((p) => p.id));
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const taken = state.players.map((p) => p.token);
  const full = state.players.length >= edition.playerCount.max;

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
        <Logo edition={edition} small />

        <div className="text-center">
          <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
            {t('gameCode')}
          </p>
          <button
            onClick={copy}
            className="tabular mt-1 font-condensed text-5xl tracking-[0.25em] transition-opacity hover:opacity-70"
            title="Copier"
          >
            {state.code}
          </button>
          <p className="mt-1 text-[11px] text-ink-soft">
            {copied ? t('copied') : t('dictate')}
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
            {t('players')} ({state.players.length}/{edition.playerCount.max})
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
                  {t('onThisScreen')}
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
                <span className="ml-auto text-[10px] text-[var(--color-accent)]">{t('away')}</span>
              )}
            </div>
          ))}

          {adding ? (
            <AddLocalPlayer
              t={t}
              edition={edition}
              taken={taken}
              takenFactions={state.players.map((p) => p.faction)}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              type="button"
              disabled={full}
              onClick={() => setAdding(true)}
              className="w-full rounded border border-dashed border-black/25 bg-white/40 py-2 font-condensed text-sm uppercase tracking-wide hover:bg-white/80 disabled:opacity-40"
            >
              {full ? t('gameFull') : t('addLocal')}
            </button>
          )}
        </div>

        {/* Celles qui arrivent à distance découvrent l'édition choisie ici. */}
        <EditionBriefing edition={edition} />
        <div className="flex justify-center">
          <Rules state={state} />
        </div>

        <div className="space-y-1.5">
          <p className="font-condensed text-[11px] uppercase tracking-widest text-ink-soft">
            {t('houseRules')}
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
          disabled={state.players.length < edition.playerCount.min}
          onClick={() => socket.emit('game:start')}
          className="w-full rounded bg-[var(--color-accent)] py-2.5 font-condensed text-base uppercase tracking-wide text-white transition-colors hover:bg-[var(--color-accent-deep)] disabled:bg-black/15 disabled:text-black/40"
        >
          {state.players.length < edition.playerCount.min
            ? t('needPlayers', edition.playerCount.min)
            : t('startGame')}
        </button>
        <p className="text-center text-[11px] text-ink-soft">
          {t('anyoneStarts')}
        </p>

        <button onClick={onLeave} className="w-full text-center text-xs text-ink-soft hover:text-ink">
          {t('leave')}
        </button>
      </div>
    </div>
  );
}
