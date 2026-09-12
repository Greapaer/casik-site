import type { Card } from '../../types';
import { cardValue } from './deck';

export type HandCategory =
  | 'royal-flush'
  | 'straight-flush'
  | 'four-kind'
  | 'full-house'
  | 'flush'
  | 'straight'
  | 'three-kind'
  | 'two-pair'
  | 'pair'
  | 'high-card';

export interface HandResult {
  category: HandCategory;
  /** raw compare value — higher wins */
  value: number;
  /** human label e.g. "Two Pair, Aces & Kings" */
  label: string;
  /** category value used for descriptions */
  tier: number;
}

const CATEGORY_VALUE: Record<HandCategory, number> = {
  'royal-flush': 9,
  'straight-flush': 8,
  'four-kind': 7,
  'full-house': 6,
  'flush': 5,
  'straight': 4,
  'three-kind': 3,
  'two-pair': 2,
  'pair': 1,
  'high-card': 0,
};

interface Group {
  v: number;
  n: number;
}

interface Analyzed {
  groups: Group[];
  flushVals: number[] | null;
  straightTop: number | null;
}

function analyze(cards: Card[]): Analyzed {
  const countMap = new Map<number, number>();
  const suitMap = new Map<string, number[]>();

  for (const c of cards) {
    const v = cardValue(c);
    countMap.set(v, (countMap.get(v) ?? 0) + 1);
    const arr = suitMap.get(c.suit) ?? [];
    arr.push(v);
    suitMap.set(c.suit, arr);
  }

  const groups: Group[] = [...countMap.entries()]
    .map(([v, n]) => ({ v, n }))
    .sort((a, b) => b.n - a.n || b.v - a.v);

  let flushVals: number[] | null = null;
  for (const vals of suitMap.values()) {
    if (vals.length >= 5) {
      flushVals = [...new Set(vals)].sort((a, b) => b - a);
      break;
    }
  }

  // IMPORTANT: straight detection needs values sorted purely by rank (descending).
  // `groups` is sorted by count-then-rank for pair/trips/quad lookups, so reusing
  // it here would miss straights whenever a pair/trips/quad is mixed in with the
  // run (e.g. 2,2,2,6,5,4,3 must be read as a 6-high straight, not trip deuces).
  const uniq = [...countMap.keys()].sort((a, b) => b - a);
  let straightTop: number | null = null;
  if (uniq.length >= 5) {
    for (let i = 0; i <= uniq.length - 5; i++) {
      if (uniq[i] - uniq[i + 4] === 4) {
        straightTop = uniq[i];
        break;
      }
    }
    if (straightTop === null && uniq.includes(14) && uniq.includes(5) && uniq.includes(4) && uniq.includes(3) && uniq.includes(2)) {
      straightTop = 5; // wheel
    }
  }

  return { groups, flushVals, straightTop };
}

function straightFromFlush(vals: number[]): number | null {
  const uniq = [...new Set(vals)]
    .map((v) => (v === 14 ? 1 : v)) // allow ace-low in flush straight
    .sort((a, b) => b - a);
  const withAceHigh = [...uniq];
  if (uniq.includes(1) && !uniq.includes(14)) withAceHigh.push(14);
  const merged = [...withAceHigh].sort((a, b) => b - a);
  const top = bestRun(merged);
  if (top !== null) return top;
  return bestRun(uniq);
}

function bestRun(vals: number[]): number | null {
  const uniq = [...new Set(vals)].sort((a, b) => b - a);
  for (let i = 0; i <= uniq.length - 5; i++) {
    if (uniq[i] - uniq[i + 4] === 4) return uniq[i];
  }
  return null;
}

const MAX_KICKERS = 5;

function toValue(tier: number, kickers: number[]): number {
  // Fixed-width base-16 packing: `tier` occupies the top digit and every
  // category is padded to the SAME kicker width, so cross-category ordering is
  // always correct (a category with fewer kickers never collides with a lower
  // one that encodes more digits).
  let value = tier * Math.pow(16, MAX_KICKERS);
  for (let i = 0; i < MAX_KICKERS; i++) {
    value += (kickers[i] ?? 0) * Math.pow(16, MAX_KICKERS - 1 - i);
  }
  return value;
}

