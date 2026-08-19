/**
 * Les illustrations de cases.
 *
 * Sur une vraie boîte, chaque case porte son image : c'est ce qui fait qu'on
 * reconnaît le Poudlard Express ou la Tour des Avengers d'un coup d'œil, avant
 * même d'avoir lu le nom. Ici ce sont des silhouettes à l'encre, dessinées pour
 * rester lisibles à 14 px sur une case comme à 64 px sur une fiche.
 *
 * Ce sont des dessins originaux, dans l'esprit de chaque univers — aucun visuel
 * de marque n'est repris.
 *
 * Une édition associe ses cases à ces dessins par `theming.art` : `{ "5": "train" }`.
 */

const box = { viewBox: '0 0 48 48', fill: 'currentColor' };
const S = ({ children, className = '', style }) => (
  <svg {...box} className={className} style={style} aria-hidden="true">
    {children}
  </svg>
);

// — Le monde des sorciers ————————————————————————————————

/** Une porte sous l'escalier : marches et petit battant. */
export const Cupboard = (p) => (
  <S {...p}>
    <path d="M4 40h40v4H4zM8 40V28h8v12zM18 40V20h8v20zM28 40V12h8v28z" opacity=".35" />
    <path d="M14 40V26a4 4 0 018 0v14z" />
    <circle cx="20" cy="34" r="1.4" fill="#fff" opacity=".8" />
  </S>
);

/** La cabane du garde-chasse : toit pentu et cheminée fumante. */
export const Hut = (p) => (
  <S {...p}>
    <path d="M24 8L6 24h5v16h26V24h5z" />
    <rect x="32" y="10" width="5" height="10" rx="1" />
    <rect x="20" y="28" width="8" height="12" fill="#fff" opacity=".55" />
    <circle cx="24" cy="34" r="1" />
  </S>
);

/** Locomotive à vapeur, de profil. */
export const Train = (p) => (
  <S {...p}>
    <path d="M6 30h28a2 2 0 002-2v-8a6 6 0 00-6-6H18l-2-5H7a1 1 0 000 2h7.6l1.5 3H10a4 4 0 00-4 4z" />
    <rect x="4" y="31.5" width="36" height="3" rx="1.5" />
    <circle cx="13" cy="39" r="4" />
    <circle cx="29" cy="39" r="4" />
    <path d="M32 9h5v6h-5z" />
    <circle cx="34" cy="6" r="3" opacity=".5" />
  </S>
);

/** Chaudron bouillonnant. */
export const Cauldron = (p) => (
  <S {...p}>
    <path d="M9 20h30a1.4 1.4 0 011.4 1.6l-2.2 12A7 7 0 0131 40H17a7 7 0 01-7.2-6.4l-2.2-12A1.4 1.4 0 019 20z" />
    <rect x="6" y="17" width="36" height="4.4" rx="2.2" />
    <circle cx="18" cy="11" r="2.4" opacity=".55" />
    <circle cx="25" cy="7" r="3.2" opacity=".55" />
    <circle cx="31" cy="12" r="1.9" opacity=".55" />
  </S>
);

/** Chope de bièraubeurre, mousse comprise. */
export const Tankard = (p) => (
  <S {...p}>
    <path d="M10 16h20v22a4 4 0 01-4 4H14a4 4 0 01-4-4z" />
    <path d="M30 21h4a5 5 0 010 10h-4z" fill="none" stroke="currentColor" strokeWidth="3" />
    <path d="M10 16c0-3 4-5 10-5s10 2 10 5z" fill="#fff" opacity=".65" />
    <rect x="13" y="24" width="14" height="2" fill="#fff" opacity=".3" />
  </S>
);

/** Hure de sanglier, l'enseigne de l'auberge. */
export const Boar = (p) => (
  <S {...p}>
    <path d="M24 10c9 0 15 6 15 14 0 8-6 14-15 14S9 32 9 24c0-8 6-14 15-14z" />
    <path d="M17 34c-3 2-5 5-5 8h6zM31 34c3 2 5 5 5 8h-6z" />
    <circle cx="18" cy="22" r="2" fill="#fff" opacity=".85" />
    <circle cx="30" cy="22" r="2" fill="#fff" opacity=".85" />
    <ellipse cx="24" cy="31" rx="5" ry="3.6" fill="#fff" opacity=".55" />
  </S>
);

