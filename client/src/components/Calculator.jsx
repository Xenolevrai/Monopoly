/**
 * Une calculatrice de table, pour évaluer un coup sans l'engager.
 *
 * « Si j'hypothèque ces deux terrains et que je revends une maison, j'ai
 * combien ? » — plutôt que de sortir son téléphone, la réponse est à portée de
 * clic, dans la monnaie de la partie. Elle ne touche à rien : aucune action
 * n'est envoyée au serveur, c'est un simple bloc de calcul mental partagé.
 */
import { useState } from 'react';
import { editionFor, localeOf } from '../lib/board.js';
import { useT } from '../lib/i18n.js';

const MAX_DIGITS = 12;

function formatNumber(raw, locale) {
  if (raw === 'Erreur' || raw === 'Error') return raw;
  const [intPart, decPart] = raw.replace('-', '').split('.');
  const sign = raw.startsWith('-') ? '-' : '';
  const grouped = Number(intPart || '0').toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR');
  return sign + grouped + (decPart !== undefined ? `${locale === 'en' ? '.' : ','}${decPart}` : '');
}

function compute(a, operator, b) {
  switch (operator) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

const initial = { display: '0', stored: null, operator: null, resetOnDigit: false };

function reducer(state, action) {
  const { display, stored, operator, resetOnDigit } = state;

  if (action.type === 'digit') {
    if (display === 'Erreur') return { ...initial, display: action.value === '.' ? '0.' : action.value };
    if (resetOnDigit) return { ...state, display: action.value === '.' ? '0.' : action.value, resetOnDigit: false };
    if (action.value === '.' && display.includes('.')) return state;
    if (display.replace(/[-.]/g, '').length >= MAX_DIGITS) return state;
    const next = display === '0' && action.value !== '.' ? action.value : display + action.value;
    return { ...state, display: next };
  }

  if (action.type === 'clear') return initial;

  if (action.type === 'backspace') {
    if (display === 'Erreur' || resetOnDigit) return { ...initial };
    const next = display.length > 1 ? display.slice(0, -1) : '0';
    return { ...state, display: next === '-' ? '0' : next };
  }

  if (action.type === 'sign') {
    if (display === '0' || display === 'Erreur') return state;
    return { ...state, display: display.startsWith('-') ? display.slice(1) : `-${display}` };
  }

  if (action.type === 'percent') {
    const value = parseFloat(display) / 100;
    return { ...state, display: String(value) };
  }

  if (action.type === 'operator') {
    const value = parseFloat(display);
    if (operator && !resetOnDigit) {
      const result = compute(stored, operator, value);
      if (!Number.isFinite(result)) return { ...initial, display: 'Erreur' };
      return { display: String(result), stored: result, operator: action.value, resetOnDigit: true };
    }
    return { display, stored: value, operator: action.value, resetOnDigit: true };
  }

  if (action.type === 'equals') {
    if (!operator) return state;
    const result = compute(stored, operator, parseFloat(display));
    if (!Number.isFinite(result)) return { ...initial, display: 'Erreur' };
    return { display: String(result), stored: null, operator: null, resetOnDigit: true };
  }

  return state;
}

const KEY_ROWS = [
  [{ k: 'clear', label: 'C' }, { k: 'sign', label: '±' }, { k: 'percent', label: '%' }, { k: 'operator', v: '÷', label: '÷' }],
  [{ k: 'digit', v: '7' }, { k: 'digit', v: '8' }, { k: 'digit', v: '9' }, { k: 'operator', v: '×', label: '×' }],
  [{ k: 'digit', v: '4' }, { k: 'digit', v: '5' }, { k: 'digit', v: '6' }, { k: 'operator', v: '−', label: '−' }],
  [{ k: 'digit', v: '1' }, { k: 'digit', v: '2' }, { k: 'digit', v: '3' }, { k: 'operator', v: '+', label: '+' }],
  [{ k: 'digit', v: '0', wide: true }, { k: 'digit', v: '.', label: ',' }, { k: 'equals', label: '=' }],
];

function Key({ entry, active, onPress }) {
  const isOperator = entry.k === 'operator' || entry.k === 'equals';
  return (
    <button
      type="button"
      onClick={onPress}
      className={`h-11 rounded font-condensed text-base uppercase transition-colors ${
        entry.wide ? 'col-span-2' : ''
      } ${
        isOperator
          ? `bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-deep)] ${active ? 'ring-2 ring-inset ring-white/70' : ''}`
          : entry.k === 'clear' || entry.k === 'sign' || entry.k === 'percent'
            ? 'border border-black/15 bg-black/5 text-ink-soft hover:bg-black/10'
            : 'border border-black/15 bg-white text-ink hover:bg-black/5'
      }`}
    >
      {entry.label ?? entry.v}
    </button>
  );
}

export default function Calculator({ state }) {
  const [open, setOpen] = useState(false);
  const [calc, setCalc] = useState(initial);
  const t = useT(state);
  const locale = state ? localeOf(state) : 'fr';
  const currencyLabel = state ? editionFor(state).currency.label ?? '€' : '';

  const dispatch = (action) => setCalc((s) => reducer(s, action));

  const close = () => {
    setOpen(false);
    setCalc(initial);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-black/15 bg-white px-2.5 py-2 font-condensed text-xs uppercase hover:bg-black/5 xl:py-1"
      >
        {t('calculator')}
      </button>

      {open && (
        <div
          className="fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6"
          onClick={close}
        >
          <div className="panel my-auto w-full max-w-xs rounded-xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="font-condensed text-xl uppercase tracking-[0.2em]">{t('calculatorTitle')}</h2>
              <button
                type="button"
                onClick={close}
                className="shrink-0 rounded border border-black/15 bg-white px-2 py-1 text-ink-soft hover:text-ink"
                aria-label={t('close')}
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-ink-soft">{t('calculatorHint')}</p>

            <div className="mb-3 rounded-lg border border-black/15 bg-black/5 px-3 py-3 text-right">
              <div className="tabular break-all font-condensed text-2xl leading-tight text-ink">
                {formatNumber(calc.display, locale)}
                {calc.display !== 'Erreur' && (
                  <span className="ml-1 text-base text-ink-soft">{currencyLabel}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {KEY_ROWS.map((row, i) => (
                <div key={i} className="col-span-4 grid grid-cols-4 gap-1.5">
                  {row.map((entry, j) => (
                    <Key
                      key={j}
                      entry={entry}
                      active={entry.k === 'operator' && calc.operator === entry.v && calc.resetOnDigit}
                      onPress={() => dispatch({ type: entry.k, value: entry.v })}
                    />
                  ))}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={close}
              className="mt-4 w-full rounded bg-[var(--color-accent)] py-2.5 font-condensed text-sm uppercase text-white hover:bg-[var(--color-accent-deep)]"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
