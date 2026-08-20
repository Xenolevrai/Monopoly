/**
 * La matière du plateau.
 *
 * Un plateau imprimé n'est pas une surface plate : il a un grain de papier, des
 * bords un peu salis, un filigrane sous les cases, un cadre orné. C'est ça qui
 * fait la différence entre « lisible » et « beau ». Tout est dessiné en SVG et
 * en dégradés — rien à télécharger, la partie tourne toujours hors ligne.
 *
 * Chaque édition choisit sa matière par `theming.skin` :
 *  - `parchment` — la carte au trésor : papier vieilli, encre sépia, filigrane
 *  - `night`     — le château la nuit : bleu profond, dorures, blasons
 *  - `tech`      — l'acier : panneaux sombres, liserés lumineux, trames
 *  - `table`     — le carton vert du Monopoly d'origine
 *  - `web`       — la planche de comics : champ nocturne fendu de rouge et de
 *                  bleu, toile tendue depuis le centre, trame d'impression
 */

/** Grain de papier : un bruit fractal très doux, en multiply. */
export function PaperGrain({ opacity = 0.5, scale = 0.8, seed = 3 }) {
  const id = `grain-${seed}`;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ mixBlendMode: 'multiply', opacity }}
      aria-hidden="true"
    >
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency={scale} numOctaves="4" seed={seed} />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/**
 * Le filigrane de la Carte du Maraudeur : couloirs, escaliers et pas perdus,
 * tracés à l'encre pâle sous le plateau. Dessin original dans cet esprit.
 */
function MaraudersWatermark() {
  const ink = 'rgba(70, 44, 14, 0.34)';
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g fill="none" stroke={ink} strokeWidth="0.34">
        {/* Couloirs : de longues doubles-lignes qui traversent le plateau. */}
        <path d="M4 22 H40 V8 M46 8 V30 H96" />
        <path d="M4 26 H36 V12 M50 12 V34 H96" />
        <path d="M8 92 H34 V64 H62 V92 H92" />
        <path d="M12 88 H30 V60 H66 V88 H88" />
        <path d="M4 52 H22 V72 M78 72 V52 H96" />
        <path d="M30 34 H70 V58 H30 Z" />
        <path d="M34 38 H66 V54 H34 Z" />
        <path d="M4 66 H26 M74 66 H96" />
        <path d="M46 4 V22 M54 4 V22" />
        <path d="M46 96 V78 M54 96 V78" />
        <path d="M18 30 V50 M82 30 V50" />
        {/* Escaliers en colimaçon, deux tours. */}
        <circle cx="20" cy="42" r="7" />
        <circle cx="20" cy="42" r="4.2" />
        <circle cx="80" cy="44" r="6" />
        <circle cx="80" cy="44" r="3.4" />
        <path d="M13 42 h14 M20 35 v14 M75 44 h10 M80 38 v12" strokeWidth="0.2" />
      </g>
      {/* Les pas qui se promènent tout seuls. */}
      <g fill={ink}>
        {[
          [30, 46], [33, 49], [36, 46], [39, 49], [42, 46],
          [58, 78], [61, 75], [64, 78], [67, 75],
          [70, 20], [73, 23], [76, 20],
          [14, 60], [17, 63], [20, 60], [23, 63],
          [86, 62], [83, 65], [80, 62],
          [44, 88], [47, 85], [50, 88], [53, 85],
        ].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="0.9" ry="1.4" transform={`rotate(${i % 2 ? 18 : -18} ${x} ${y})`} />
        ))}
      </g>
    </svg>
  );
}

/** Une trame technique : grille fine et diagonales, pour le plateau d'acier. */
function TechWatermark() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id="tech-grid" width="26" height="26" patternUnits="userSpaceOnUse">
          <path d="M26 0 H0 V26" fill="none" stroke="rgba(150,190,235,0.13)" strokeWidth="0.7" />
        </pattern>
        <pattern id="tech-diag" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(150,190,235,0.07)" strokeWidth="1.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tech-grid)" />
      <rect width="100%" height="100%" fill="url(#tech-diag)" />
    </svg>
  );
}

/**
 * Un ciel de nuit constellé, pour la Grande Salle.
 *
 * Les étoiles sont posées en pourcentage mais dessinées à taille fixe : un
 * `viewBox` étiré sur un plateau carré les transformerait en taches ovales.
 */
function StarWatermark() {
  // Positions figées : un ciel qui scintille au hasard à chaque rendu serait
  // du bruit, pas une décoration.
  const stars = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 150; i++) stars.push([rnd() * 100, rnd() * 100, rnd()]);

  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stars.map(([x, y, r], i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: r > 0.88 ? 2.4 : r > 0.6 ? 1.6 : 1,
            height: r > 0.88 ? 2.4 : r > 0.6 ? 1.6 : 1,
            background: r > 0.8 ? 'rgba(255,246,214,0.95)' : 'rgba(226,232,246,0.65)',
            boxShadow: r > 0.9 ? '0 0 4px rgba(255,240,190,.8)' : 'none',
          }}
        />
      ))}
    </span>
  );
}