/** Pile de grimoires. */
export const Books = (p) => (
  <S {...p}>
    <rect x="7" y="32" width="34" height="8" rx="1.5" />
    <rect x="9" y="23" width="30" height="8" rx="1.5" opacity=".75" />
    <rect x="11" y="14" width="26" height="8" rx="1.5" opacity=".5" />
    <rect x="12" y="35" width="24" height="1.6" fill="#fff" opacity=".45" />
  </S>
);

/** Âtre et flammes vertes du réseau de cheminées. */
export const Hearth = (p) => (
  <S {...p}>
    <path d="M6 12h36v6H6zM9 18h30v22H9z" opacity=".35" />
    <path d="M14 40V26a10 10 0 0120 0v14z" />
    <path d="M24 36c-3 0-5-2-5-5 0-4 5-5 4-10 4 2 7 6 7 10 0 3-2 5-6 5z" fill="#fff" opacity=".7" />
  </S>
);

/** Coquillage nervuré. */
export const Shell = (p) => (
  <S {...p}>
    <path d="M24 6c11 0 19 12 19 22 0 8-8 14-19 14S5 36 5 28C5 18 13 6 24 6z" />
    <g stroke="#fff" strokeWidth="1.4" opacity=".45" fill="none">
      <path d="M24 8v34M15 11 9 34M33 11l6 23M20 9l-4 32M28 9l4 32" />
    </g>
  </S>
);

/** Baguette en diagonale, avec ses étincelles. */
export const Wand = (p) => (
  <S {...p}>
    <path d="M38 8.6c.8.8.8 2 0 2.8L16 33.4a2 2 0 01-2.8-2.8L35.2 8.6a2 2 0 012.8 0z" />
    <path d="M16 30l4 4-5 5-4.6-1-1-4.6z" />
    <g fill="currentColor" opacity=".55">
      <path d="M40 20l1 2.6 2.6 1-2.6 1L40 27l-1-2.4-2.6-1 2.6-1z" />
      <path d="M34 4l.8 2 2 .8-2 .8L34 9.6l-.8-2-2-.8 2-.8z" />
    </g>
  </S>
);

/** Navire à trois mâts. */
export const Ship = (p) => (
  <S {...p}>
    <path d="M22 8c0-1 1.3-1.6 2-.8L34 20c.5.6.1 1.6-.7 1.6H23c-.6 0-1-.5-1-1z" />
    <path d="M19 13c0-1-1.2-1.4-1.8-.6l-8 9.4c-.5.6-.1 1.6.7 1.6H18c.6 0 1-.5 1-1z" />
    <rect x="21" y="6" width="2" height="20" rx="1" />
    <path d="M6 28h36c.9 0 1.4 1 .9 1.7l-5 7.6A6 6 0 0133 40H15a6 6 0 01-4.9-2.7l-5-7.6c-.5-.7 0-1.7.9-1.7z" />
  </S>
);

/** Feu d'artifice : une gerbe d'étincelles. */
export const Firework = (p) => (
  <S {...p}>
    <circle cx="24" cy="22" r="5" />
    <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M24 4v8M24 32v8M6 22h8M34 22h8M11 9l6 6M37 9l-6 6M11 35l6-6M37 35l-6-6" />
    </g>
    <circle cx="24" cy="22" r="2" fill="#fff" opacity=".7" />
  </S>
);

/** Sucette en spirale. */
export const Sweets = (p) => (
  <S {...p}>
    <circle cx="22" cy="18" r="13" />
    <path
      d="M22 18a5 5 0 015-5 9 9 0 01-9 9 5 5 0 015-5 9 9 0 019 9 13 13 0 01-13-13"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      opacity=".7"
    />
    <rect x="20.5" y="30" width="3" height="14" rx="1.5" />
  </S>
);

/** Maison biscornue à plusieurs étages. */
export const Burrow = (p) => (
  <S {...p}>
    <path d="M12 44V26h14v18z" />
    <path d="M10 26l9-8 9 8z" />
    <path d="M20 26V14h12v12z" opacity=".8" />
    <path d="M18 14l8-7 8 7z" opacity=".8" />
    <path d="M28 14V6h9v8z" opacity=".6" />
    <path d="M26 6l6.5-5L39 6z" opacity=".6" />
    <rect x="16" y="32" width="5" height="7" fill="#fff" opacity=".5" />
  </S>
);

