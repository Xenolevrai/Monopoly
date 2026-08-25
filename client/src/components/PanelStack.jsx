/**
 * Une colonne de sections, à gauche ou à droite du plateau.
 *
 * Le défaut qu'elle corrige, en deux temps. D'abord : tout était empilé dans
 * un ordre figé, et le chat se trouvait tout en bas — il fallait dérouler la
 * colonne entière pour l'atteindre, puis remonter pour jouer. Ensuite : la
 * colonne elle-même n'existait que d'un côté, alors que chacune joue
 * autrement — l'une veut le plateau et le chat côte à côte, l'autre préfère
 * ses biens à gauche. On ne choisit donc rien à leur place : n'importe quelle
 * section se replie, se réordonne, et se glisse d'une colonne à l'autre.
 *
 * Les deux colonnes (`side="left"` et `side="right"`) partagent le même objet
 * `layout` (`usePanelLayout`) : c'est ce qui permet à un glisser-déposer
 * commencé dans l'une de se terminer dans l'autre.
 */

/**
 * @param {{
 *   side: 'left'|'right',
 *   sections: {id: string, title: string, node: import('react').ReactNode, className?: string}[],
 *   layout: ReturnType<typeof import('../lib/usePanelLayout.js').usePanelLayout>,
 *   t: (key: string) => string,
 * }} props
 */
export default function PanelColumn({ side, sections, layout, t }) {
  const otherSide = side === 'left' ? 'right' : 'left';

  return (
    <>
      {sections.map((section, index) => {
        const isCollapsed = Boolean(layout.collapsed[section.id]);
        return (
          <section
            key={section.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => layout.dropInto(side, section.id)}
            // `shrink-0` est indispensable : la colonne est un conteneur flex de
            // hauteur fixe, et sans lui chaque section se fait comprimer au lieu
            // de laisser la colonne défiler — avec `overflow-hidden`, le contenu
            // se retrouvait rogné (mesuré : 412 px de contenu dans 315 px).
            className={`panel shrink-0 overflow-hidden rounded-lg transition-opacity ${
              section.className ?? ''
            } ${layout.dragging === section.id ? 'opacity-40' : ''}`}
          >
            <header
              draggable
              onDragStart={() => layout.setDragging(section.id)}
              onDragEnd={() => layout.setDragging(null)}
              className="flex cursor-grab items-center gap-1 border-b border-black/10 px-2 py-1 active:cursor-grabbing"
            >
              <span
                className="hidden select-none text-[11px] leading-none text-ink-soft xl:inline"
                aria-hidden="true"
              >
                ⠿
              </span>
              <button
                type="button"
                onClick={() => layout.toggleCollapse(section.id)}
                aria-expanded={!isCollapsed}
                className="flex-1 py-2 text-left font-condensed text-[11px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink xl:py-0"
              >
                {section.title}
              </button>
              {/* Les flèches et le renvoi de côté n'ont de sens qu'à deux
                  colonnes côte à côte : inutiles sur téléphone, où une seule
                  colonne existe et où le glisser-déposer ne se déclenche pas
                  au doigt de toute façon. */}
              <button
                type="button"
                onClick={() => layout.moveWithin(side, section.id, -1)}
                disabled={index === 0}
                aria-label={t('moveUp')}
                className="hidden px-1 text-[10px] leading-none text-ink-soft hover:text-ink disabled:opacity-25 xl:inline"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => layout.moveWithin(side, section.id, 1)}
                disabled={index === sections.length - 1}
                aria-label={t('moveDown')}
                className="hidden px-1 text-[10px] leading-none text-ink-soft hover:text-ink disabled:opacity-25 xl:inline"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => layout.sendToSide(section.id, otherSide)}
                aria-label={otherSide === 'left' ? t('moveToLeft') : t('moveToRight')}
                title={otherSide === 'left' ? t('moveToLeft') : t('moveToRight')}
                className="hidden px-1 text-[10px] leading-none text-ink-soft hover:text-ink xl:inline"
              >
                {otherSide === 'left' ? '◀' : '▶'}
              </button>
              <button
                type="button"
                onClick={() => layout.toggleCollapse(section.id)}
                aria-label={isCollapsed ? t('expand') : t('collapse')}
                className="-my-2 flex min-h-[40px] min-w-[40px] items-center justify-center text-[13px] leading-none text-ink-soft hover:text-ink xl:my-0 xl:min-h-0 xl:min-w-0 xl:px-1 xl:text-[10px]"
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