/**
 * Une toile d'araignée tendue depuis le centre du plateau.
 *
 * Rayons droits, et entre eux des fils qui pendent — une toile ne fait pas des
 * cercles concentriques, elle fait des arcs qui retombent vers le centre. C'est
 * ce creux qui la rend reconnaissable au premier coup d'œil.
 *
 * Le plateau étant carré, on peut dessiner en coordonnées carrées sans crainte :
 * aucun cercle ne sera écrasé (voir le piège relevé dans CLAUDE.md).
 */
function WebWatermark() {
  const cx = 50;
  const cy = 50;
  const spokes = 16;
  const rings = [11, 20, 30, 41, 53, 65, 78, 92];
  const sag = 0.9; // ce que le fil perd en rayon entre deux rayons

  const point = (angle, radius) => [
    cx + Math.cos(angle) * radius,
    cy + Math.sin(angle) * radius,
  ];

  const rays = [];
  for (let i = 0; i < spokes; i++) {
    const angle = (i / spokes) * Math.PI * 2;
    const [x, y] = point(angle, 96);
    rays.push(`M${cx} ${cy}L${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  const threads = [];
  for (const radius of rings) {
    const parts = [];
    for (let i = 0; i < spokes; i++) {
      const a1 = (i / spokes) * Math.PI * 2;
      const a2 = ((i + 1) / spokes) * Math.PI * 2;
      const [x1, y1] = point(a1, radius);
      const [x2, y2] = point(a2, radius);
      // Le point de contrôle, tiré vers le centre : c'est lui qui fait pendre le fil.
      const [mx, my] = point((a1 + a2) / 2, radius * sag);
      // Seul le premier segment pose le crayon ; les suivants enchaînent depuis
      // le point courant, sinon deux nombres se collent et le chemin est rejeté.
      if (i === 0) parts.push(`M${x1.toFixed(2)} ${y1.toFixed(2)}`);
      parts.push(`Q${mx.toFixed(2)} ${my.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`);
    }
    threads.push(parts.join(''));
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <defs>
        {/* Les fils s'estompent vers les bords : la toile naît du centre. */}
        <radialGradient id="web-fade" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <mask id="web-mask">
          <rect width="100" height="100" fill="url(#web-fade)" />
        </mask>
      </defs>
      <g mask="url(#web-mask)" fill="none" stroke="#dce6ff" strokeLinecap="round">
        <g strokeWidth="0.28" opacity="0.85">
          {rays.map((d, i) => (
            <path key={`ray-${i}`} d={d} />
          ))}
        </g>
        <g strokeWidth="0.22" opacity="0.7">
          {threads.map((d, i) => (
            <path key={`thread-${i}`} d={d} />
          ))}
        </g>
      </g>
    </svg>
  );
}

/**
 * Les deux coins de couleur du plateau imprimé : un pan rouge, un pan bleu,
 * posés en diagonale sous la toile. C'est ce qui donne au champ central son
 * énergie de couverture de comics plutôt qu'un fond uni.
 */
function ComicWedges() {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wedge-red" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff2033" stopOpacity="1" />
            <stop offset="55%" stopColor="#d0121f" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#6d0a14" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="wedge-blue" x1="1" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#2472ff" stopOpacity="1" />
            <stop offset="55%" stopColor="#1546b8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#08194d" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <polygon points="0,0 62,0 0,62" fill="url(#wedge-red)" />
        <polygon points="100,100 38,100 100,38" fill="url(#wedge-blue)" />
      </svg>
    </span>
  );
}

/** La trame d'impression : les points d'une planche de comics, en très discret. */
function Halftone() {
  return (
    <span
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style={{
        backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,.5) 0.7px, transparent 0.9px)',
        backgroundSize: '5px 5px',
        opacity: 0.14,
        mixBlendMode: 'overlay',
      }}
    />
  );
}

/** Le décor de fond, propre à la matière de l'édition. */
export function BoardWatermark({ skin }) {
  if (skin === 'parchment') return <MaraudersWatermark />;
  if (skin === 'tech') return <TechWatermark />;
  if (skin === 'night') return <StarWatermark />;
  if (skin === 'web') {
    return (
      <>
        <ComicWedges />
        <WebWatermark />
        <Halftone />
      </>
    );
  }
  return null;
}

/**
 * Le cadre : un liseré ouvragé le long des quatre bords, plus les coins.
 * C'est ce qui fait « objet imprimé » plutôt que « div avec une bordure ».
 */
export function BoardFrame({ skin }) {
  const gold = skin === 'night' || skin === 'parchment';
  const stroke = gold
    ? 'rgba(190,150,70,0.65)'
    : skin === 'web'
      ? 'rgba(226,32,52,0.75)'
      : 'rgba(150,190,235,0.3)';

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect x="0.7" y="0.7" width="98.6" height="98.6" fill="none" stroke={stroke} strokeWidth="0.45" />
      <rect x="1.8" y="1.8" width="96.4" height="96.4" fill="none" stroke={stroke} strokeWidth="0.18" />
    </svg>
  );
}

/** Ombre intérieure et vignetage : le plateau se creuse légèrement. */
export function BoardVignette() {
  return (
    <span
      className="pointer-events-none absolute inset-0"
      style={{
        boxShadow: 'inset 0 0 90px rgba(0,0,0,.34), inset 0 0 22px rgba(0,0,0,.22)',
      }}
      aria-hidden="true"
    />
  );
}