/** Maison hantée, penchée, aux fenêtres éclairées. */
export const Shack = (p) => (
  <S {...p}>
    <path d="M9 42l3-20 24-3 3 23z" />
    <path d="M10 22L24 8l14 11z" />
    <rect x="15" y="28" width="6" height="7" fill="#fff" opacity=".7" transform="rotate(-3 18 31)" />
    <rect x="27" y="27" width="6" height="7" fill="#fff" opacity=".7" transform="rotate(-3 30 30)" />
    <path d="M21 42v-8h6v8z" opacity=".5" />
  </S>
);

/** Vif d'or : sphère ailée. */
export const Snitch = (p) => (
  <S {...p}>
    <circle cx="24" cy="26" r="8" />
    <path d="M16 24h16v1.8H16z" fill="#fff" opacity=".45" />
    <path d="M17 21c-4-6-10-9-15-8-.8.2-1 1.3-.2 1.8 4.4 2.6 7.5 6.8 8.6 11.6.2.9 1.4 1 1.9.3z" />
    <path d="M31 21c4-6 10-9 15-8 .8.2 1 1.3.2 1.8-4.4 2.6-7.5 6.8-8.6 11.6-.2.9-1.4 1-1.9.3z" />
  </S>
);

/** Télescope pointé vers le ciel. */
export const Telescope = (p) => (
  <S {...p}>
    <path d="M8 30.6l24-14 5 8.6-24 14z" />
    <path d="M31 15.4l6.2-3.6 4.4 7.6-6.2 3.6z" opacity=".75" />
    <path d="M18 32l4 12h-4l-4-10zM26 27l8 17h-4l-8-15z" />
    <rect x="12" y="42" width="22" height="2.6" rx="1.3" />
  </S>
);

/** Voiture ancienne, vue de profil. */
export const Car = (p) => (
  <S {...p}>
    <path d="M6 30c0-3 2-5 5-5l4-7a4 4 0 013.6-2h11a4 4 0 013.4 1.9l4 7.1h2a5 5 0 015 5v4H6z" />
    <path d="M17 19h6v6h-9zM26 19h5l3.4 6H26z" fill="#fff" opacity=".55" />
    <circle cx="15" cy="36" r="4.4" />
    <circle cx="34" cy="36" r="4.4" />
    <circle cx="15" cy="36" r="1.6" fill="#fff" opacity=".7" />
    <circle cx="34" cy="36" r="1.6" fill="#fff" opacity=".7" />
  </S>
);

/** Chandelier flottant de la grande salle. */
export const Candles = (p) => (
  <S {...p}>
    <g>
      <rect x="10" y="20" width="4" height="18" rx="1.6" />
      <rect x="22" y="14" width="4" height="24" rx="1.6" />
      <rect x="34" y="22" width="4" height="16" rx="1.6" />
    </g>
    <g opacity=".8">
      <path d="M12 20c0-3 2-4 2-7-3 2-5 4-5 7z" />
      <path d="M24 14c0-3 2-4 2-7-3 2-5 4-5 7z" />
      <path d="M36 22c0-3 2-4 2-7-3 2-5 4-5 7z" />
    </g>
    <rect x="6" y="38" width="36" height="4" rx="2" />
  </S>
);

/** Maison de ville étroite, à perron. */
export const Townhouse = (p) => (
  <S {...p}>
    <path d="M12 44V12h24v32z" />
    <path d="M10 12l14-6 14 6z" />
    <rect x="21" y="30" width="6" height="14" fill="#fff" opacity=".6" />
    <g fill="#fff" opacity=".45">
      <rect x="16" y="17" width="5" height="6" />
      <rect x="27" y="17" width="5" height="6" />
    </g>
  </S>
);

/** Hibou de face, ailes repliées. */
export const OwlArt = (p) => (
  <S {...p}>
    <path d="M24 8c7 0 12 6 12 14s-5 16-12 16-12-8-12-16S17 8 24 8z" />
    <path d="M14 7l5 4c.6.5.2 1.5-.6 1.4l-5.6-.7c-.5 0-.8-.6-.7-1l1.1-3.3c.2-.6.9-.7 1.4-.4zM34 7l-5 4c-.6.5-.2 1.5.6 1.4l5.6-.7c.5 0 .8-.6.7-1l-1.1-3.3c-.2-.6-.9-.7-1.4-.4z" />
    <g fill="#fff" opacity=".9">
      <circle cx="19" cy="19" r="4.4" />
      <circle cx="29" cy="19" r="4.4" />
    </g>
    <circle cx="19" cy="19" r="1.8" />
    <circle cx="29" cy="19" r="1.8" />
    <path d="M24 23l2.4 3.4h-4.8z" fill="#fff" opacity=".7" />
  </S>
);

