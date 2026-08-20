/**
 * Pictogrammes des cases, dessinés en SVG.
 *
 * Ce sont les repères visuels du plateau papier — locomotive sur les gares,
 * ampoule sur l'Électricité, point d'interrogation sur Chance — redessinés ici
 * de zéro, dans le même esprit.
 */

const box = { viewBox: '0 0 48 48', fill: 'currentColor' };

export function Locomotive({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M8 30h30a2 2 0 002-2V20a6 6 0 00-6-6H22l-2-5H9a1 1 0 000 2h9.6l1.6 3H12a4 4 0 00-4 4z" />
      <rect x="6" y="31.5" width="36" height="3" rx="1.5" />
      <circle cx="14" cy="39" r="4" />
      <circle cx="30" cy="39" r="4" />
      <rect x="10" y="37.5" width="24" height="2" rx="1" />
      <path d="M33 9h5v6h-5z" />
    </svg>
  );
}

export function Bulb({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M24 6c7.2 0 13 5.6 13 12.6 0 4.5-2.4 7.8-4.6 10.4-1.2 1.5-2.1 2.7-2.4 4.3H18c-.3-1.6-1.2-2.8-2.4-4.3C13.4 26.4 11 23.1 11 18.6 11 11.6 16.8 6 24 6z" />
      <rect x="18" y="35" width="12" height="3.2" rx="1.6" />
      <rect x="19.5" y="39.5" width="9" height="3" rx="1.5" />
      <path d="M22 42.5h4v1.2a2 2 0 01-4 0z" />
    </svg>
  );
}

export function Faucet({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M10 22h9v-3a9 9 0 0118 0v3h3v5H10z" />
      <rect x="24" y="8" width="4" height="8" rx="2" />
      <rect x="16" y="27" width="7" height="9" rx="1.5" />
      <path d="M34 30c0 2-1.6 3.4-1.6 5.4a1.6 1.6 0 003.2 0c0-2-1.6-3.4-1.6-5.4z" />
      <path d="M30 38c0 2.2-1.8 4-4 4s-4-1.8-4-4z" opacity=".6" />
    </svg>
  );
}

export function QuestionMark({ className = '', style }) {
  return (
    <svg viewBox="0 0 48 48" className={className} style={style} fill="currentColor">
      <path d="M24 4c6.6 0 11.6 4.2 11.6 10.2 0 4.4-2.2 6.8-5.8 9.2-2.6 1.8-3.4 2.8-3.4 5v1.4h-6.6v-2.2c0-3.8 1.4-6 5-8.4 2.8-1.9 3.8-3 3.8-5 0-2.4-1.8-4-4.6-4-3 0-4.8 1.8-5.2 4.8L12 14C12.5 8 17.4 4 24 4z" />
      <circle cx="23" cy="38" r="4.4" />
    </svg>
  );
}

export function Chest({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M8 20a16 16 0 0132 0v2H8z" />
      <rect x="6" y="22" width="36" height="16" rx="2" />
      <rect x="20.5" y="17" width="7" height="12" rx="1.4" fill="#fff" opacity=".65" />
      <circle cx="24" cy="24" r="1.8" />
    </svg>
  );
}

export function Diamond({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M14 10h20l8 10-18 20L6 20z" />
      <path d="M6 20h36" stroke="#fff" strokeWidth="1.6" opacity=".55" fill="none" />
      <path d="M24 10l-6 10 6 20 6-20z" fill="#fff" opacity=".28" />
    </svg>
  );
}

export function Ring({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <circle cx="24" cy="30" r="11" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M24 6l6 8H18z" />
      <path d="M18 14h12l-6 6z" opacity=".6" />
    </svg>
  );
}

/** Flèche de la case Départ. */
export function GoArrow({ className = '', style }) {
  return (
    <svg viewBox="0 0 48 48" className={className} style={style} fill="currentColor">
      <path d="M40 24L26 12v7H8v10h18v7z" />
    </svg>
  );
}

/** Barreaux de la prison. */
export function JailBars({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <rect x="8" y="8" width="32" height="32" rx="2" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <rect x="15" y="8" width="2.6" height="32" />
      <rect x="22.7" y="8" width="2.6" height="32" />
      <rect x="30.4" y="8" width="2.6" height="32" />
    </svg>
  );
}

