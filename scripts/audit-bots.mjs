#!/usr/bin/env node
/**
 * Chercher les coups bêtes, dans les parties déjà jouées.
 *
 *   node scripts/audit-bots.mjs [--level expert] [--limit 8]
 *
 * L'auto-jeu (`tune-bots.mjs`) répond à « ce réglage bat-il l'ancien ? ». Il ne
 * répond pas à « pourquoi ce bot a-t-il fait *ça* ? ». Ce script-là relit les
 * archives et cherche les décisions qui sautent aux yeux : refuser un terrain
 * qu'on peut s'offrir dix fois, laisser filer une gare à vil prix, hypothéquer
 * en étant riche, ne pas bâtir sur un groupe complet avec de quoi le faire.
 *
 * Il ne juge que ce qui est **objectivement** discutable, sans modèle ni
 * pondération : chaque test est une règle qu'une joueuse humaine énoncerait à
 * voix haute. C'est volontaire — un détecteur subtil trouverait surtout ses
 * propres préjugés.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEdition } from '../shared/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.MONOPOLY_ARCHIVE_DIR ?? path.join(HERE, '..', 'data', 'archives');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const wantLevel = opt('level', null);
const limit = Number(opt('limit', 6));

async function readGames() {
  let files = [];
  try {
    files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.jsonl')).sort();
  } catch {
    return [];
  }
  const games = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(DIR, file), 'utf8');
    for (const line of raw.split('\n')) {
      if (line.trim()) {
        try { games.push(JSON.parse(line)); } catch { /* ligne tronquée, on saute */ }
      }
    }
  }
  return games;
}

const games = await readGames();
if (!games.length) {
  console.log(`Aucune partie archivée dans ${DIR}. Jouez quelques parties d'abord.`);
  process.exit(0);
}

/** Les cases d'un groupe, et le groupe d'une case, pour l'édition d'une partie. */
function boardInfo(game) {
  const edition = getEdition(game.editionId, game.locale);
  const groupOf = new Map();
  const groupSpaces = new Map();
  for (const space of edition.board) {
    if (!space.group) continue;
    groupOf.set(space.id, space.group);
    groupSpaces.set(space.group, edition.groups[space.group]?.spaces ?? []);
  }
  return { edition, groupOf, groupSpaces };
}

const findings = new Map(); // libellé → { n, exemples[] }
function note(kind, detail) {
  const row = findings.get(kind) ?? { n: 0, exemples: [] };
  row.n += 1;
  if (row.exemples.length < limit) row.exemples.push(detail);
  findings.set(kind, row);
}

let examined = 0;

