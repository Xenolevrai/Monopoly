#!/usr/bin/env node
/**
 * Ce que racontent les parties déjà jouées.
 *
 *   node scripts/stats-archives.mjs
 *
 * Lit `data/archives/*.jsonl` et en sort un résumé. Sert à deux choses : voir
 * si les bots tiennent la route en conditions réelles, et vérifier qu'on a
 * assez de matière avant d'en tirer la moindre conclusion.
 *
 * ⚠️ **Le hasard pèse énormément au Monopoly.** Un expert qui perd contre un
 * facile sur dix parties, c'est normal. Ce script affiche donc toujours le
 * nombre de parties à côté d'un pourcentage, et refuse de commenter en dessous
 * de trente.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.MONOPOLY_ARCHIVE_DIR ?? path.join(HERE, '..', 'data', 'archives');

/** Assez de parties pour que le hasard se dilue un peu. */
const SEUIL_CONFIANCE = 30;

async function readAll() {
  let files;
  try {
    files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.jsonl')).sort();
  } catch {
    return [];
  }
  const games = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(DIR, file), 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        games.push(JSON.parse(line));
      } catch {
        console.warn(`  ligne illisible dans ${file}, ignorée`);
      }
    }
  }
  return games;
}

function pct(n, total) {
  return total ? `${((n / total) * 100).toFixed(1)} %` : '—';
}

const games = await readAll();

if (!games.length) {
  console.log(`Aucune partie archivée dans ${DIR}.`);
  console.log('Jouez quelques parties : chaque partie terminée y ajoute une ligne.');
  process.exit(0);
}

console.log(`\n${games.length} partie(s) archivée(s) — ${DIR}\n`);

// — Combien de matière, et de quelle qualité ————————————————
const complete = games.filter((g) => !g.partial);
const decisions = games.reduce((n, g) => n + (g.decisions?.length ?? 0), 0);
console.log(`Décisions enregistrées : ${decisions.toLocaleString('fr-FR')}`);
if (complete.length < games.length) {
  console.log(
    `⚠️  ${games.length - complete.length} partie(s) sans décisions (reprises après un ` +
    `redémarrage) : à écarter pour l'entraînement.`,
  );
}

// — Qui gagne, par niveau ————————————————————————————
const parNiveau = new Map();
for (const game of games) {
  for (const player of game.players ?? []) {
    const key = player.bot ?? 'humaine';
    const row = parNiveau.get(key) ?? { jouees: 0, gagnees: 0, faillites: 0, patrimoine: 0 };
    row.jouees += 1;
    if (game.winnerId === player.id) row.gagnees += 1;
    if (player.bankrupt) row.faillites += 1;
    row.patrimoine += player.finalWorth ?? 0;
    parNiveau.set(key, row);
  }
}

console.log('\nTaux de victoire');
console.log('─'.repeat(62));
const ordre = ['humaine', 'expert', 'difficile', 'moyen', 'facile'];
for (const key of [...parNiveau.keys()].sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b))) {
  const row = parNiveau.get(key);
  const moyen = Math.round(row.patrimoine / row.jouees);
  console.log(
    `  ${key.padEnd(10)} ${String(row.gagnees).padStart(4)} / ${String(row.jouees).padEnd(5)}` +
    ` ${pct(row.gagnees, row.jouees).padStart(8)}` +
    `   patrimoine moyen ${moyen.toLocaleString('fr-FR').padStart(7)}` +
    `   faillites ${pct(row.faillites, row.jouees)}`,
  );
}

if (games.length < SEUIL_CONFIANCE) {
  console.log(
    `\n⚠️  ${games.length} parties seulement : bien trop peu pour conclure quoi que ce soit. ` +
    `Au Monopoly le hasard décide beaucoup — comptez au moins ${SEUIL_CONFIANCE} parties, et ` +
    `plutôt quelques centaines pour départager deux niveaux voisins.`,
  );
}

// — Sur quelles boîtes joue-t-on ? ————————————————————
const parEdition = new Map();
for (const game of games) {
  const key = game.editionId + (game.extensionIds?.length ? ` + ${game.extensionIds.join('+')}` : '');
  parEdition.set(key, (parEdition.get(key) ?? 0) + 1);
}
console.log('\nBoîtes jouées');
console.log('─'.repeat(62));
for (const [key, n] of [...parEdition].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key.padEnd(40)} ${String(n).padStart(4)}  ${pct(n, games.length)}`);
}

// — Durée, et comment ça se termine ————————————————————
const tours = games.map((g) => g.turns ?? 0).filter(Boolean).sort((a, b) => a - b);
if (tours.length) {
  const median = tours[Math.floor(tours.length / 2)];
  console.log(`\nDurée : ${tours[0]} à ${tours.at(-1)} tours, médiane ${median}`);
}

const abandons = games.filter((g) => !g.winnerId).length;
if (abandons) console.log(`Parties sans gagnante (arrêtées en cours) : ${abandons}`);
console.log('');
