/**
 * La peau de l'édition en cours.
 *
 * Chaque édition décrit sa palette dans son `edition.json` ; on l'écrit ici en
 * variables CSS sur la racine du document. Tous les composants lisant déjà ces
 * variables, changer de boîte repeint tout d'un coup — le bois de la table, le
 * carton du plateau, l'encre, les fiches — sans qu'aucun composant ne sache
 * quelle édition est en cours.
 */
import { useEffect } from 'react';
import { editionFor } from './board.js';

/** `boardEdge` → `--color-board-edge` */
function cssName(key) {
  return `--color-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/**
 * Les familles de titres. Une édition choisit un caractère, pas une police
 * précise : on garde ainsi la maîtrise de ce qui est réellement embarqué.
 */
const DISPLAY_FAMILIES = {
  serif: "'Cormorant Garamond', Georgia, serif",
  engraved: "'Cormorant Garamond', 'Palatino Linotype', Georgia, serif",
  condensed: "'Oswald', 'Inter Variable', system-ui, sans-serif",
};

/** Les lettrages de case : plus resserré sur les plateaux sombres. */
const TILE_FAMILIES = {
  serif: "'Oswald', system-ui, sans-serif",
  engraved: "'Cormorant Garamond', Georgia, serif",
  condensed: "'Oswald', system-ui, sans-serif",
};

export function useEditionTheme(state) {
  const edition = editionFor(state);
  const theming = edition.theming ?? {};
  // On dépend de l'identifiant, pas de l'objet : l'état change à chaque action,
  // et repeindre la racine à chaque coup de dés serait du gâchis.
  const editionId = edition.id;

  useEffect(() => {
    const root = document.documentElement;
    const applied = [];

    for (const [key, value] of Object.entries(theming.palette ?? {})) {
      const name = cssName(key);
      root.style.setProperty(name, value);
      applied.push(name);
    }

    const display = theming.display ?? 'serif';
    root.style.setProperty('--font-display', DISPLAY_FAMILIES[display] ?? DISPLAY_FAMILIES.serif);
    root.style.setProperty('--font-tile', TILE_FAMILIES[display] ?? TILE_FAMILIES.serif);
    applied.push('--font-display', '--font-tile');

    // En quittant une partie, on rend la main au thème par défaut plutôt que de
    // laisser traîner les couleurs de l'édition précédente sur l'accueil.
    return () => applied.forEach((name) => root.style.removeProperty(name));
  }, [editionId]);
}