/** Voiture garée du Parc Gratuit. */
export function ParkedCar({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M9 30l3.4-9A5 5 0 0117 18h14a5 5 0 014.6 3l3.4 9v6a2 2 0 01-2 2h-3a2 2 0 01-2-2v-1H15v1a2 2 0 01-2 2h-3a2 2 0 01-2-2z" />
      <path d="M14.6 22.5h18.8l2 6.5h-22.8z" fill="#fff" opacity=".6" />
      <circle cx="15" cy="33" r="2.2" fill="#fff" opacity=".8" />
      <circle cx="33" cy="33" r="2.2" fill="#fff" opacity=".8" />
    </svg>
  );
}

/** Silhouette d'agent pour « Allez en prison ». */
export function Officer({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M14 14h20v3H14z" />
      <path d="M17 8h14l2 5H15z" />
      <circle cx="24" cy="23" r="5.5" />
      <path d="M14 42v-6a8 8 0 018-8h4a8 8 0 018 8v6z" />
      <path d="M22 28h4l-2 6z" fill="#fff" opacity=".5" />
    </svg>
  );
}

// — Pictogrammes thématiques —————————————————————————————————
// De quoi habiller une édition sans redessiner tout le plateau : chaque boîte
// choisit ses symboles dans `theming.icons`.

/** Blason à écu — les salles communes de Poudlard. */
export function Crest({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M24 4l16 5v14c0 10-6.6 17.6-16 21C14.6 40.6 8 33 8 23V9z" />
      <path d="M24 9.6L13 13.2V23c0 7.4 4.6 13.2 11 16.2z" fill="#fff" opacity=".35" />
      <path d="M24 16l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6-4.4-4.2 6-.8z" fill="#fff" opacity=".8" />
    </svg>
  );
}

/** Étincelle de sortilège. */
export function Spark({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M24 2l3.6 12.8L40 8l-6.8 12.4L46 24l-12.8 3.6L40 40l-12.4-6.8L24 46l-3.6-12.8L8 40l6.8-12.4L2 24l12.8-3.6L8 8l12.4 6.8z" />
      <circle cx="24" cy="24" r="5" fill="#fff" opacity=".55" />
    </svg>
  );
}

/** Hibou postier — la pile Hibou Express. */
export function Owl({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M24 6c7 0 12.5 6.2 12.5 14S31 40 24 40 11.5 27.8 11.5 20 17 6 24 6z" />
      <path d="M13.6 6.4l5.2 4.4c.6.5.1 1.5-.7 1.4l-5.8-.8c-.5-.1-.9-.6-.7-1.1l1.2-3.6c.2-.6.9-.7 1.4-.3zM34.4 6.4l-5.2 4.4c-.6.5-.1 1.5.7 1.4l5.8-.8c.5-.1.9-.6.7-1.1l-1.2-3.6c-.2-.6-.9-.7-1.4-.3z" />
      <g fill="#fff" opacity=".9">
        <circle cx="19" cy="19" r="4.4" />
        <circle cx="29" cy="19" r="4.4" />
      </g>
      <circle cx="19" cy="19" r="1.8" />
      <circle cx="29" cy="19" r="1.8" />
      <path d="M24 22.6l2.4 3.4c.3.5 0 1.1-.6 1.1h-3.6c-.6 0-.9-.6-.6-1.1z" fill="#fff" opacity=".7" />
    </svg>
  );
}

/** Château — le cœur du domaine. */
export function Castle({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M6 20h5v-6h4v6h5v-6h4v6h4v-6h4v6h5v-6h4v6h3v22H4V20z" />
      <path d="M19 30h4v12h-4zM25 30h4v12h-4z" fill="#fff" opacity=".45" />
      <rect x="10" y="26" width="5" height="6" rx="2.5" fill="#fff" opacity=".35" />
      <rect x="33" y="26" width="5" height="6" rx="2.5" fill="#fff" opacity=".35" />
    </svg>
  );
}

/** Appareil tactique — les véhicules. */
export function Jet({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M24 3c1.9 0 3.4 2.2 4 5.6l1.2 6.8 12.4 8c.7.5 1.2 1.3 1.2 2.2v2.6c0 .8-.8 1.4-1.6 1.1l-12-3.6-.5 6.6 4.2 3.6c.4.3.6.8.6 1.3v1.9c0 .7-.7 1.2-1.4 1L24 38.8l-8.1 2.4c-.7.2-1.4-.3-1.4-1v-1.9c0-.5.2-1 .6-1.3l4.2-3.6-.5-6.6-12 3.6c-.8.3-1.6-.3-1.6-1.1v-2.6c0-.9.5-1.7 1.2-2.2l12.4-8L20 8.6C20.6 5.2 22.1 3 24 3z" />
      <rect x="21.8" y="20" width="4.4" height="10" rx="2.2" fill="#fff" opacity=".4" />
    </svg>
  );
}

