/**
 * Les pions, dessinés à la main en SVG — six par édition.
 *
 * Chacun est une silhouette pleine dans `currentColor`, avec quelques détails
 * en réserve : lisibles à 14 px sur une case comme à 64 px dans le lobby.
 * Ce sont des dessins originaux, dans l'esprit des pions d'un jeu de plateau —
 * aucun visuel de marque n'est repris.
 *
 * Une édition qui déclare un pion sans silhouette ici retombe sur une pastille
 * neutre : elle reste jouable, simplement moins jolie.
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

  // — Poudlard ————————————————————————————————————————

  // Baguette : une tige effilée en diagonale, poignée baguée, étincelles.
  baguette: (
    <>
      <path d="M44.8 12.6c1 1 1 2.6 0 3.6L23.4 37.6c-1 1-2.6 1-3.6 0s-1-2.6 0-3.6L41.2 12.6c1-1 2.6-1 3.6 0z" />
      <path d="M24.6 32.4l7 7-6.4 6.4c-.6.6-1.4.9-2.2.7l-5.6-1.3-1.3-5.6c-.2-.8.1-1.7.7-2.2z" />
      <rect x="26.4" y="30.2" width="10" height="3.2" rx="1.6" transform="rotate(-45 31.4 31.8)" fill="#fff" opacity=".45" />
      <g fill="#fff" opacity=".75">
        <path d="M50 20l1.1 3.1 3.1 1.1-3.1 1.1L50 28.4l-1.1-3.1-3.1-1.1 3.1-1.1z" />
        <path d="M42 6l.8 2.2 2.2.8-2.2.8L42 12l-.8-2.2-2.2-.8 2.2-.8z" />
      </g>
    </>
  ),

  // Chaudron : panse ronde, large rebord, trois pieds, bulles.
  chaudron: (
    <>
      <path d="M17 26h30c1 0 1.7.9 1.5 1.9l-2.8 14.6A8 8 0 0138 49H26a8 8 0 01-7.7-6.5L15.5 27.9c-.2-1 .5-1.9 1.5-1.9z" />
      <rect x="12" y="22.6" width="40" height="5.2" rx="2.6" />
      <path d="M21 32h22l-1.8 9.4c-.4 2-2.1 3.4-4.1 3.4h-10c-2 0-3.7-1.4-4.1-3.4z" fill="#fff" opacity=".28" />
      <path d="M22 48.6l-2.4 4.2c-.5.9-1.9.1-1.4-.8l2.3-4.1zM42 48.6l2.4 4.2c.5.9 1.9.1 1.4-.8l-2.3-4.1zM32 49.4v4.4c0 1-1.6 1-1.6 0v-4.4z" />
      <g fill="#fff" opacity=".7">
        <circle cx="27" cy="17" r="2.6" />
        <circle cx="35" cy="12.5" r="3.4" />
        <circle cx="40.5" cy="18.5" r="1.9" />
      </g>
    </>
  ),

  // Vif d'or : une sphère nervurée entre deux ailes déployées.
  vif: (
    <>
      <circle cx="32" cy="34" r="10" />
      <path d="M22.6 30.4h18.8v2.2H22.6zM24 38.6h16v2.2H24z" fill="#fff" opacity=".4" />
      <path d="M23 30c-4.6-6.4-11.6-9.6-17.4-8.4-.9.2-1.1 1.4-.3 1.9 5 3 8.6 7.8 10 13.4.2 1 1.5 1.2 2.1.4z" />
      <path d="M41 30c4.6-6.4 11.6-9.6 17.4-8.4.9.2 1.1 1.4.3 1.9-5 3-8.6 7.8-10 13.4-.2 1-1.5 1.2-2.1.4z" />
      <circle cx="28.6" cy="30.6" r="2.2" fill="#fff" opacity=".5" />
    </>
  ),

  // Hibou : corps trapu, aigrettes, grands yeux ronds.
  hibou: (
    <>
      <path d="M32 13c8.3 0 15 7.4 15 16.5S40.3 50 32 50s-15-11.4-15-20.5S23.7 13 32 13z" />
      <path d="M19.6 13.4l6.4 5.2c.7.6.2 1.8-.7 1.7l-7-.9c-.6-.1-1-.7-.8-1.3l1.4-4.3c.2-.7 1.1-.9 1.7-.4zM44.4 13.4l-6.4 5.2c-.7.6-.2 1.8.7 1.7l7-.9c.6-.1 1-.7.8-1.3l-1.4-4.3c-.2-.7-1.1-.9-1.7-.4z" />
      <g fill="#fff" opacity=".85">
        <circle cx="26" cy="27" r="5.4" />
        <circle cx="38" cy="27" r="5.4" />
      </g>
      <circle cx="26" cy="27" r="2.2" />
      <circle cx="38" cy="27" r="2.2" />
      <path d="M32 31.6l3 4.2c.4.6 0 1.4-.7 1.4h-4.6c-.7 0-1.1-.8-.7-1.4z" fill="#fff" opacity=".6" />
      <path d="M26 49l-2.6 4c-.5.8-1.8.1-1.3-.8l2.4-3.9zM38 49l2.6 4c.5.8 1.8.1 1.3-.8l-2.4-3.9z" />
    </>
  ),

  // Balai : long manche en diagonale et brindilles liées.
  balai: (
    <>
      <path d="M14.4 13.6c1-1 2.6-1 3.6 0l20 20-3.6 3.6-20-20c-1-1-1-2.6 0-3.6z" />
      <path d="M36 32.4l4 4-3.6 3.6-4-4z" fill="#fff" opacity=".45" />
      <path d="M39.6 35.6l4.4 4.4c.6.6.7 1.6.2 2.3L36 53.4c-.7 1-2.2 1-2.9 0l-6-8.4c-.5-.7-.4-1.7.2-2.3z" />
      <g stroke="#fff" strokeWidth="1.1" opacity=".4" fill="none">
        <path d="M38 41l-4 10M41.5 43l-3 9M34.5 43.5l-2 8" />
      </g>
      <rect x="36.4" y="35.6" width="9.4" height="3.4" rx="1.7" transform="rotate(45 41.1 37.3)" fill="#fff" opacity=".55" />
    </>
  ),

  // Choixpeau : cône avachi, large bord, pli qui fait un visage.
  choixpeau: (
    <>
      <path d="M31 10c1.6-1.2 3.4.2 3.2 2l-1 9.4c2.6 5 5.6 10.4 8.4 14.8 1 1.6-.4 3.4-2.2 3l-7-1.6-6.6 2.4c-1.8.6-3.4-1.2-2.6-2.9l6.2-13.2-1.4-11c-.2-1.3.4-2.2 1-2.9z" />
      <path d="M22.6 36.4h19.8c5.6 0 10.6 2.2 10.6 4.8s-9.4 5.6-21 5.6-21-3-21-5.6 6-4.8 11.6-4.8z" />
      <path d="M13.6 40.6c3.2-1.6 10-2.6 18.4-2.6s15.2 1 18.4 2.6c-3.2 1.8-10.2 3-18.4 3s-15.2-1.2-18.4-3z" fill="#fff" opacity=".25" />
      <path d="M28.4 25.6c1.8-.4 3.4.6 4.6 2.2.4.6-.2 1.4-.9 1.1-1.4-.6-2.8-.8-4-.4-.8.2-1.2-1-.6-1.5z" fill="#fff" opacity=".5" />
      <ellipse cx="29.6" cy="21.4" rx="1.7" ry="2.2" fill="#fff" opacity=".55" />
    </>
  ),

  // — Les quatre pions dorés de la boîte Poudlard —————————————————
  // Des emblèmes, pas des portraits : chaque personnage est évoqué par l'objet
  // qui lui est propre, ce qui reste lisible à 14 px sur une case.

  // Harry : lunettes rondes et éclair.
  harry: (
    <>
      <path d="M6 32c0-5 4.4-9 10-9s10 4 10 9-4.4 9-10 9-10-4-10-9zm10-5.4c-3.6 0-6.4 2.4-6.4 5.4s2.8 5.4 6.4 5.4 6.4-2.4 6.4-5.4-2.8-5.4-6.4-5.4z" />
      <path d="M38 32c0-5 4.4-9 10-9s10 4 10 9-4.4 9-10 9-10-4-10-9zm10-5.4c-3.6 0-6.4 2.4-6.4 5.4s2.8 5.4 6.4 5.4 6.4-2.4 6.4-5.4-2.8-5.4-6.4-5.4z" transform="translate(-16)" />
      <rect x="25.4" y="30" width="7.2" height="3" rx="1.5" />
      <path d="M34 6l-9 16h6.4l-3.4 14 11-18h-6.6l4.6-12z" />
    </>
  ),

  // Hermione : un livre ouvert et sa baguette.
  hermione: (
    <>
      <path d="M8 20c6-3.6 12-4.6 18-3v25c-6-1.6-12-.6-18 3z" />
      <path d="M56 20c-6-3.6-12-4.6-18-3v25c6-1.6 12-.6 18 3z" />
      <rect x="29.6" y="16" width="4.8" height="30" rx="2.4" />
      <g stroke="#fff" strokeWidth="1.2" opacity=".4" fill="none">
        <path d="M12 25h9M12 30h9M12 35h9M43 25h9M43 30h9M43 35h9" />
      </g>
      <path d="M46 4.4c.8-.8 2-.8 2.8 0s.8 2 0 2.8L36.6 19.4l-2.8-2.8z" />
    </>
  ),

  // Ron : le cavalier d'échecs de la partie grandeur nature.
  ron: (
    <>
      <path d="M20 52h26c1 0 1.8.8 1.8 1.8v2.4c0 1-.8 1.8-1.8 1.8H20c-1 0-1.8-.8-1.8-1.8v-2.4c0-1 .8-1.8 1.8-1.8z" />
      <path d="M22 48c0-6 2.4-9.6 6.4-13.2l-3.6-1.4c-1.2-.5-1.4-2-.4-2.8l5.2-4L27 20.4c-.6-1 .2-2.2 1.4-2l4 .8L34 12c.3-1.3 2-1.6 2.7-.4 3 4.8 7.3 8 7.3 14.4 0 4.8-1.6 8-3.6 11.2-1.8 2.9-2.4 6.4-2.4 10.8z" />
      <circle cx="36" cy="24" r="1.9" fill="#fff" opacity=".8" />
      <path d="M29 30l6-2.4" stroke="#fff" strokeWidth="1.4" opacity=".35" fill="none" />
    </>
  ),

  // Drago : le serpent lové de sa maison.
  drago: (
    <>
      <path d="M32 8c11 0 20 7.2 20 16.6 0 8-6 13.4-14 13.4-6 0-10-3.4-10-8 0-3.6 2.6-6.2 6.4-6.2 3 0 5.2 1.8 5.2 4.2 0 1.9-1.4 3.2-3.2 3.2-1.4 0-2.4-.9-2.4-2 0-.9.6-1.5 1.4-1.5.6 0 1 .3 1.2.8-.6-1.4-2-2.3-3.8-2.3-2.6 0-4.4 1.8-4.4 4.4 0 3.4 3 6 7.4 6 5.9 0 10.4-4.1 10.4-10.2C46.4 19 40 13.6 32 13.6S17.6 19 17.6 26.4c0 12 9.4 21 22.4 25.4.9.3.7 1.7-.3 1.7-16.6-.6-28-11-28-25.5C11.7 16.4 20.8 8 32 8z" />
      <circle cx="42" cy="20" r="1.8" fill="#fff" opacity=".75" />
    </>
  ),

  // — Avengers ————————————————————————————————————————

  // Marteau : tête rectangulaire massive et manche sanglé.
  marteau: (
    <>
      <path d="M16 12h32c1.7 0 3 1.3 3 3v14c0 1.7-1.3 3-3 3H16c-1.7 0-3-1.3-3-3V15c0-1.7 1.3-3 3-3z" />
      <rect x="13" y="18" width="38" height="3.6" fill="#fff" opacity=".3" />
      <rect x="19" y="15.4" width="4" height="13.2" rx="1.4" fill="#fff" opacity=".22" />
      <rect x="41" y="15.4" width="4" height="13.2" rx="1.4" fill="#fff" opacity=".22" />
      <rect x="28.4" y="32" width="7.2" height="21" rx="1.6" />
      <path d="M27.6 49.4h8.8c.7 0 1.2.6 1.2 1.3l-.4 3.4c-.1.7-.7 1.2-1.4 1.2h-7.6c-.7 0-1.3-.5-1.4-1.2l-.4-3.4c0-.7.5-1.3 1.2-1.3z" />
      <g fill="#fff" opacity=".35">
        <rect x="28.4" y="36" width="7.2" height="1.6" />
        <rect x="28.4" y="41" width="7.2" height="1.6" />
      </g>
    </>
  ),

  // Bouclier : disque à anneaux concentriques et étoile centrale.
  bouclier: (
    <>
      <circle cx="32" cy="32" r="22" />
      <circle cx="32" cy="32" r="17" fill="#fff" opacity=".28" />
      <circle cx="32" cy="32" r="12" />
      <circle cx="32" cy="32" r="7.6" fill="#fff" opacity=".28" />
      <path d="M32 25l1.9 4.2 4.6.5-3.4 3.1 1 4.5-4.1-2.3-4.1 2.3 1-4.5-3.4-3.1 4.6-.5z" fill="#fff" opacity=".9" />
    </>
  ),

  // Casque : plastron facial et fentes lumineuses.
  casque: (
    <>
      <path d="M32 10c9.4 0 15 6 15 15.4 0 7-1.4 13.6-4 19.4-1.4 3.2-4 5.2-7.4 5.2h-7.2c-3.4 0-6-2-7.4-5.2-2.6-5.8-4-12.4-4-19.4C17 16 22.6 10 32 10z" />
      <path d="M21.6 27.4c2.6-1.6 6-2.4 10.4-2.4s7.8.8 10.4 2.4l-1.4 5c-.3 1-1.4 1.5-2.3 1l-5-2.4c-1-.5-2.3-.5-3.3 0l-5 2.4c-1 .5-2-.0-2.3-1z" fill="#fff" opacity=".85" />
      <path d="M25.6 39h12.8c.9 0 1.5.8 1.3 1.7l-.6 2.6c-.2.8-.9 1.3-1.7 1.3h-10.8c-.8 0-1.5-.5-1.7-1.3l-.6-2.6c-.2-.9.4-1.7 1.3-1.7z" fill="#fff" opacity=".35" />
      <path d="M22.4 13.6C25 11.4 28.2 10.4 32 10.4s7 1 9.6 3.2c-2.8 1.4-6 2.1-9.6 2.1s-6.8-.7-9.6-2.1z" fill="#fff" opacity=".22" />
    </>
  ),

  // Gantelet : gant fermé, six pierres serties sur le dos.
  gantelet: (
    <>
      <path d="M20 24h20c2.8 0 5 2.2 5 5v13c0 5-4 9-9 9h-9c-5 0-9-4-9-9V29c0-2.8 2.2-5 5-5z" />
      <path d="M22 14.6c0-1.4 1.2-2.6 2.6-2.6s2.6 1.2 2.6 2.6V24H22zM29 12.6c0-1.4 1.2-2.6 2.6-2.6s2.6 1.2 2.6 2.6V24H29zM36 15.6c0-1.4 1.2-2.6 2.6-2.6s2.6 1.2 2.6 2.6V24H36z" />
      <path d="M45 27.6c2.6 0 4.6 2.1 4.6 4.7S47.6 37 45 37z" />
      <g fill="#fff" opacity=".85">
        <circle cx="25.5" cy="31.5" r="2.1" />
        <circle cx="32" cy="30.5" r="2.1" />
        <circle cx="38.5" cy="31.5" r="2.1" />
        <circle cx="25.5" cy="38.5" r="2.1" />
        <circle cx="32" cy="37.5" r="2.1" />
        <circle cx="38.5" cy="38.5" r="2.1" />
      </g>
    </>
  ),

  // Arc : arc bandé et flèche encochée.
  arc: (
    <>
      <path d="M44 8c.9-.5 1.9.4 1.5 1.4C42.9 16.3 41.4 24 41.4 32s1.5 15.7 4.1 22.6c.4 1-.6 1.9-1.5 1.4-7.4-4.3-12.3-13.4-12.3-24s4.9-19.7 12.3-24zm-2.6 6.9C36.9 19.4 34.2 25.4 34.2 32s2.7 12.6 7.2 17.1A56 56 0 0138.6 32c0-6 .9-11.7 2.8-17.1z" />
      <path d="M44.6 10.6c.7-.3 1.4.5 1 1.1L38 24.4l-1.8-1.5zM44.6 53.4c.7.3 1.4-.5 1-1.1L38 39.6l-1.8 1.5z" opacity=".8" />
      <rect x="12" y="30.6" width="26" height="2.8" rx="1.4" />
      <path d="M38 28l6.4 4-6.4 4z" />
      <path d="M12.4 28.4l3.6 3.6-3.6 3.6-2.8-2.6c-.6-.6-.6-1.4 0-2z" fill="#fff" opacity=".5" />
    </>
  ),

  // Quinjet : appareil vu de dessus, ailes en flèche et double dérive.
  quinjet: (
    <>
      <path d="M32 7c2.4 0 4.4 2.6 5.2 6.6l1.6 8.4 14.4 9.6c.9.6 1.4 1.6 1.4 2.6v3.4c0 1-.9 1.7-1.9 1.4L39.4 35l-.6 8.6 5.4 4.6c.5.4.8 1 .8 1.7v2.4c0 .9-.9 1.6-1.8 1.3L32 50.4l-11.2 3.2c-.9.3-1.8-.4-1.8-1.3v-2.4c0-.7.3-1.3.8-1.7l5.4-4.6-.6-8.6-13.3 4c-1 .3-1.9-.4-1.9-1.4v-3.4c0-1 .5-2 1.4-2.6l14.4-9.6 1.6-8.4C27.6 9.6 29.6 7 32 7z" />
      <path d="M32 12.6c1 0 1.9 1.4 2.3 3.6l1 5.4h-6.6l1-5.4c.4-2.2 1.3-3.6 2.3-3.6z" fill="#fff" opacity=".45" />
      <rect x="29.4" y="27" width="5.2" height="12" rx="2.6" fill="#fff" opacity=".28" />
    </>
  ),

  // — Monopoly Spider-Man ————————————————————————————————
  // Masque : ovale à grands yeux cernés, quadrillage de toile en réserve.
  masque: (
    <>
      <path d="M32 10c11 0 19 8.6 19 20 0 10.6-8 21-19 24-11-3-19-13.4-19-24 0-11.4 8-20 19-20z" />
      <path d="M24 25c3.4-2.4 7.6-2.2 9.6.4 1.2 1.6.7 3.8-1 5.4-2.8 2.6-7.6 3-10 .6-1.6-1.6-1.2-4.6 1.4-6.4z" fill="#fff" opacity=".85" />
      <path d="M40 25c-3.4-2.4-7.6-2.2-9.6.4-1.2 1.6-.7 3.8 1 5.4 2.8 2.6 7.6 3 10 .6 1.6-1.6 1.2-4.6-1.4-6.4z" fill="#fff" opacity=".85" />
      <g stroke="#fff" strokeWidth="1" opacity=".3" fill="none">
        <path d="M32 12v40M15 26h34M17 36h30M21 45h22" />
      </g>
    </>
  ),

  // Toile : rayons et arcs, comme une toile tendue dans un angle.
  toile: (
    <>
      <circle cx="32" cy="32" r="3.4" />
      <g stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d="M32 32L32 8M32 32L53 20M32 32L53 44M32 32L32 56M32 32L11 44M32 32L11 20" />
      </g>
      <g stroke="currentColor" strokeWidth="2" fill="none" opacity=".85">
        <path d="M32 14l11 6.4v13.2L32 40l-11-6.4V20.4z" />
        <path d="M32 8L53 20v24L32 56 11 44V20z" />
      </g>
    </>
  ),

  // Araignée : corps compact, huit pattes repliées.
  araignee: (
    <>
      <ellipse cx="32" cy="36" rx="9" ry="11" />
      <circle cx="32" cy="23" r="6" />
      <g stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round">
        <path d="M23 30c-5-1-8-4-9-9M23 36c-6 0-10 2-12 6M41 30c5-1 8-4 9-9M41 36c6 0 10 2 12 6" />
        <path d="M24 42c-4 2-6 5-7 9M40 42c4 2 6 5 7 9" />
      </g>
      <circle cx="29.6" cy="22" r="1.5" fill="#fff" opacity=".8" />
      <circle cx="34.4" cy="22" r="1.5" fill="#fff" opacity=".8" />
    </>
  ),

  // Appareil photo : boîtier, objectif, viseur — celui de Peter au Bugle.
  camera: (
    <>
      <path d="M12 22h9l3.2-4.6c.5-.7 1.3-1.1 2.2-1.1h11.2c.9 0 1.7.4 2.2 1.1L43 22h9c1.7 0 3 1.3 3 3v20c0 1.7-1.3 3-3 3H12c-1.7 0-3-1.3-3-3V25c0-1.7 1.3-3 3-3z" />
      <circle cx="32" cy="35" r="10" fill="#fff" opacity=".28" />
      <circle cx="32" cy="35" r="6" fill="#fff" opacity=".55" />
      <rect x="45" y="26" width="6" height="3.4" rx="1.4" fill="#fff" opacity=".5" />
    </>
  ),

  // Planeur : aile en chauve-souris, celle du Bouffon.
  planeur: (
    <>
      <path d="M32 44c-9 0-17-4-22-11 6 1.6 10-1 12-6 2.4 4 5 6 10 6s7.6-2 10-6c2 5 6 7.6 12 6-5 7-13 11-22 11z" />
      <path d="M28.4 22h7.2c1.2 0 2 1.2 1.6 2.3l-3.6 9.4c-.5 1.3-2.3 1.3-2.8 0l-3.6-9.4c-.4-1.1.4-2.3 1.2-2.3z" fill="#fff" opacity=".35" />
      <path d="M32 44v8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </>
  ),

  // Citrouille : la bombe du Bouffon Vert, pédoncule et sourire découpé.
  citrouille: (
    <>
      <path d="M28 15c1-2.6 5-3 6.6-.6l1.4 2.2-4.4 2.6z" />
      <ellipse cx="32" cy="36" rx="21" ry="18" />
      <g fill="#fff" opacity=".2">
        <ellipse cx="22" cy="36" rx="5" ry="17" />
        <ellipse cx="42" cy="36" rx="5" ry="17" />
      </g>
      <path d="M23 30l6 4-6 3zM41 30l-6 4 6 3z" fill="#fff" opacity=".8" />
      <path d="M22 42c4 4 16 4 20 0-2 5-6 7-10 7s-8-2-10-7z" fill="#fff" opacity=".8" />
    </>
  ),

};

/**
 * @param {{ token: string, color?: string, className?: string, title?: string }} props
 */
export default function TokenIcon({ token, color = 'currentColor', className = '', title }) {
  // Pastille neutre plutôt qu'un chapeau trompeur si l'édition invente un pion
  // qu'on n'a pas encore dessiné.
  const shape = SHAPES[token] ?? <circle cx="32" cy="32" r="18" />;
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
