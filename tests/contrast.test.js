/**
 * Chaque texte doit se lire sur son fond.
 *
 * Le défaut qui a motivé ce fichier : sur les deux boîtes Spider-Man, la fiche
 * de propriété est sombre (`space`) alors que les panneaux sont clairs — et une
 * seule encre servait aux deux. Résultat mesuré : **1,01:1**, soit du texte
 * rigoureusement invisible, sur les cartes comme sur les fiches.
 *
 * Une relecture à l'œil ne rattrape pas ça de façon fiable, et il faudrait la
 * refaire à chaque édition ajoutée. On mesure donc, avec la formule de
 * luminance relative du WCAG, et l'on exige le seuil AA (4,5:1) pour tout ce
 * qui est du texte courant.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { EDITIONS } from '../shared/editions.js';

/** Luminance relative d'une couleur `#rrggbb`, selon la formule WCAG. */
function luminance(hex) {
  const channel = (offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Rapport de contraste entre deux couleurs : de 1:1 (identiques) à 21:1. */
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Les paires fond/encre que l'interface met réellement côte à côte. */
const PAIRS = [
  ['panel', 'ink', 'texte des panneaux'],
  ['panel', 'inkSoft', 'texte secondaire des panneaux'],
  ['panel', 'accent', "l'accent écrit en texte"],
  ['panel', 'money', 'les montants'],
  ['space', 'spaceInk', 'texte des fiches de propriété'],
  ['space', 'spaceInkSoft', 'texte secondaire des fiches'],
  ['board', 'boardInk', 'texte sur le plateau'],
];

const AA = 4.5;

test('toutes les palettes déclarent leurs deux encres', () => {
  for (const [id, edition] of Object.entries(EDITIONS)) {
    const palette = edition.theming?.palette ?? {};
    for (const key of ['ink', 'inkSoft', 'spaceInk', 'spaceInkSoft', 'boardInk']) {
      assert.match(palette[key] ?? '', /^#[0-9a-f]{6}$/i, `${id} : couleur « ${key} » manquante ou mal formée`);
    }
  }
});

test('chaque texte atteint le seuil de lisibilité AA sur son fond', () => {
  const failures = [];
  for (const [id, edition] of Object.entries(EDITIONS)) {
    const palette = edition.theming.palette;
    for (const [background, foreground, what] of PAIRS) {
      const ratio = contrast(palette[background], palette[foreground]);
      if (ratio < AA) {
        failures.push(
          `${id} — ${what} : ${ratio.toFixed(2)}:1 ` +
          `(${foreground}=${palette[foreground]} sur ${background}=${palette[background]})`,
        );
      }
    }
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`);
});

test('une encre de fiche sombre va bien avec un fond de fiche sombre', () => {
  // Le garde-fou qui aurait attrapé le défaut d'origine : `spaceInk` doit être
  // du bon côté de `space`, jamais de la même famille.
  for (const [id, edition] of Object.entries(EDITIONS)) {
    const { space, spaceInk } = edition.theming.palette;
    const fondSombre = luminance(space) < 0.2;
    const encreSombre = luminance(spaceInk) < 0.2;
    assert.notEqual(
      fondSombre,
      encreSombre,
      `${id} : fiche et encre sont toutes deux ${fondSombre ? 'sombres' : 'claires'}`,
    );
  }
});
