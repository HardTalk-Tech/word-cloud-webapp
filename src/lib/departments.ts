// Department search for the phone's Department field (pure, unit tested).
// Forgiving matching: case, dashes, dots and "&" don't matter; each typed word may match the start of
// any word in the name ("braun wound" → "B-Braun Wound Care"), and letters may run together ("gshacc").

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

type Indexed = { label: string; norm: string; words: string[]; compact: string };

const cache = new WeakMap<readonly string[], Indexed[]>();

function index(list: readonly string[]): Indexed[] {
  let idx = cache.get(list);
  if (!idx) {
    idx = list.map((label) => {
      const n = norm(label);
      return { label, norm: n, words: n.split(' '), compact: n.replace(/ /g, '') };
    });
    cache.set(list, idx);
  }
  return idx;
}

/** 0 = no match; higher = better. */
function score(item: Indexed, q: string, tokens: string[], qCompact: string): number {
  if (item.norm === q) return 1000;
  if (item.norm.startsWith(q)) return 800 - item.norm.length;
  // Every typed word starts some word of the name.
  if (tokens.every((t) => item.words.some((w) => w.startsWith(t)))) {
    const inOrder = item.words.findIndex((w) => w.startsWith(tokens[0])) === 0;
    return 600 + (inOrder ? 50 : 0) - item.norm.length;
  }
  if (item.compact.startsWith(qCompact)) return 450 - item.norm.length;
  if (item.compact.includes(qCompact)) return 300 - item.norm.length;
  if (tokens.every((t) => item.norm.includes(t))) return 150 - item.norm.length;
  return 0;
}

export type DepartmentSearch = { results: string[]; total: number };

/** Best matches for what the user typed (empty query → nothing; the list is never shown in full). */
export function searchDepartments(query: string, list: readonly string[], limit: number): DepartmentSearch {
  const q = norm(query);
  if (!q) return { results: [], total: 0 };
  const tokens = q.split(' ');
  const qCompact = q.replace(/ /g, '');
  const hits = index(list)
    .map((item) => ({ item, s: score(item, q, tokens, qCompact) }))
    .filter((h) => h.s > 0)
    .sort((a, b) => b.s - a.s || a.item.label.localeCompare(b.item.label));
  return { results: hits.slice(0, limit).map((h) => h.item.label), total: hits.length };
}

/** The list's own spelling when the typed text is a listed department; otherwise the text as typed. */
export function canonicalDepartment(input: string, list: readonly string[]): string {
  const q = norm(input);
  return index(list).find((i) => i.norm === q)?.label ?? input.replace(/\s+/g, ' ').trim();
}

/** Split a label into parts for highlighting the letters that matched the query. */
export function highlightParts(label: string, query: string): { text: string; match: boolean }[] {
  const tokens = norm(query).split(' ').filter(Boolean);
  if (!tokens.length) return [{ text: label, match: false }];
  const lower = label.toLowerCase();
  const marks = new Array<boolean>(label.length).fill(false);
  for (const t of tokens) {
    // Prefer a word start, else anywhere.
    let at = -1;
    for (let i = lower.indexOf(t); i !== -1; i = lower.indexOf(t, i + 1)) {
      if (i === 0 || !/[a-z0-9]/.test(lower[i - 1])) {
        at = i;
        break;
      }
      if (at === -1) at = i;
    }
    if (at >= 0) for (let i = at; i < at + t.length; i++) marks[i] = true;
  }
  const parts: { text: string; match: boolean }[] = [];
  for (let i = 0; i < label.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.match === marks[i]) last.text += label[i];
    else parts.push({ text: label[i], match: marks[i] });
  }
  return parts;
}
