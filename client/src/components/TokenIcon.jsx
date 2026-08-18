/**
 * Les six pions, dessinés à la main en SVG.
 *
 * Chacun est une silhouette pleine dans `currentColor`, avec quelques détails
 * en réserve : lisibles à 14 px sur une case comme à 64 px dans le lobby.
 * Ce sont des dessins originaux, dans l'esprit des pions d'un jeu de plateau —
 * aucun visuel de marque n'est repris.
 */

const SHAPES = {
  // Chapeau haut-de-forme : bord large et haute calotte, pour ne pas le
  // confondre avec le dé à coudre.
  chapeau: (
    <>
      <ellipse cx="32" cy="44" rx="22" ry="6" opacity=".9" />
      <ellipse cx="32" cy="42" rx="22" ry="6" />
      <path d="M20 14c0-1.7 1.3-3 3-3h18c1.7 0 3 1.3 3 3v28H20z" />
      <rect x="19.4" y="32" width="25.2" height="7" fill="#fff" opacity=".3" />
      <ellipse cx="32" cy="14" rx="12" ry="3.4" fill="#fff" opacity=".22" />
    </>
  ),

  // Chat assis, queue enroulée.
  chat: (
    <>
      <path d="M25 22l-2.6-8.4c-.3-1 .8-1.8 1.6-1.2l7 5.1a13 13 0 016 0l7-5.1c.8-.6 1.9.2 1.6 1.2L43 22z" />
      <path d="M34 18c6.6 0 12 4.7 12 10.6 0 4.4-3 8.2-7.4 9.8 2.6 1.6 4.4 4 4.4 7.2 0 .8-.7 1.4-1.5 1.4H22.5c-.8 0-1.5-.6-1.5-1.4 0-4.6 3.6-8.4 8.6-9.8C25.4 35.6 22 32.2 22 28.6 22 22.7 27.4 18 34 18z" />
      <circle cx="29.5" cy="27.5" r="1.6" fill="#fff" opacity=".8" />
      <circle cx="38.5" cy="27.5" r="1.6" fill="#fff" opacity=".8" />
      <path d="M46 30c4 1.6 6 5 6 9 0 3.4-2 6-4.6 7.2-.9.4-1.7-.8-1-1.5 1.6-1.6 2.6-3.4 2.6-5.7 0-2.6-1.3-4.8-3.6-6.2z" />
    </>
  ),

  // Voilier, deux voiles et une coque.
  bateau: (
    <>
      <path d="M31 12.5c0-1 1.3-1.5 2-.7L43 24c.5.6.1 1.5-.7 1.5H32c-.6 0-1-.4-1-1V12.5z" />
      <path d="M29 17.2c0-.9-1.1-1.3-1.7-.6l-8.2 9.2c-.5.6-.1 1.6.7 1.6H28c.6 0 1-.5 1-1V17.2z" />
      <rect x="30" y="10" width="1.8" height="22" rx=".9" />
      <path d="M14 34h36c.9 0 1.4 1 .9 1.7l-5.2 7.5c-1 1.5-2.7 2.4-4.5 2.4H22.8c-1.8 0-3.5-.9-4.5-2.4l-5.2-7.5c-.5-.7 0-1.7.9-1.7z" />
      <rect x="16.5" y="36.5" width="31" height="2.4" rx="1.2" fill="#fff" opacity=".25" />
    </>
  ),

  // Brouette de jardin, vue de côté.
  brouette: (
    <>
      <path d="M16 20h5.6c.9 0 1.7.6 1.9 1.5L27 34h17c.9 0 1.5.9 1.2 1.7l-1.6 4c-.3.8-1 1.3-1.9 1.3H26c-1.4 0-2.6-1-2.9-2.3L19.4 24H16a2 2 0 010-4z" />
      <path d="M27.4 24H45c1 0 1.7 1 1.4 1.9l-2 6.1H29z" opacity=".55" />
      <circle cx="30" cy="47" r="4.6" />
      <circle cx="30" cy="47" r="1.7" fill="#fff" opacity=".7" />
      <path d="M43 41l6.5 5.6c.9.8-.3 2.2-1.3 1.5L41 43.4z" />
    </>
  ),

  // Dé à coudre, avec ses piqûres.
  de: (
    <>
      <path d="M34 12c6 0 10 4.6 10 11.5 0 5.6-1.2 12-2.6 17.4-.4 1.4-1.6 2.3-3 2.3h-8.8c-1.4 0-2.6-.9-3-2.3C25.2 35.5 24 29.1 24 23.5 24 16.6 28 12 34 12z" />
      <path d="M25.6 43.6h16.8c1 0 1.6.7 1.6 1.6v1.4c0 .9-.7 1.6-1.6 1.6H25.6c-1 0-1.6-.7-1.6-1.6v-1.4c0-.9.7-1.6 1.6-1.6z" />
      <g fill="#fff" opacity=".55">
        <circle cx="30" cy="20" r="1.1" />
        <circle cx="34" cy="18.6" r="1.1" />
        <circle cx="38" cy="20" r="1.1" />
        <circle cx="30" cy="25" r="1.1" />
        <circle cx="34" cy="23.6" r="1.1" />
        <circle cx="38" cy="25" r="1.1" />
        <circle cx="31" cy="30" r="1.1" />
        <circle cx="37" cy="30" r="1.1" />
      </g>
    </>
  ),

  // Lanterne de rue, façon réverbère parisien.
  lanterne: (
    <>
      <path d="M33 8h2c.6 0 1 .4 1 1v3h-4V9c0-.6.4-1 1-1z" />
      <path d="M27.5 14h13c.8 0 1.3.9.9 1.6L39 19H29l-2.4-3.4c-.4-.7.1-1.6.9-1.6z" />
      <path d="M29 19h10l2.6 14.6c.2 1-.6 1.9-1.6 1.9H28c-1 0-1.8-.9-1.6-1.9z" />
      <path d="M30.6 21.4h6.8l1.8 10.4c.1.6-.3 1.1-.9 1.1h-8.6c-.6 0-1-.5-.9-1.1z" fill="#fff" opacity=".45" />
      <path d="M26.6 36h14.8c.8 0 1.4.6 1.4 1.4s-.6 1.4-1.4 1.4H26.6c-.8 0-1.4-.6-1.4-1.4S25.8 36 26.6 36z" />
      <rect x="32" y="39" width="4" height="9" />
      <path d="M25 48h18c.9 0 1.6.7 1.6 1.6S43.9 51 43 51H25c-.9 0-1.6-.7-1.6-1.6S24.1 48 25 48z" />
    </>
  ),
};

/**
 * @param {{ token: string, color?: string, className?: string, title?: string }} props
 */
export default function TokenIcon({ token, color = 'currentColor', className = '', title }) {
  const shape = SHAPES[token] ?? SHAPES.chapeau;
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill={color}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {shape}
    </svg>
  );
}

export const TOKEN_IDS = Object.keys(SHAPES);
