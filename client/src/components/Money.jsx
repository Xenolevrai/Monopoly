/**
 * L'argent en billets.
 *
 * Un solde affiché « 1 500 € » ne dit rien ; une liasse, si. On décompose donc
 * les montants dans les coupures du jeu, et on choisit ses billets à la main
 * quand on paie quelqu'un — comme on pousse des billets sur la table.
 */
import { money, editionFor } from '../lib/board.js';

/** Palette des coupures, de la plus grosse à la plus petite. */
export const BILLS = [
  { value: 500, color: '#e8a33d', ink: '#3a2a0c' },
  { value: 100, color: '#e8dcc0', ink: '#3a3325' },
  { value: 50, color: '#4f7fc4', ink: '#f4f7fc' },
  { value: 20, color: '#3fa06a', ink: '#f2fbf5' },
  { value: 10, color: '#8fc9e8', ink: '#16323f' },
  { value: 5, color: '#e295b4', ink: '#3d1424' },
  { value: 1, color: '#f5f2e8', ink: '#3a3325' },
];

/**
 * Les coupures de l'édition en cours. Une édition à billet unique (Speed,
 * Junior) n'en déclare qu'une : la liasse s'affiche alors en un seul type.
 */
function billsOf(state) {
  const values = editionFor(state).currency.denominations ?? BILLS.map((b) => b.value);
  const palette = new Map(BILLS.map((b) => [b.value, b]));
  return values.map(
    (value) => palette.get(value) ?? { value, color: '#e8dcc0', ink: '#3a3325' },
  );
}

/** Décompose un montant dans les coupures de l'édition, la plus grosse d'abord. */
export function toBills(state, amount) {
  let rest = Math.max(0, Math.round(amount));
  const out = [];
  for (const bill of billsOf(state)) {
    const count = Math.floor(rest / bill.value);
    if (count > 0) out.push({ ...bill, count });
    rest -= count * bill.value;
  }
  return out;
}

function Bill({ state, bill, count, size = 'sm' }) {
  const dims = size === 'sm' ? 'h-4 w-7 text-[8px]' : 'h-7 w-12 text-[11px]';
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-[2px] border border-black/35 font-condensed ${dims}`}
      style={{ backgroundColor: bill.color, color: bill.ink }}
      title={`${count} billet${count > 1 ? 's' : ''} de ${money(state, bill.value)}`}
    >
      {bill.value}
      {count > 1 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1 text-[7px] leading-[11px] text-white">
          {count}
        </span>
      )}
    </span>
  );
}

/** La liasse d'une joueuse : ce qu'elle a réellement en main. */
export function BillStack({ state, amount, size = 'sm' }) {
  const bills = toBills(state, amount);
  if (!bills.length) return <span className="text-[10px] text-ink-soft">plus un billet</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {bills.map((bill) => (
        <Bill key={bill.value} state={state} bill={bill} count={bill.count} size={size} />
      ))}
    </span>
  );
}

/**
 * Choix des billets à donner : on clique sur une coupure pour l'ajouter,
 * clic droit (ou le bouton −) pour la retirer. Le total suit.
 */
export function BillPicker({ state, value, max, onChange }) {
  const add = (amount) => onChange(Math.min(max, value + amount));
  const remove = (amount) => onChange(Math.max(0, value - amount));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {billsOf(state).map((bill) => {
          const disabled = value + bill.value > max;
          return (
            <span key={bill.value} className="flex flex-col items-center gap-0.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => add(bill.value)}
                title={`Ajouter un billet de ${money(state, bill.value)}`}
                className={`flex h-7 w-12 items-center justify-center rounded-[2px] border border-black/35 font-condensed text-[11px] transition-transform ${
                  disabled ? 'cursor-not-allowed opacity-35' : 'hover:-translate-y-0.5'
                }`}
                style={{ backgroundColor: bill.color, color: bill.ink }}
              >
                {bill.value}
              </button>
              <button
                type="button"
                onClick={() => remove(bill.value)}
                disabled={value < bill.value}
                className="text-[10px] leading-none text-ink-soft hover:text-ink disabled:opacity-25"
                title={`Retirer un billet de ${money(state, bill.value)}`}
              >
                −
              </button>
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="tabular font-semibold">{money(state, value)}</span>
        <button
          type="button"
          onClick={() => onChange(0)}
          className="rounded border border-black/15 bg-white px-2 py-0.5 font-condensed text-[10px] uppercase hover:bg-black/5"
        >
          Reprendre
        </button>
        <span className="tabular ml-auto text-ink-soft">disponible : {money(state, max)}</span>
      </div>
    </div>
  );
}
