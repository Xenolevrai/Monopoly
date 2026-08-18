/**
 * Pictogrammes des cases, dessinés en SVG.
 *
 * Ce sont les repères visuels du plateau papier — locomotive sur les gares,
 * ampoule sur l'Électricité, point d'interrogation sur Chance — redessinés ici
 * de zéro, dans le même esprit.
 */

const box = { viewBox: '0 0 48 48', fill: 'currentColor' };

export function Locomotive({ className = '' }) {
  return (
    <svg {...box} className={className}>
      <path d="M8 30h30a2 2 0 002-2V20a6 6 0 00-6-6H22l-2-5H9a1 1 0 000 2h9.6l1.6 3H12a4 4 0 00-4 4z" />
      <rect x="6" y="31.5" width="36" height="3" rx="1.5" />
      <circle cx="14" cy="39" r="4" />
      <circle cx="30" cy="39" r="4" />
      <rect x="10" y="37.5" width="24" height="2" rx="1" />
      <path d="M33 9h5v6h-5z" />
    </svg>
  );
}

export function Bulb({ className = '' }) {
  return (
    <svg {...box} className={className}>
      <path d="M24 6c7.2 0 13 5.6 13 12.6 0 4.5-2.4 7.8-4.6 10.4-1.2 1.5-2.1 2.7-2.4 4.3H18c-.3-1.6-1.2-2.8-2.4-4.3C13.4 26.4 11 23.1 11 18.6 11 11.6 16.8 6 24 6z" />
      <rect x="18" y="35" width="12" height="3.2" rx="1.6" />
      <rect x="19.5" y="39.5" width="9" height="3" rx="1.5" />
      <path d="M22 42.5h4v1.2a2 2 0 01-4 0z" />
    </svg>
  );
}

export function Faucet({ className = '' }) {
  return (
    <svg {...box} className={className}>
      <path d="M10 22h9v-3a9 9 0 0118 0v3h3v5H10z" />
      <rect x="24" y="8" width="4" height="8" rx="2" />
      <rect x="16" y="27" width="7" height="9" rx="1.5" />
      <path d="M34 30c0 2-1.6 3.4-1.6 5.4a1.6 1.6 0 003.2 0c0-2-1.6-3.4-1.6-5.4z" />
      <path d="M30 38c0 2.2-1.8 4-4 4s-4-1.8-4-4z" opacity=".6" />
    </svg>
  );
}

export function QuestionMark({ className = '' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="currentColor">
      <path d="M24 4c6.6 0 11.6 4.2 11.6 10.2 0 4.4-2.2 6.8-5.8 9.2-2.6 1.8-3.4 2.8-3.4 5v1.4h-6.6v-2.2c0-3.8 1.4-6 5-8.4 2.8-1.9 3.8-3 3.8-5 0-2.4-1.8-4-4.6-4-3 0-4.8 1.8-5.2 4.8L12 14C12.5 8 17.4 4 24 4z" />
      <circle cx="23" cy="38" r="4.4" />
    </svg>
  );
}

export function Chest({ className = '' }) {
  return (
    <svg {...box} className={className}>
      <path d="M8 20a16 16 0 0132 0v2H8z" />
      <rect x="6" y="22" width="36" height="16" rx="2" />
      <rect x="20.5" y="17" width="7" height="12" rx="1.4" fill="#fff" opacity=".65" />
      <circle cx="24" cy="24" r="1.8" />
    </svg>
  );
}

export function Diamond({ className = '' }) {
  return (
    <svg {...box} className={className}>
      <path d="M14 10h20l8 10-18 20L6 20z" />
      <path d="M6 20h36" stroke="#fff" strokeWidth="1.6" opacity=".55" fill="none" />
      <path d="M24 10l-6 10 6 20 6-20z" fill="#fff" opacity=".28" />
    </svg>
  );
}

export function Ring({ className = '' }) {
  return (
    <svg {...box} className={className}>
      <circle cx="24" cy="30" r="11" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M24 6l6 8H18z" />
      <path d="M18 14h12l-6 6z" opacity=".6" />
    </svg>
  );
}

/** Flèche de la case Départ. */
export function GoArrow({ className = '' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="currentColor">
      <path d="M40 24L26 12v7H8v10h18v7z" />
    </svg>
  );
}

/** Barreaux de la prison. */
export function JailBars({ className = '' }) {
  return (
    <svg {...box} className={className}>
      <rect x="8" y="8" width="32" height="32" rx="2" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <rect x="15" y="8" width="2.6" height="32" />
      <rect x="22.7" y="8" width="2.6" height="32" />
      <rect x="30.4" y="8" width="2.6" height="32" />
    </svg>
  );
}

/** Voiture garée du Parc Gratuit. */
export function ParkedCar({ className = '' }) {
  return (
    <svg {...box} className={className}>
      <path d="M9 30l3.4-9A5 5 0 0117 18h14a5 5 0 014.6 3l3.4 9v6a2 2 0 01-2 2h-3a2 2 0 01-2-2v-1H15v1a2 2 0 01-2 2h-3a2 2 0 01-2-2z" />
      <path d="M14.6 22.5h18.8l2 6.5h-22.8z" fill="#fff" opacity=".6" />
      <circle cx="15" cy="33" r="2.2" fill="#fff" opacity=".8" />
      <circle cx="33" cy="33" r="2.2" fill="#fff" opacity=".8" />
    </svg>
  );
}

/** Silhouette d'agent pour « Allez en prison ». */
export function Officer({ className = '' }) {
  return (
    <svg {...box} className={className}>
      <path d="M14 14h20v3H14z" />
      <path d="M17 8h14l2 5H15z" />
      <circle cx="24" cy="23" r="5.5" />
      <path d="M14 42v-6a8 8 0 018-8h4a8 8 0 018 8v6z" />
      <path d="M22 28h4l-2 6z" fill="#fff" opacity=".5" />
    </svg>
  );
}

/** Le pictogramme correspondant à une case, ou null. */
export function iconFor(space) {
  switch (space.type) {
    case 'railroad':
      return Locomotive;
    case 'utility':
      return space.id === 12 ? Bulb : Faucet;
    case 'chance':
      return QuestionMark;
    case 'community_chest':
      return Chest;
    case 'tax':
      return space.id === 4 ? Diamond : Ring;
    case 'go':
      return GoArrow;
    case 'jail':
      return JailBars;
    case 'free_parking':
      return ParkedCar;
    case 'go_to_jail':
      return Officer;
    default:
      return null;
  }
}