function highKickers(groups: Group[], exclude: number[], count: number): number[] {
  const vals = groups.filter((g) => !exclude.includes(g.v)).map((g) => g.v);
  return vals.sort((a, b) => b - a).slice(0, count);
}

export function evaluate7(cards: Card[]): HandResult {
  const c = [...cards];
  const { groups, flushVals, straightTop } = analyze(c);

  const count = (n: number) => groups.filter((g) => g.n === n).map((g) => g.v);
  const tallest = groups[0]?.n ?? 0;

  // ---- Straight flush / royal flush ----
  if (flushVals) {
    const sfTop = straightFromFlush(flushVals);
    if (sfTop !== null) {
      const royal = sfTop === 14;
      const cat: HandCategory = royal ? 'royal-flush' : 'straight-flush';
      return {
        tier: CATEGORY_VALUE[cat],
        category: cat,
        value: toValue(CATEGORY_VALUE[cat], [sfTop]),
        label: royal ? 'Royal Flush' : `Straight Flush to the ${rankName(sfTop)}`,
      };
    }
  }

  // ---- Four of a kind ----
  if (tallest === 4) {
    const quad = groups[0].v;
    const k = highKickers(groups, [quad], 1);
    return {
      tier: 7,
      category: 'four-kind',
      value: toValue(7, [quad, ...k]),
      label: `Four of a Kind, ${plural(quad)}`,
    };
  }

  // ---- Full house ----
  const triples = count(3);
  const pairs = count(2);
  if (triples.length >= 1 && (triples.length >= 2 || pairs.length >= 1)) {
    const t = triples[0];
    const p = triples[1] ?? pairs[0];
    return {
      tier: 6,
      category: 'full-house',
      value: toValue(6, [t, p]),
      label: `Full House, ${plural(t)} full of ${plural(p)}`,
    };
  }

  // ---- Flush ----
  if (flushVals) {
    const k = flushVals.slice(0, 5);
    return {
      tier: 5,
      category: 'flush',
      value: toValue(5, k),
      label: `Flush, ${rankName(k[0])} high`,
    };
  }

  // ---- Straight ----
  if (straightTop !== null) {
    return {
      tier: 4,
      category: 'straight',
      value: toValue(4, [straightTop]),
      label: `Straight to the ${rankName(straightTop === 5 && groups.some((g) => g.v === 14) ? 5 : straightTop)}`,
    };
  }

  // ---- Three of a kind ----
  if (triples.length >= 1) {
    const t = triples[0];
    const k = highKickers(groups, [t], 2);
    return {
      tier: 3,
      category: 'three-kind',
      value: toValue(3, [t, ...k]),
      label: `Three of a Kind, ${plural(t)}`,
    };
  }

  // ---- Two pair ----
  if (pairs.length >= 2) {
    const [h, l] = pairs;
    const k = highKickers(groups, [h, l], 1);
    return {
      tier: 2,
      category: 'two-pair',
      value: toValue(2, [h, l, ...k]),
      label: `Two Pair, ${plural(h)} & ${plural(l)}`,
    };
  }

  // ---- Pair ----
  if (pairs.length === 1) {
    const p = pairs[0];
    const k = highKickers(groups, [p], 3);
    return {
      tier: 1,
      category: 'pair',
      value: toValue(1, [p, ...k]),
      label: `Pair of ${plural(p)}`,
    };
  }

  // ---- High card ----
  const k = highKickers(groups, [], 5);
  return {
    tier: 0,
    category: 'high-card',
    value: toValue(0, k),
    label: `${rankName(k[0])} high`,
  };
}

export function evaluate5(cards: Card[]): HandResult {
  return evaluate7(cards);
}

export function compareHands(a: HandResult, b: HandResult): number {
  return a.value - b.value;
}

function rankName(v: number): string {
  const map: Record<number, string> = {
    14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten', 9: 'Nine',
    8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two', 1: 'Ace',
  };
  return map[v] ?? String(v);
}

function plural(v: number): string {
  const names: Record<number, string> = {
    14: 'Aces', 13: 'Kings', 12: 'Queens', 11: 'Jacks', 10: 'Tens', 9: 'Nines',
    8: 'Eights', 7: 'Sevens', 6: 'Sixes', 5: 'Fives', 4: 'Fours', 3: 'Threes', 2: 'Twos',
  };
  return names[v] ?? String(v);
}