/** Porte cintrée, ornée. */
export const Door = (p) => (
  <S {...p}>
    <path d="M11 44V22a13 13 0 0126 0v22z" />
    <path d="M24 14a8 8 0 018 8v22h-8z" fill="#fff" opacity=".2" />
    <circle cx="30" cy="30" r="2" fill="#fff" opacity=".8" />
    <path d="M9 44h30v2H9z" />
  </S>
);

/** Serpent lové, langue dardée. */
export const Serpent = (p) => (
  <S {...p}>
    <path
      d="M10 38c-2-16 8-28 22-28 9 0 15 6 15 13 0 6-4.6 10-10 10-4.6 0-8-3-8-6.6 0-2.8 2-4.6 4.4-4.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
    />
    <circle cx="37" cy="22" r="2.2" />
    <path d="M45 20l4-2-4-2z" opacity=".7" />
  </S>
);

/** Rayonnage de bibliothèque. */
export const Shelf = (p) => (
  <S {...p}>
    <rect x="6" y="6" width="36" height="36" rx="2" opacity=".25" />
    <g>
      <rect x="10" y="10" width="4" height="12" />
      <rect x="15" y="12" width="4" height="10" />
      <rect x="20" y="9" width="3" height="13" />
      <rect x="10" y="26" width="3" height="12" />
      <rect x="14" y="28" width="4" height="10" />
      <rect x="19" y="25" width="4" height="13" />
      <rect x="27" y="11" width="4" height="11" />
      <rect x="32" y="9" width="3" height="13" />
      <rect x="27" y="27" width="3" height="11" />
      <rect x="31" y="25" width="4" height="13" />
    </g>
    <rect x="6" y="22" width="36" height="2.4" />
    <rect x="6" y="38" width="36" height="2.4" />
  </S>
);

/** Phénix aux ailes ouvertes. */
export const Phoenix = (p) => (
  <S {...p}>
    <path d="M24 6c3 0 5 3 5 7l-1 6 8-5c1-.6 2 .8 1.2 1.7L30 24l10 4c1 .4.8 2-.4 2l-11-1 3 12c.3 1-1 1.7-1.6.8L24 34l-6 7.8c-.6.9-1.9.2-1.6-.8l3-12-11 1c-1.2 0-1.4-1.6-.4-2l10-4-7.2-8.3c-.8-.9.2-2.3 1.2-1.7l8 5-1-6c0-4 2-7 5-7z" />
  </S>
);

/** Autobus à impériale. */
export const Bus = (p) => (
  <S {...p}>
    <path d="M8 10h32a3 3 0 013 3v24a3 3 0 01-3 3H8a3 3 0 01-3-3V13a3 3 0 013-3z" />
    <g fill="#fff" opacity=".6">
      <rect x="9" y="14" width="9" height="7" rx="1" />
      <rect x="20" y="14" width="8" height="7" rx="1" />
      <rect x="30" y="14" width="9" height="7" rx="1" />
      <rect x="9" y="25" width="9" height="7" rx="1" />
      <rect x="20" y="25" width="8" height="7" rx="1" />
    </g>
    <circle cx="14" cy="42" r="3.4" />
    <circle cx="34" cy="42" r="3.4" />
  </S>
);

/** Porte de coffre-fort. */
export const Vault = (p) => (
  <S {...p}>
    <rect x="6" y="8" width="36" height="34" rx="3" />
    <circle cx="24" cy="25" r="11" fill="#fff" opacity=".28" />
    <circle cx="24" cy="25" r="5" fill="#fff" opacity=".6" />
    <g stroke="#fff" strokeWidth="2.4" opacity=".8" strokeLinecap="round">
      <path d="M24 10v6M24 34v6M9 25h6M33 25h6" />
    </g>
  </S>
);

