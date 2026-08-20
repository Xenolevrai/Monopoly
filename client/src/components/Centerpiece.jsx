/**
 * La pièce maîtresse au centre du plateau.
 *
 * Sur une vraie boîte, c'est elle qu'on voit d'abord : le blason et sa banderole
 * sur la Carte du Maraudeur, le château sous les étoiles, le « A » des Avengers.
 * Chaque édition a la sienne, dessinée ici en SVG d'après l'esprit de sa boîte —
 * ce sont des dessins originaux, aucune image de la marque n'est reprise.
 */

/**
 * Blason à quatre quartiers et banderole : l'identité des éditions sorcières.
 * Les quatre animaux sont suggérés par des silhouettes simples, lisibles petites.
 */
function CrestBanner({ title, subtitle, ink = '#3a2410', ribbon = '#a8232b', accent = '#8a6a28' }) {
  return (
    <svg viewBox="0 0 320 300" className="h-full w-full" role="img" aria-label={title}>
      {/* L'écu, divisé en quatre quartiers, chacun avec son animal. */}
      <g transform="translate(0 4)">
        <path
          d="M160 10 L268 38 v78c0 54-42 92-108 116-66-24-108-62-108-116V38z"
          fill="#f0e2bf"
          stroke={ink}
          strokeWidth="4"
        />
        {/* Quartiers : rouge et vert en haut, bleu et jaune en bas. */}
        <path d="M160 14 L264 41 v75c0 20-6 37-18 52H160z" fill="#7f0909" opacity=".9" />
        <path d="M160 14 L56 41 v75c0 20 6 37 18 52h86z" fill="#1a472a" opacity=".9" />
        <path d="M74 168h86v66c-34-13-63-32-82-53z" fill="#0e1a40" opacity=".9" />
        <path d="M246 168h-86v66c34-13 63-32 82-53z" fill="#c8a017" opacity=".9" />
        <path
          d="M160 10 L268 38 v78c0 54-42 92-108 116-66-24-108-62-108-116V38z"
          fill="none"
          stroke={ink}
          strokeWidth="4"
        />
        <path d="M160 14 v220 M56 168 h208" stroke={ink} strokeWidth="2.6" opacity=".6" />

        {/* Lion — quartier haut gauche. */}
        <g transform="translate(84 70)">
          <circle cx="26" cy="26" r="21" fill="#f2e3bd" />
          <circle cx="26" cy="26" r="13.5" fill="#1a472a" />
          <path d="M26 17c5.4 0 9.5 4.2 9.5 8.6S31.4 34 26 34s-9.5-4-9.5-8.4S20.6 17 26 17z" fill="#f2e3bd" />
          <circle cx="21.8" cy="24" r="1.7" fill="#1a472a" />
          <circle cx="30.2" cy="24" r="1.7" fill="#1a472a" />
          <path d="M26 27.5l-2.4 3h4.8z" fill="#1a472a" />
        </g>
        {/* Serpent — quartier haut droit. */}
        <g transform="translate(180 68)">
          <path
            d="M12 50c-2-18 8-32 24-32 12 0 20 8 20 17 0 8-6 13-13 13-6 0-10-4-10-8 0-3.4 2.4-6 5.6-6"
            fill="none"
            stroke="#f2e3bd"
            strokeWidth="5.4"
            strokeLinecap="round"
          />
          <circle cx="46" cy="30" r="2.6" fill="#f2e3bd" />
        </g>
        {/* Blaireau — quartier bas gauche. */}
        <g transform="translate(101 176) scale(0.78)">
          <ellipse cx="26" cy="22" rx="21" ry="16" fill="#f2e3bd" />
          <path d="M26 6c-3.4 0-5.6 3.4-5.6 9s2.2 13 5.6 13 5.6-7.4 5.6-13-2.2-9-5.6-9z" fill="#0e1a40" opacity=".85" />
          <circle cx="16" cy="19" r="2.2" fill="#0e1a40" />
          <circle cx="36" cy="19" r="2.2" fill="#0e1a40" />
        </g>
        {/* Aigle — quartier bas droit. */}
        <g transform="translate(186 174) scale(0.72)" fill="#3a2410">
          <path d="M30 4c4.4 0 7.6 4.2 7.6 9.6v6.2l19.4-6.4c2.2-.7 3.9 1.7 2.2 3.2l-17.2 12.8 15 4.3c2.2.6 1.7 3.6-.6 3.6H32.2L30 45l-2.2-11.7H9.6c-2.3 0-2.8-3-.6-3.6l15-4.3L6.8 16.6c-1.7-1.5 0-3.9 2.2-3.2L28.4 19.8v-6.2C28.4 8.2 25.6 4 30 4z" />
        </g>
      </g>

      {/* La banderole, posée SOUS l'écu — comme sur la boîte. */}
      <g transform="translate(0 232)">
        <path d="M8 6 h304 l-24 22 24 22H8l24-22z" fill={ribbon} stroke={ink} strokeWidth="3.4" />
        <path d="M8 6 l24 22-24 22z" fill="#000" opacity=".25" />
        <path d="M312 6 l-24 22 24 22z" fill="#000" opacity=".25" />
        <text
          x="160"
          y="37"
          textAnchor="middle"
          fill="#fdf6e6"
          style={{ font: '700 27px "Cormorant Garamond", Georgia, serif', letterSpacing: '6px' }}
        >
          {title}
        </text>
      </g>

      {subtitle && (
        <text
          x="160"
          y="296"
          textAnchor="middle"
          fill={accent}
          style={{ font: '600 13px "Cormorant Garamond", Georgia, serif', letterSpacing: '5px' }}
        >
          {subtitle}
        </text>
      )}
    </svg>
  );
}

