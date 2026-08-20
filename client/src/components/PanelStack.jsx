/**
 * La colonne de droite, réarrangeable.
 *
 * Le défaut qu'elle corrige : tout était empilé dans un ordre figé, et le chat
 * se trouvait tout en bas. Pour écrire un mot il fallait dérouler la colonne
 * entière, puis remonter pour jouer. Chacune joue autrement — l'une veut le
 * chat sous les yeux, l'autre la liste des biens — donc plutôt que de choisir
 * un ordre à leur place, on les laisse le choisir.
 *
 * Deux gestes : **replier** une section, et la **déplacer** en la glissant par
 * sa poignée. L'agencement est gardé dans le navigateur : on le règle une fois,
 * il tient d'une partie à l'autre.
 */
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'monopoly:agencement';

/** Lit l'agencement gardé, en ignorant proprement un stockage indisponible. */
function loadLayout() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Navigation privée, quota plein : l'agencement ne survivra pas, tant pis.
  }
}

/**
 * @param {{ sections: {id: string, title: string, node: import('react').ReactNode, className?: string}[] }} props
 */
export default function PanelStack({ sections, t }) {
  const [order, setOrder] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [dragging, setDragging] = useState(null);

  // On lit le stockage après le montage : le serveur de rendu ne l'a pas, et
  // lire pendant le rendu ferait diverger le premier affichage.
  useEffect(() => {
    const saved = loadLayout();
    setOrder(saved.order ?? null);
    setCollapsed(saved.collapsed ?? {});
  }, []);

  const ids = sections.map((s) => s.id);
  // L'ordre gardé peut dater d'une version où une section n'existait pas encore :
  // on garde ce qu'on reconnaît, et l'on ajoute les nouvelles à la fin.
  const effective = order
    ? [...order.filter((id) => ids.includes(id)), ...ids.filter((id) => !order.includes(id))]
    : ids;

  const persist = (next, nextCollapsed = collapsed) => {
    setOrder(next);
    setCollapsed(nextCollapsed);
    saveLayout({ order: next, collapsed: nextCollapsed });
  };

  const move = (id, delta) => {
    const from = effective.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= effective.length) return;
    const next = [...effective];
    [next[from], next[to]] = [next[to], next[from]];
    persist(next);
  };

  const drop = (targetId) => {
    if (!dragging || dragging === targetId) return;
    const next = effective.filter((id) => id !== dragging);
    next.splice(effective.indexOf(targetId), 0, dragging);
    persist(next);
    setDragging(null);
  };

  const toggle = (id) => persist(effective, { ...collapsed, [id]: !collapsed[id] });

  return (
    <>
      {effective.map((id, index) => {
        const section = sections.find((s) => s.id === id);
        if (!section) return null;
        const isCollapsed = Boolean(collapsed[id]);

        return (
          <section
            key={id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(id)}
            className={`panel overflow-hidden rounded-lg transition-opacity ${
              section.className ?? ''
            } ${dragging === id ? 'opacity-40' : ''}`}
          >
            <header
              draggable
              onDragStart={() => setDragging(id)}
              onDragEnd={() => setDragging(null)}
              className="flex cursor-grab items-center gap-1 border-b border-black/10 px-2 py-1 active:cursor-grabbing"
            >
              <span className="select-none text-[11px] leading-none text-ink-soft" aria-hidden="true">
                ⠿
              </span>
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-expanded={!isCollapsed}
                className="flex-1 text-left font-condensed text-[11px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink"
              >
                {section.title}
              </button>
              {/* Les flèches font ce que le glisser-déposer fait, mais au doigt :
                  sur un écran tactile, un `draggable` ne se déclenche pas. */}
              <button
                type="button"
                onClick={() => move(id, -1)}
                disabled={index === 0}
                aria-label={t('moveUp')}
                className="px-1 text-[10px] leading-none text-ink-soft hover:text-ink disabled:opacity-25"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(id, 1)}
                disabled={index === effective.length - 1}
                aria-label={t('moveDown')}
                className="px-1 text-[10px] leading-none text-ink-soft hover:text-ink disabled:opacity-25"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={isCollapsed ? t('expand') : t('collapse')}
                className="px-1 text-[10px] leading-none text-ink-soft hover:text-ink"
              >
                {isCollapsed ? '+' : '−'}
              </button>
            </header>
            {!isCollapsed && <div className="p-2">{section.node}</div>}
          </section>
        );
      })}
    </>
  );
}