/** Banque à fronton et colonnes. */
export const Bank = (p) => (
  <S {...p}>
    <path d="M24 5l20 10H4z" />
    <rect x="5" y="17" width="38" height="3" />
    <g>
      <rect x="9" y="21" width="5" height="16" />
      <rect x="17" y="21" width="5" height="16" />
      <rect x="26" y="21" width="5" height="16" />
      <rect x="34" y="21" width="5" height="16" />
    </g>
    <rect x="4" y="38" width="40" height="5" rx="1.5" />
  </S>
);

// — L'univers des héros ————————————————————————————————

/** Œil bandé du directeur. */
export const Eyepatch = (p) => (
  <S {...p}>
    <circle cx="24" cy="24" r="18" opacity=".2" />
    <path d="M4 16h40v4H4z" transform="rotate(-8 24 18)" />
    <path d="M22 14h14v13a7 7 0 01-14 0z" />
    <circle cx="16" cy="26" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
    <circle cx="16" cy="26" r="2" />
  </S>
);

/** Badge d'agence à étoile. */
export const AgentBadge = (p) => (
  <S {...p}>
    <path d="M24 4l17 6v12c0 11-7 19-17 22C14 41 7 33 7 22V10z" />
    <path d="M24 14l3.2 6.8 7.4.9-5.5 5 1.5 7.3L24 30.4 17.4 34l1.5-7.3-5.5-5 7.4-.9z" fill="#fff" opacity=".85" />
  </S>
);

/** Ailes déployées d'un vol tactique. */
export const Wings = (p) => (
  <S {...p}>
    <path d="M24 14c2 0 3.4 1.6 3.4 3.6v14c0 2-1.4 3.6-3.4 3.6s-3.4-1.6-3.4-3.6v-14c0-2 1.4-3.6 3.4-3.6z" />
    <path d="M20 18L4 12c-1-.4-2 .8-1.2 1.7L14 26 3 32c-1 .6-.5 2.2.7 2l16.3-3z" />
    <path d="M28 18L44 12c1-.4 2 .8 1.2 1.7L34 26l11 6c1 .6.5 2.2-.7 2l-16.3-3z" />
  </S>
);

/** Bras mécanique articulé. */
export const MetalArm = (p) => (
  <S {...p}>
    <rect x="18" y="4" width="12" height="10" rx="3" />
    <rect x="19" y="15" width="10" height="8" rx="2" opacity=".85" />
    <rect x="18" y="24" width="12" height="9" rx="2.5" />
    <rect x="19" y="34" width="10" height="10" rx="3" opacity=".85" />
    <g fill="#fff" opacity=".5">
      <rect x="20" y="7" width="8" height="1.8" />
      <rect x="20" y="27" width="8" height="1.8" />
      <rect x="21" y="37" width="6" height="1.8" />
    </g>
  </S>
);

/** Une pierre sertie, rayonnante. */
export const Gem = (p) => (
  <S {...p}>
    <path d="M24 6l12 10-12 26L12 16z" />
    <path d="M24 6l12 10H12z" fill="#fff" opacity=".45" />
    <path d="M24 6v36" stroke="#fff" strokeWidth="1.4" opacity=".4" />
  </S>
);

/** Fourmi de profil. */
export const Ant = (p) => (
  <S {...p}>
    <ellipse cx="12" cy="24" rx="6" ry="5" />
    <ellipse cx="24" cy="24" rx="5" ry="4.4" />
    <ellipse cx="38" cy="24" rx="8" ry="6.4" />
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 21l-4-8M25 21l1-9M27 27l-2 9M21 27l-4 8M9 20l-5-7M9 28l-5 7" />
    </g>
  </S>
);

/** Ailes fines d'insecte, en vol. */
export const WaspWings = (p) => (
  <S {...p}>
    <ellipse cx="24" cy="30" rx="6" ry="11" />
    <g fill="#fff" opacity=".45">
      <rect x="18" y="26" width="12" height="2.4" />
      <rect x="18" y="32" width="12" height="2.4" />
    </g>
    <path d="M20 22C12 12 4 10 2 14c-2 4 6 10 17 12z" opacity=".75" />
    <path d="M28 22c8-10 16-12 18-8 2 4-6 10-17 12z" opacity=".75" />
  </S>
);

