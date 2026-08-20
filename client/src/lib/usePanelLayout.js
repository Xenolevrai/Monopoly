/**
 * Où vivent les sections de la partie, sur ordinateur : à gauche du plateau,
 * à droite, repliées, dans quel ordre.
 *
 * Une seule source de vérité, partagée par les deux colonnes — c'est ce qui
 * permet de glisser une section d'un côté à l'autre : les deux `PanelColumn`
 * lisent et modifient le même état, gardé dans le navigateur d'une partie à
 * l'autre. Sur téléphone, ce réglage ne sert à rien (une seule colonne,
 * gouvernée par les onglets) : c'est sur ordinateur qu'on a la place d'en
 * faire deux.
 */
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'monopoly:agencement';

function loadRaw() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveRaw(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Navigation privée, quota plein : l'agencement ne survivra pas, tant pis.
  }
}

/**
 * Assainit ce qui vient du stockage : une section disparue (revenue à une
 * version antérieure) est ignorée, une section nouvelle rejoint la droite par
 * défaut. Migre aussi l'ancien format à une seule colonne (`order`), pour ne
 * pas jeter l'agencement déjà choisi par une famille qui jouait avant l'ajout
 * de la colonne de gauche.
 */
function normalize(raw, ids) {
  const columns = raw.columns ?? { left: [], right: raw.order ?? ids };
  const known = new Set([...(columns.left ?? []), ...(columns.right ?? [])]);
  const left = (columns.left ?? []).filter((id) => ids.includes(id));
  const right = (columns.right ?? []).filter((id) => ids.includes(id));
  for (const id of ids) if (!known.has(id)) right.push(id);
  return { columns: { left, right }, collapsed: raw.collapsed ?? {} };
}

export function usePanelLayout(ids) {
  const [layout, setLayout] = useState(() => normalize({}, ids));
  // Le partenaire d'un glisser-déposer en cours : partagé entre les deux
  // colonnes, pour qu'on puisse déposer une section de l'une dans l'autre.
  const [dragging, setDragging] = useState(null);
  const idsKey = ids.join('|');

  // On lit le stockage après le montage : le serveur de rendu ne l'a pas, et
  // lire pendant le rendu ferait diverger le premier affichage.
  // `ids` change de référence à chaque rendu ; seul `idsKey` (sa version en
  // texte) doit déclencher cet effet, pas le tableau lui-même.
  useEffect(() => {
    setLayout(normalize(loadRaw(), ids));
  }, [idsKey]);

  const persist = (next) => {
    setLayout(next);
    saveRaw(next);
  };

  const moveWithin = (side, id, delta) => {
    const list = layout.columns[side];
    const from = list.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    persist({ ...layout, columns: { ...layout.columns, [side]: next } });
  };

  /** Envoie une section de l'autre côté du plateau, en bout de colonne. */
  const sendToSide = (id, side) => {
    const from = side === 'left' ? 'right' : 'left';
    if (!layout.columns[from].includes(id)) return;
    persist({
      ...layout,
      columns: {
        ...layout.columns,
        [from]: layout.columns[from].filter((x) => x !== id),
        [side]: [...layout.columns[side], id],
      },
    });
  };

  /**
   * Dépose la section en cours de glissement dans `side`, juste avant
   * `beforeId` — ou en bout de colonne si `beforeId` est `null` (on a lâché
   * sur la colonne elle-même, pas sur une section précise).
   */
  const dropInto = (side, beforeId = null) => {
    const draggedId = dragging;
    setDragging(null);
    if (!draggedId || draggedId === beforeId) return;
    const withoutDragged = {
      left: layout.columns.left.filter((x) => x !== draggedId),
      right: layout.columns.right.filter((x) => x !== draggedId),
    };
    const target = [...withoutDragged[side]];
    const at = beforeId ? target.indexOf(beforeId) : -1;
    if (at === -1) target.push(draggedId);
    else target.splice(at, 0, draggedId);
    persist({ ...layout, columns: { ...withoutDragged, [side]: target } });
  };

  const toggleCollapse = (id) =>
    persist({ ...layout, collapsed: { ...layout.collapsed, [id]: !layout.collapsed[id] } });

  return {
    columns: layout.columns,
    collapsed: layout.collapsed,
    dragging,
    setDragging,
    moveWithin,
    sendToSide,
    dropInto,
    toggleCollapse,
  };
}