/** Le château sous les étoiles : silhouette de tours et de toits pointus. */
function CastleScene({ title, subtitle }) {
  return (
    <svg viewBox="0 0 340 220" className="h-full w-full" role="img" aria-label={title}>
      <defs>
        <linearGradient id="cast-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(211,166,37,0.42)" />
          <stop offset="100%" stopColor="rgba(211,166,37,0)" />
        </linearGradient>
      </defs>

      <ellipse cx="170" cy="196" rx="150" ry="52" fill="url(#cast-glow)" />
      <circle cx="300" cy="30" r="15" fill="#f6ecc9" opacity=".92" />
      <circle cx="294" cy="25" r="13" fill="#0a1128" />

      {/* Les tours, de la plus basse à la plus haute. */}
      <g fill="#080d1d">
        <path d="M18 196 v-52 h30 v52z M33 144 l-16 -22 h32z" />
        <path d="M56 196 v-74 h26 v74z M69 122 l-15 -24 h30z" />
        <path d="M92 196 v-96 h34 v96z M109 100 l-19 -30 h38z" />
        <path d="M132 196 v-124 h44 v124z M154 72 l-24 -38 h48z" />
        <path d="M182 196 v-104 h32 v104z M198 92 l-18 -32 h36z" />
        <path d="M220 196 v-84 h30 v84z M235 112 l-17 -26 h34z" />
        <path d="M256 196 v-62 h28 v62z M270 134 l-16 -24 h32z" />
        <path d="M290 196 v-44 h30 v44z M305 152 l-16 -20 h32z" />
        <rect x="10" y="192" width="320" height="12" />
      </g>

      {/* Fenêtres éclairées. */}
      <g fill="#f2c75c">
        {[
          [28, 160], [40, 172], [64, 138], [72, 158], [100, 118], [112, 140], [118, 166],
          [142, 92], [156, 112], [166, 138], [148, 160], [190, 110], [202, 134], [196, 160],
          [228, 130], [240, 152], [264, 150], [276, 168], [298, 168],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="5" height="7" rx="2.5" opacity={i % 3 ? 0.9 : 0.55} />
        ))}
      </g>

      <text
        x="170"
        y="40"
        textAnchor="middle"
        fill="#f3e7cc"
        style={{ font: '700 34px "Cormorant Garamond", Georgia, serif', letterSpacing: '7px' }}
      >
        {title}
      </text>
      {subtitle && (
        <text
          x="170"
          y="68"
          textAnchor="middle"
          fill="#d3a625"
          style={{ font: '600 13px "Cormorant Garamond", Georgia, serif', letterSpacing: '4px' }}
        >
          {subtitle}
        </text>
      )}
    </svg>
  );
}