/** Masque félin. */
export const Panther = (p) => (
  <S {...p}>
    <path d="M24 6c10 0 16 8 16 18s-6 18-16 18S8 34 8 24 14 6 24 6z" />
    <path d="M10 12l4-8 6 6zM38 12l-4-8-6 6z" />
    <g fill="#fff" opacity=".85">
      <path d="M14 22l8-2v4l-8 2zM34 22l-8-2v4l8 2z" />
    </g>
    <path d="M24 30l4 4h-8z" fill="#fff" opacity=".6" />
  </S>
);

/** Porte-aéronefs vu de dessus. */
export const Carrier = (p) => (
  <S {...p}>
    <path d="M4 26c0-3 3-5 8-5h24c6 0 8 2 8 5s-2 5-8 5H12c-5 0-8-2-8-5z" />
    <rect x="20" y="12" width="9" height="8" rx="2" />
    <g fill="none" stroke="#fff" strokeWidth="1.6" opacity=".5">
      <path d="M10 26h28" />
    </g>
    <circle cx="9" cy="14" r="5" fill="none" stroke="currentColor" strokeWidth="2.4" />
    <circle cx="39" cy="14" r="5" fill="none" stroke="currentColor" strokeWidth="2.4" />
    <circle cx="9" cy="38" r="5" fill="none" stroke="currentColor" strokeWidth="2.4" />
    <circle cx="39" cy="38" r="5" fill="none" stroke="currentColor" strokeWidth="2.4" />
  </S>
);

/** Portail mystique concentrique. */
export const Portal = (p) => (
  <S {...p}>
    <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
    <circle cx="24" cy="24" r="12" fill="none" stroke="currentColor" strokeWidth="2" opacity=".7" />
    <circle cx="24" cy="24" r="6" />
    <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity=".8">
      <path d="M24 2v5M24 41v5M2 24h5M41 24h5M8 8l3.6 3.6M36.4 36.4L40 40M40 8l-3.6 3.6M11.6 36.4L8 40" />
    </g>
  </S>
);

