/**
 * Classroom roster parsing.
 * Syntax (inspired by common marble-draw conventions, implemented independently):
 *   민준        → 1 marble, weight 1
 *   서연*3      → 3 marbles named 서연
 *   하준/2      → 1 marble, weight 2 (slightly larger + more skill chance)
 *   지유/2*3    → 3 marbles, weight 2
 */

const WEIGHT_RE = /\/(\d+)/;
const COUNT_RE = /\*(\d+)/;
const NAME_RE = /^\s*([^/*]+)/;

export function parseName(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  const nameMatch = NAME_RE.exec(text);
  const name = nameMatch ? nameMatch[1].trim() : "";
  if (!name) return null;
  const weightMatch = WEIGHT_RE.exec(text);
  const countMatch = COUNT_RE.exec(text);
  const weight = weightMatch ? Math.max(1, parseInt(weightMatch[1], 10) || 1) : 1;
  const count = countMatch ? Math.max(1, parseInt(countMatch[1], 10) || 1) : 1;
  return { name, weight, count };
}

export function splitNameLines(value) {
  if (typeof value !== "string") return [];
  return value
    .split(/[,\r\n]+/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseRoster(value) {
  return splitNameLines(value)
    .map(parseName)
    .filter(Boolean);
}

export function expandMarbles(entries) {
  const marbles = [];
  for (const entry of entries) {
    const count = Math.min(99, Math.max(1, entry.count || 1));
    for (let i = 0; i < count; i += 1) {
      marbles.push({
        name: entry.name,
        weight: Math.max(1, entry.weight || 1),
      });
    }
  }
  return marbles;
}

export function consolidateRoster(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const key = `${entry.name}\0${entry.weight}`;
    const prev = grouped.get(key);
    if (prev) prev.count += entry.count;
    else grouped.set(key, { name: entry.name, weight: entry.weight, count: entry.count });
  }
  return [...grouped.values()];
}

export function formatRoster(entries) {
  return consolidateRoster(entries)
    .map((entry) => {
      let text = entry.name;
      if (entry.weight > 1) text += `/${entry.weight}`;
      if (entry.count > 1) text += `*${entry.count}`;
      return text;
    })
    .join("\n");
}

export function shuffle(list, random = Math.random) {
  const array = list.slice();
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function cryptoRandom() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

export function filterExcluded(entries, excludedNames) {
  if (!excludedNames || excludedNames.length === 0) return entries;
  const blocked = new Set(excludedNames);
  return entries.filter((entry) => !blocked.has(entry.name));
}

export function winnerRange(mode, options, marbleCount) {
  const count = Math.max(0, marbleCount);
  if (count === 0) return { start: 0, end: 0 };
  if (mode === "last") {
    return { start: count - 1, end: count - 1 };
  }
  if (mode === "range") {
    let start = clampRank(options.rangeStart, count);
    let end = clampRank(options.rangeEnd, count);
    if (end < start) end = start;
    return { start, end };
  }
  if (mode === "nth") {
    const n = clampRank(options.nth, count);
    return { start: n, end: n };
  }
  return { start: 0, end: 0 };
}

function clampRank(value, count) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(count, n) - 1;
}
