/**
 * Les règles, consultables à tout moment.
 *
 * Le texte n'est pas écrit à la main édition par édition : il est **déduit de la
 * configuration**, dans la langue de la partie. Une boîte qui n'a pas
 * d'hypothèque ne verra pas le paragraphe sur l'hypothèque, et une boîte à
 * points de maison parlera de points. Ajouter une édition, c'est donc aussi
 * obtenir ses règles, sans rien rédiger.
 */
import { useState } from 'react';
import { editionFor, money, buildingLabels, localeOf } from '../lib/board.js';
import { useT } from '../lib/i18n.js';
import { rulesText } from '../lib/rulesText.jsx';

function Section({ title, children }) {
  return (
    <section className="space-y-1.5">
      <h3 className="font-condensed text-[12px] uppercase tracking-[0.2em] text-[var(--color-accent)]">
        {title}
      </h3>
      <div className="space-y-1 text-[13px] leading-relaxed">{children}</div>
    </section>
  );
}

function Line({ children }) {
  return <p>{children}</p>;
}

/** Tout ce dont les phrases ont besoin, extrait une fois de la configuration. */
function contextOf(state) {
  const edition = editionFor(state);
  const labels = buildingLabels(state);
  const locale = localeOf(state);
  const isPoints = edition.currency.type === 'points';
  const decks = Object.values(edition.theming.decks ?? {});

  return {
    explore: Boolean(edition.mechanics.explorationMode),
    auctions: Boolean(edition.mechanics.auctions),
    eliminates: Boolean(edition.mechanics.bankruptcyEliminates),
    diceCount: edition.dice.count,
    doublesToJail: edition.dice.doublesToJail,
    maxTurns: edition.jail.maxTurns,
    bail: money(state, edition.jail.bail),
    goBonus: money(state, edition.currency.goBonus),
    start: money(state, edition.currency.startingAmount),
    interest: Math.round(edition.mortgage.interestRate * 100),
    unit: isPoints
      ? locale === 'en'
        ? 'house points'
        : 'points de maison'
      : locale === 'en'
        ? 'money'
        : 'monnaie',
    rentWord:
      edition.vocabulary?.rent?.toLowerCase() ?? (locale === 'en' ? 'rent' : 'loyer'),
    jailWord:
      edition.vocabulary?.jail?.toLowerCase() ?? (locale === 'en' ? 'jail' : 'prison'),
    buildingLower: labels.house.toLowerCase(),
    buildingsLower: labels.houses.toLowerCase(),
    hotelLower: labels.hotel.toLowerCase(),
    deckCount: decks.length,
    deckNames: decks.map((d) => d.label).join(locale === 'en' ? ' and ' : ' et '),
    factionList: edition.factions?.options.map((f) => f.label).join(', ') ?? '',
  };
}

export function RulesContent({ state }) {
  const edition = editionFor(state);
  const m = edition.mechanics;
  const labels = buildingLabels(state);
  const r = rulesText(localeOf(state));
  const c = contextOf(state);

  return (
    <div className="space-y-5">
      <header>
        <p className="font-condensed text-xl uppercase tracking-[0.15em]">{edition.name}</p>
        <p className="text-[12px] text-ink-soft">{edition.theme}</p>
      </header>

      <Section title={r.goalTitle}>
        <Line>
          {edition.winCondition === 'allLocationsExplored' ? r.goalExplore(c) : r.goalLast(c)}
        </Line>
      </Section>

      <Section title={r.turnTitle}>
        <Line>{r.turnDice(c)}</Line>
        <Line>{r.turnGo(c)}</Line>
      </Section>

      <Section title={r.buyTitle(c)}>
        <Line>{r.buyMain(c)}</Line>
        <Line>{r.buyRent(c)}</Line>
        {/* Le privilège n'existe que si l'édition rattache un fief à un camp :
            le plateau de certaines boîtes n'a pas de salle commune. */}
        {edition.factions?.options.some((f) => f.homeSpace != null) && <Line>{r.buyHome(c)}</Line>}
      </Section>

      {edition.factions && (
        <Section title={edition.factions.label}>
          <Line>{r.factionMain(c)}</Line>
        </Section>
      )}

      {m.houses && (
        <Section title={labels.houses}>
          <Line>{r.buildMain(c)}</Line>
          <Line>{m.hotels ? r.buildHotel(c) : r.buildCap(c)}</Line>
        </Section>
      )}

      {m.mortgage && (
        <Section title={r.mortgageTitle}>
          <Line>{r.mortgageMain(c)}</Line>
          <Line>{r.mortgageHint(c)}</Line>
        </Section>
      )}

      <Section title={edition.vocabulary?.jail ?? (localeOf(state) === 'en' ? 'Jail' : 'La prison')}>
        <Line>{r.jailMain(c)}</Line>
      </Section>

      <Section title={r.cardsTitle(c)}>
        <Line>{r.cardsMain(c)}</Line>
      </Section>

      {m.trading && (
        <Section title={r.tradeTitle}>
          <Line>{r.tradeMain(c)}</Line>
          {m.negotiableRent && <Line>{r.tradeRent(c)}</Line>}
        </Section>
      )}

      <Section title={r.brokeTitle(c)}>
        <Line>{c.eliminates ? r.brokeEliminates(c) : r.brokeSurvives(c)}</Line>
      </Section>

      <Section title={r.devicesTitle}>
        <Line>{r.devicesMain(c)}</Line>
      </Section>
    </div>
  );
}

/** Le bouton « Règles » et sa fenêtre. */
export default function Rules({ state }) {
  const [open, setOpen] = useState(false);
  const t = useT(state);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-black/15 bg-white px-2 py-1 font-condensed text-xs uppercase hover:bg-black/5"
      >
        {t('rules')}
      </button>

      {open && (
        <div
          className="fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="panel my-auto w-full max-w-2xl rounded-xl p-5 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="font-condensed text-xl uppercase tracking-[0.2em]">{t('theRules')}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded border border-black/15 bg-white px-2 py-1 text-ink-soft hover:text-ink"
                aria-label={t('close')}
              >
                ✕
              </button>
            </div>
            <RulesContent state={state} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded bg-[var(--color-accent)] py-2.5 font-condensed text-sm uppercase text-white hover:bg-[var(--color-accent-deep)]"
            >
              {t('understood')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