for (const game of games) {
  if (game.partial) continue;
  const { edition, groupOf, groupSpaces } = boardInfo(game);
  const byId = new Map((game.players ?? []).map((p) => [p.id, p]));

  // Ce qu'on a bâti dans le tour, par joueuse : une joueuse bâtit par une
  // action distincte, *puis* finit son tour. Sans ce relevé, on prenait chaque
  // fin de tour pour un refus de bâtir — 255 faux positifs à la première
  // version de ce script.
  const batiDansLeTour = new Set();
  for (const d of game.decisions ?? []) {
    if (d.accepted && d.action?.type === 'BUILD_HOUSE') {
      batiDansLeTour.add(`${d.playerId}@${d.before?.turn}`);
    }
  }

  for (const d of game.decisions ?? []) {
    if (!d.accepted || !d.before) continue;
    if (wantLevel && d.bot !== wantLevel) continue;
    if (!d.bot) continue; // on n'audite pas les humaines
    examined += 1;

    const b = d.before;
    const space = b.spaceId != null ? edition.board[b.spaceId] : null;
    const owned = new Set(b.owned ?? []);
    const who = `${byId.get(d.playerId)?.name ?? d.playerId} (${d.bot})`;
    const where = `partie ${game.code}, tour ${b.turn}`;

    // — 1. Refuser un terrain qu'on peut s'offrir très largement ————
    if (d.pendingKind === 'buy_or_auction' && d.action.type === 'DECLINE_PROPERTY' && space) {
      const ratio = b.price ? b.cash / b.price : 0;
      const group = groupOf.get(b.spaceId);
      const mine = (groupSpaces.get(group) ?? []).filter((id) => owned.has(id)).length;
      const size = (groupSpaces.get(group) ?? []).length;

      if (ratio >= 6) {
        note('Refuse un terrain qu’il peut s’offrir 6 fois ou plus',
          `${who} refuse ${space.name} à ${b.price} avec ${b.cash} en poche — ${where}`);
      } else if (size && mine === size - 1) {
        note('Refuse le terrain qui compléterait son groupe',
          `${who} refuse ${space.name} (${mine}/${size} du groupe ${group}) à ${b.price}, ` +
          `${b.cash} en poche — ${where}`);
      }
    }

    // — 2. Hypothéquer alors qu'on est riche et sans dette ————————
    if (d.action.type === 'MORTGAGE' && !b.debt && b.cash >= 800) {
      note('Hypothèque sans dette, avec beaucoup de liquide',
        `${who} hypothèque avec ${b.cash} en poche et aucune dette — ${where}`);
    }

    // — 3. Revendre une construction sans y être forcé ————————————
    if (d.action.type === 'SELL_BUILDING' && !b.debt && b.cash >= 600) {
      note('Revend une construction sans dette et avec du liquide',
        `${who} revend une construction avec ${b.cash} en poche — ${where}`);
    }

    // — 4. Laisser filer une enchère bradée ————————————————
    // Sans la mise courante, « passer en étant riche » ne veut rien dire : la
    // mise peut déjà dépasser la valeur du bien. On ne juge donc que si
    // l'archive porte la mise — les parties d'avant restent muettes ici.
    if (
      d.pendingKind === 'auction_bid' && d.action.type === 'AUCTION_PASS' &&
      space?.price && typeof b.currentBid === 'number'
    ) {
      const affaire = b.currentBid < space.price * 0.5;
      if (affaire && b.cash >= space.price * 2) {
        note('Laisse filer une enchère à moitié prix',
          `${who} passe sur ${space.name} à ${b.currentBid} (valeur ${space.price}) ` +
          `avec ${b.cash} — ${where}`);
      }
    }

    // — 5. Finir son tour sur un groupe complet, riche, sans bâtir ——
    if (
      d.pendingKind === 'end_turn' &&
      d.action.type === 'END_TURN' &&
      b.cash >= 900 &&
      !batiDansLeTour.has(`${d.playerId}@${b.turn}`)
    ) {
      // Un groupe complet, encore constructible, et la banque qui suit. Sans le
      // niveau de chaque case on prenait un groupe déjà coiffé d'hôtels pour un
      // refus de bâtir — l'archive porte donc `buildings` depuis peu, et les
      // parties d'avant restent muettes sur ce point.
      const niveaux = b.buildings;
      const complet = niveaux === undefined ? null : [...groupSpaces.entries()].find(([, spaces]) =>
        spaces.length > 0 && spaces.every((id) => owned.has(id)) &&
        edition.board[spaces[0]]?.type === 'property' &&
        spaces.some((id) => (niveaux[id] ?? 0) < 5) &&
        (b.bank?.houses ?? 0) > 0);
      if (complet) {
        const [group, spaces] = complet;
        const cout = edition.board[spaces[0]]?.houseCost ?? 0;
        if (cout && b.cash >= cout * 3) {
          note('Finit son tour sans bâtir, groupe complet et riche',
            `${who} garde ${b.cash} sans bâtir sur ${group} ` +
            `(maison ${cout}, niveaux ${spaces.map((id) => niveaux[id] ?? 0).join('/')}) — ${where}`);
        }
      }
    }
  }
}

console.log(`\n${examined.toLocaleString('fr-FR')} décisions de bots examinées ` +
            `sur ${games.filter((g) => !g.partial).length} partie(s)` +
            `${wantLevel ? ` — niveau « ${wantLevel} »` : ''}\n`);

if (!findings.size) {
  console.log('Aucun coup manifestement bête détecté.');
  process.exit(0);
}

for (const [kind, row] of [...findings].sort((a, b) => b[1].n - a[1].n)) {
  const part = ((row.n / examined) * 100).toFixed(2);
  console.log(`${row.n}×  ${kind}   (${part} % des décisions)`);
  for (const ex of row.exemples) console.log(`      ${ex}`);
  console.log('');
}