/** L'emblème d'acier : un « A » anguleux sur panneaux techniques. */
function TechEmblem({ title, subtitle }) {
  return (
    <svg viewBox="0 0 320 220" className="h-full w-full" role="img" aria-label={title}>
      <defs>
        <linearGradient id="tech-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8b845" />
          <stop offset="55%" stopColor="#c8912a" />
          <stop offset="100%" stopColor="#8a5f12" />
        </linearGradient>
        <linearGradient id="tech-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(120,160,205,0.16)" />
          <stop offset="100%" stopColor="rgba(120,160,205,0.02)" />
        </linearGradient>
      </defs>

      <rect x="14" y="14" width="292" height="192" rx="4" fill="url(#tech-plate)" stroke="rgba(150,190,235,0.25)" />
      {/* Coins coupés, façon panneau blindé. */}
      <g fill="none" stroke="rgba(150,190,235,0.5)" strokeWidth="2">
        <path d="M14 44 V22 a8 8 0 018-8 h22" />
        <path d="M306 44 V22 a8 8 0 00-8-8 h-22" />
        <path d="M14 176 v22 a8 8 0 008 8 h22" />
        <path d="M306 176 v22 a8 8 0 01-8 8 h-22" />
      </g>

      {/* Le « A » : deux jambages et sa barre, coupés en biseau. */}
      <g transform="translate(160 118)">
        <path
          d="M-52 62 L-8 -58 h16 L52 62 h-26 l-9-26h-34l-9 26z M-28 14 h34 L-3 -30z"
          fill="url(#tech-a)"
          stroke="#f4e2a8"
          strokeWidth="1.6"
        />
        {/* L'arc qui prolonge la barre, comme sur la boîte. */}
        <path d="M-40 24 a48 34 0 0090 0" fill="none" stroke="url(#tech-a)" strokeWidth="7" strokeLinecap="round" />
      </g>

      <text
        x="160"
        y="42"
        textAnchor="middle"
        fill="#e9eef4"
        style={{ font: '500 26px Oswald, system-ui, sans-serif', letterSpacing: '9px' }}
      >
        {title}
      </text>
      {subtitle && (
        <text
          x="160"
          y="196"
          textAnchor="middle"
          fill="rgba(220,229,239,0.75)"
          style={{ font: '400 12px Oswald, system-ui, sans-serif', letterSpacing: '6px' }}
        >
          {subtitle}
        </text>
      )}
    </svg>
  );
}

/** La bannière rouge du Monopoly d'origine, posée en diagonale. */
function ClassicBanner({ title, subtitle }) {
  return (
    <div className="-rotate-[45deg]">
      <div className="border-y-2 border-ink bg-[var(--color-accent)] px-8 py-1.5 shadow-[0_3px_0_rgba(0,0,0,.35)]">
        <p className="font-condensed text-3xl uppercase tracking-[0.18em] text-[#f7f4ea]">{title}</p>
      </div>
      <p
        className="mt-1 text-center font-condensed text-[11px] uppercase tracking-[0.45em] opacity-75"
        style={{ color: 'var(--color-board-ink)' }}
      >
        {subtitle}
      </p>
    </div>
  );
}

/**
 * Le cartouche de la boîte Spider-Man : la plaque rouge MONOPOLY posée sur un
 * panneau de toile, le titre en dessous, et le masque au regard blanc.
 *
 * Tout est dessiné ici : aucune image de marque n'est reprise, c'est une
 * composition originale dans l'esprit d'une couverture de comics.
 */