/** Réacteur — les technologies. */
export function Reactor({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <circle cx="24" cy="24" r="19" />
      <circle cx="24" cy="24" r="13" fill="#fff" opacity=".35" />
      <circle cx="24" cy="24" r="7" />
      <circle cx="24" cy="24" r="3.4" fill="#fff" opacity=".95" />
      <g fill="#fff" opacity=".6">
        <rect x="23" y="3" width="2" height="6" />
        <rect x="23" y="39" width="2" height="6" />
        <rect x="3" y="23" width="6" height="2" />
        <rect x="39" y="23" width="6" height="2" />
      </g>
    </svg>
  );
}

/** Badge d'agence — la pile S.H.I.E.L.D. */
export function Badge({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <path d="M24 3l17 6v13c0 11-7 19.4-17 23C14 41.4 7 33 7 22V9z" />
      <path d="M24 11c5.5 0 10 4.5 10 10.2 0 5.6-4.5 10.2-10 10.2S14 26.8 14 21.2 18.5 11 24 11zm0 4.6a5.6 5.6 0 100 11.2 5.6 5.6 0 000-11.2z" fill="#fff" opacity=".85" />
    </svg>
  );
}

/** Toile tendue — les raccourcis d'un plateau où l'on se balance d'un coin à l'autre. */
export function Web({ className = '', style }) {
  return (
    <svg {...box} className={className} style={style}>
      <g stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d="M24 24V4M24 24l17.3 10M24 24l-17.3 10M24 24l17.3-10M24 24L6.7 14M24 24v20" />
      </g>
      <g stroke="currentColor" strokeWidth="2" fill="none">
        <path d="M24 11l11.3 6.5v13L24 37l-11.3-6.5v-13z" />
        <path d="M24 4l17.3 10v20L24 44 6.7 34V14z" />
      </g>
      <circle cx="24" cy="24" r="2.6" />
    </svg>
  );
}

/** La bibliothèque de pictogrammes adressables depuis une config d'édition. */
const LIBRARY = {
  locomotive: Locomotive, bulb: Bulb, faucet: Faucet, question: QuestionMark,
  chest: Chest, diamond: Diamond, ring: Ring, arrow: GoArrow, bars: JailBars,
  car: ParkedCar, officer: Officer,
  crest: Crest, spark: Spark, owl: Owl, castle: Castle,
  jet: Jet, reactor: Reactor, badge: Badge, web: Web,
};

/** Les pictogrammes du Monopoly d'origine, si l'édition n'en impose pas d'autres. */
const DEFAULT_ICONS = {
  railroad: 'locomotive',
  utility: ['bulb', 'faucet'],
  chance: 'question',
  community_chest: 'chest',
  tax: ['diamond', 'ring'],
  go: 'arrow',
  jail: 'bars',
  free_parking: 'car',
  go_to_jail: 'officer',
  // Cases génériques ajoutées par les extensions Hasbro (shared/extensions.js) :
  // pas de dessin dédié pour l'instant, on réutilise les pictogrammes les plus
  // proches en signification plutôt que de laisser la case sans icône.
  spin: 'question',
  escape: 'officer',
  heist: 'chest',
  super_jail: 'bars',
  landmark: 'crest',
};

/**
 * Le pictogramme d'une case, selon l'édition.
 *
 * Une entrée peut être une liste : les cases du même type reçoivent alors des
 * symboles différents dans l'ordre du plateau (les deux compagnies, les deux
 * taxes). On ne se réfère plus à des numéros de case, qui ne valaient que pour
 * le plateau parisien.
 */
export function iconFor(edition, space) {
  const table = { ...DEFAULT_ICONS, ...(edition?.theming?.icons ?? {}) };
  // Une case peut nommer son pictogramme elle-même : c'est ce qui permet à un
  // titre posé sur Départ de garder sa flèche plutôt que de prendre le symbole
  // générique de son nouveau type.
  const entry = space.icon ?? table[space.type];
  if (!entry) return null;

  if (Array.isArray(entry)) {
    const rank = (edition?.board ?? []).filter((s) => s.type === space.type).findIndex((s) => s.id === space.id);
    return LIBRARY[entry[Math.max(0, rank) % entry.length]] ?? null;
  }
  return LIBRARY[entry] ?? null;
}