/** Toile d'araignée en coin. */
export const Web = (p) => (
  <S {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 4L44 44M4 4v40M4 4h40M4 26l22 18M26 4l18 22" />
      <path d="M4 14c8 0 18 10 18 18M4 22c6 0 14 8 14 14M14 4c0 8 10 18 18 18M22 4c0 6 8 14 14 14" />
    </g>
  </S>
);

/** Étoile à six branches. */
export const Star = (p) => (
  <S {...p}>
    <path d="M24 2l5.4 14.6L44 22l-14.6 5.4L24 42l-5.4-14.6L4 22l14.6-5.4z" />
  </S>
);

/** Sablier. */
export const Hourglass = (p) => (
  <S {...p}>
    <rect x="9" y="4" width="30" height="4" rx="2" />
    <rect x="9" y="40" width="30" height="4" rx="2" />
    <path d="M13 8h22l-9 16 9 16H13l9-16z" />
    <path d="M17 11h14l-7 12z" fill="#fff" opacity=".45" />
  </S>
);

/** Poing serré. */
export const Fist = (p) => (
  <S {...p}>
    <path d="M9 22c0-4 3-7 7-7h16c5 0 9 4 9 9v8c0 6-5 11-11 11h-9c-7 0-12-5-12-12z" />
    <g fill="#fff" opacity=".4">
      <rect x="16" y="20" width="18" height="2" rx="1" />
      <rect x="16" y="26" width="18" height="2" rx="1" />
      <rect x="16" y="32" width="14" height="2" rx="1" />
    </g>
    <path d="M12 15h8v-3a4 4 0 018 0v3" fill="none" stroke="currentColor" strokeWidth="3" />
  </S>
);

/** Moto de profil. */
export const Motorcycle = (p) => (
  <S {...p}>
    <circle cx="11" cy="33" r="8" fill="none" stroke="currentColor" strokeWidth="3.4" />
    <circle cx="37" cy="33" r="8" fill="none" stroke="currentColor" strokeWidth="3.4" />
    <path d="M11 33l8-12h11l7 12" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
    <path d="M17 21h14l4-6h-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M18 20h12v4H18z" />
  </S>
);

/** Fiole de laboratoire. */
export const Flask = (p) => (
  <S {...p}>
    <path d="M19 5h10v13l10 19a5 5 0 01-4.3 7.6H13.3A5 5 0 019 37L19 18z" />
    <rect x="16" y="3" width="16" height="4" rx="2" />
    <path d="M16 30h16l4 7a2.4 2.4 0 01-2 3.6H14a2.4 2.4 0 01-2-3.6z" fill="#fff" opacity=".4" />
    <circle cx="21" cy="35" r="2" fill="#fff" opacity=".6" />
    <circle cx="28" cy="37" r="1.4" fill="#fff" opacity=".6" />
  </S>
);

/** Masque à visière de gardien de la galaxie. */
export const SpaceMask = (p) => (
  <S {...p}>
    <path d="M24 6c10 0 15 6 15 15 0 8-2 14-5 18-2 3-5 4-10 4s-8-1-10-4c-3-4-5-10-5-18C9 12 14 6 24 6z" />
    <path d="M13 20c3-2 7-3 11-3s8 1 11 3l-1.5 6c-.3 1.2-1.6 1.8-2.7 1.2L26 24c-1.2-.6-2.8-.6-4 0l-4.8 3.2c-1.1.6-2.4 0-2.7-1.2z" fill="#fff" opacity=".9" />
  </S>
);

/** Deux lames croisées. */
export const Blades = (p) => (
  <S {...p}>
    <path d="M8 8l6-2 22 28-4 4z" />
    <path d="M40 8l-6-2-22 28 4 4z" />
    <rect x="6" y="36" width="10" height="4" rx="2" transform="rotate(-45 11 38)" />
    <rect x="32" y="36" width="10" height="4" rx="2" transform="rotate(45 37 38)" />
  </S>
);

/** Petit arbre à grands bras. */
export const Tree = (p) => (
  <S {...p}>
    <rect x="20" y="24" width="8" height="20" rx="2" />
    <path d="M24 4c7 0 12 5 12 11s-5 11-12 11-12-5-12-11S17 4 24 4z" />
    <path d="M12 18L4 14c-1-.6-2 .7-1.2 1.6L10 24zM36 18l8-4c1-.6 2 .7 1.2 1.6L38 24z" />
    <g fill="#fff" opacity=".7">
      <circle cx="19" cy="14" r="2" />
      <circle cx="29" cy="14" r="2" />
    </g>
  </S>
);

/** Tour effilée à antenne. */
export const Tower = (p) => (
  <S {...p}>
    <path d="M18 44V16h12v28z" />
    <path d="M20 16l4-9 4 9z" />
    <rect x="23" y="0" width="2" height="8" />
    <g fill="#fff" opacity=".5">
      <rect x="21" y="20" width="6" height="3" />
      <rect x="21" y="26" width="6" height="3" />
      <rect x="21" y="32" width="6" height="3" />
    </g>
    <path d="M12 44v-8h24v8z" opacity=".8" />
  </S>
);

/** Enceinte pénitentiaire : barreaux et flots. */
export const Prison = (p) => (
  <S {...p}>
    <rect x="8" y="10" width="32" height="24" rx="2" />
    <g stroke="#fff" strokeWidth="2.4" opacity=".7">
      <path d="M16 12v20M24 12v20M32 12v20" />
    </g>
    <path d="M2 38c4 0 4 3 8 3s4-3 8-3 4 3 8 3 4-3 8-3 4 3 8 3v5H2z" opacity=".6" />
  </S>
);

/** Appareil à ailes en flèche, vu de dessus. */
export const Jet = (p) => (
  <S {...p}>
    <path d="M24 3c1.9 0 3.4 2.2 4 5.6l1.2 6.8 12.4 8c.7.5 1.2 1.3 1.2 2.2v2.6c0 .8-.8 1.4-1.6 1.1l-12-3.6-.5 6.6 4.2 3.6c.4.3.6.8.6 1.3v1.9c0 .7-.7 1.2-1.4 1L24 38.8l-8.1 2.4c-.7.2-1.4-.3-1.4-1v-1.9c0-.5.2-1 .6-1.3l4.2-3.6-.5-6.6-12 3.6c-.8.3-1.6-.3-1.6-1.1v-2.6c0-.9.5-1.7 1.2-2.2l12.4-8L20 8.6C20.6 5.2 22.1 3 24 3z" />
    <rect x="21.8" y="20" width="4.4" height="10" rx="2.2" fill="#fff" opacity=".4" />
  </S>
);

/** Marteau de guerre. */
export const Hammer = (p) => (
  <S {...p}>
    <rect x="8" y="8" width="32" height="14" rx="2" />
    <rect x="8" y="13" width="32" height="3" fill="#fff" opacity=".35" />
    <rect x="21" y="22" width="6" height="20" rx="2" />
    <path d="M20 38h8l-.6 5a1.4 1.4 0 01-1.4 1.2h-4a1.4 1.4 0 01-1.4-1.2z" />
  </S>
);

/** Bouclier à anneaux et étoile. */
export const ShieldStar = (p) => (
  <S {...p}>
    <circle cx="24" cy="24" r="20" />
    <circle cx="24" cy="24" r="15" fill="#fff" opacity=".35" />
    <circle cx="24" cy="24" r="10" />
    <circle cx="24" cy="24" r="6" fill="#fff" opacity=".35" />
    <path d="M24 17l1.8 4 4.4.5-3.3 3 1 4.3-3.9-2.2-3.9 2.2 1-4.3-3.3-3 4.4-.5z" fill="#fff" opacity=".95" />
  </S>
);

/** Casque à visière. */
export const Helmet = (p) => (
  <S {...p}>
    <path d="M24 5c9 0 14 6 14 15 0 7-1.4 13-4 18-1.4 2.8-3.8 5-7 5h-6c-3.2 0-5.6-2.2-7-5-2.6-5-4-11-4-18C10 11 15 5 24 5z" />
    <path d="M14 22c2.6-1.6 6-2.4 10-2.4s7.4.8 10 2.4l-1.4 5c-.3 1-1.4 1.5-2.3 1l-4.8-2.4c-1-.5-2.2-.5-3.2 0L17.7 28c-1 .5-2 0-2.3-1z" fill="#fff" opacity=".9" />
  </S>
);

/** Réacteur circulaire. */
export const ArcReactor = (p) => (
  <S {...p}>
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
  </S>
);

/** Arc bandé et flèche. */
export const Bow = (p) => (
  <S {...p}>
    <path d="M34 5c.8-.4 1.7.4 1.3 1.2A48 48 0 0032 24c0 6.4 1.2 12.4 3.3 17.8.4.9-.5 1.7-1.3 1.2C27.4 39.6 23 32.4 23 24S27.4 8.4 34 5z" />
    <path d="M34.5 7c.6-.3 1.2.4.9 1L30 20l-1.6-1.3zM34.5 41c.6.3 1.2-.4.9-1L30 28l-1.6 1.3z" opacity=".8" />
    <rect x="6" y="22.6" width="22" height="2.8" rx="1.4" />
    <path d="M28 20l6 4-6 4z" />
  </S>
);

// — Le monde classique ————————————————————————————————

export { Train as Locomotive2 };

/** La bibliothèque de dessins adressables depuis une config d'édition. */
export const ART = {
  // Sorciers
  cupboard: Cupboard, hut: Hut, train: Train, cauldron: Cauldron, tankard: Tankard,
  boar: Boar, books: Books, hearth: Hearth, shell: Shell, wand: Wand, ship: Ship,
  firework: Firework, sweets: Sweets, burrow: Burrow, shack: Shack, snitch: Snitch,
  telescope: Telescope, car: Car, candles: Candles, townhouse: Townhouse, owl: OwlArt,
  door: Door, serpent: Serpent, shelf: Shelf, phoenix: Phoenix, bus: Bus, vault: Vault,
  bank: Bank,
  // Héros
  eyepatch: Eyepatch, agentBadge: AgentBadge, wings: Wings, metalArm: MetalArm, gem: Gem,
  ant: Ant, waspWings: WaspWings, panther: Panther, carrier: Carrier, portal: Portal,
  web: Web, star: Star, hourglass: Hourglass, fist: Fist, motorcycle: Motorcycle,
  flask: Flask, spaceMask: SpaceMask, blades: Blades, tree: Tree, tower: Tower,
  prison: Prison, hammer: Hammer, shieldStar: ShieldStar, helmet: Helmet, jet: Jet,
  arcReactor: ArcReactor, bow: Bow,
};

/**
 * L'illustration d'une case selon l'édition, ou `null` si elle n'en déclare pas
 * (le pictogramme générique du type de case prend alors le relais).
 */
export function artFor(edition, space) {
  const name = edition?.theming?.art?.[space.id];
  return name ? (ART[name] ?? null) : null;
}