function SpiderEmblem({ title, subtitle }) {
  // Une toile de fond serrée, propre au cartouche (celle du plateau est plus
  // large et passerait inaperçue derrière un panneau opaque).
  const spokes = 12;
  const rays = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    rays.push(`M100 62L${(100 + Math.cos(a) * 130).toFixed(1)} ${(62 + Math.sin(a) * 130).toFixed(1)}`);
  }

  return (
    <svg viewBox="0 0 200 124" className="w-full" role="img" aria-label={`${title} ${subtitle}`}>
      <defs>
        <linearGradient id="sp-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0303f" />
          <stop offset="100%" stopColor="#b30d1c" />
        </linearGradient>
        {/* Le titre de la boîte : rouge vif qui s'assombrit vers le bas, cerclé
            de bleu — c'est ce contour bleu qui le distingue d'un logo Avengers. */}
        <linearGradient id="sp-title" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff5a63" />
          <stop offset="45%" stopColor="#e2142a" />
          <stop offset="100%" stopColor="#9c0a18" />
        </linearGradient>
        <radialGradient id="sp-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#2b4fa8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0a0f22" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="200" height="124" rx="4" fill="#0b1024" opacity="0.72" />
      <rect x="0" y="0" width="200" height="124" rx="4" fill="url(#sp-glow)" />
      <g stroke="#8fa8e8" strokeWidth="0.5" opacity="0.3" fill="none">
        {rays.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <circle cx="100" cy="62" r="26" />
        <circle cx="100" cy="62" r="44" />
        <circle cx="100" cy="62" r="64" />
      </g>

      {/* La plaque rouge du logo, avec son liseré blanc. */}
      <g>
        <rect x="26" y="16" width="148" height="34" rx="2" fill="url(#sp-plate)" stroke="#ffffff" strokeWidth="1.6" />
        <text
          x="100"
          y="41"
          textAnchor="middle"
          fill="#ffffff"
          style={{ font: "700 25px 'Oswald', system-ui, sans-serif", letterSpacing: '1.5px' }}
        >
          {title.toUpperCase()}
        </text>
      </g>

      {/* Le masque : ovale, grands yeux cernés, quadrillage de toile. */}
      <g transform="translate(100 78)">
        <path d="M0-19c11 0 19 8 19 19 0 11-8 20-19 24-11-4-19-13-19-24 0-11 8-19 19-19z" fill="#c8202e" stroke="#ffffff" strokeWidth="1" />
        <path d="M-14-3c3.5-2.6 8.4-2.4 10.6.4 1.3 1.7.6 4.1-1.4 5.8-3.2 2.8-8.6 3.2-11 .5C-17.4 1.9-16.8-1 -14-3z" fill="#ffffff" />
        <path d="M14-3c-3.5-2.6-8.4-2.4-10.6.4-1.3 1.7-.6 4.1 1.4 5.8 3.2 2.8 8.6 3.2 11 .5C17.4 1.9 16.8-1 14-3z" fill="#ffffff" />
        <g stroke="#7d0d18" strokeWidth="0.5" opacity="0.55" fill="none">
          <path d="M0-19v43M-18-4h36M-16 6h32M-11 15h22" />
        </g>
      </g>

      {subtitle && (
        <text
          x="100"
          y="118"
          textAnchor="middle"
          fill="url(#sp-title)"
          stroke="#1d5fd8"
          strokeWidth="1.1"
          paintOrder="stroke"
          strokeLinejoin="round"
          style={{ font: "700 19px 'Oswald', system-ui, sans-serif", letterSpacing: '3.5px' }}
        >
          {subtitle.toUpperCase()}
        </text>
      )}
    </svg>
  );
}

/**
 * La pièce maîtresse de l'édition en cours.
 * @param {{ skin: string, title: string, subtitle: string }} props
 */
export default function Centerpiece({ skin, title, subtitle }) {
  if (skin === 'parchment') {
    return (
      <div className="w-[46%]">
        <CrestBanner title={title} subtitle={subtitle} />
      </div>
    );
  }
  if (skin === 'night') {
    return (
      <div className="w-[66%]">
        <CastleScene title={title} subtitle={subtitle} />
      </div>
    );
  }
  if (skin === 'tech') {
    return (
      <div className="w-[60%]">
        <TechEmblem title={title} subtitle={subtitle} />
      </div>
    );
  }
  if (skin === 'web') {
    return (
      <div className="w-[62%]">
        <SpiderEmblem title={title} subtitle={subtitle} />
      </div>
    );
  }
  return <ClassicBanner title={title} subtitle={subtitle} />;
}
