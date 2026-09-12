import { describe, expect, it } from 'vitest';
import { evaluate7, evaluate5, compareHands, type HandCategory } from './handEval';
import type { Card } from '../../types';

function h(...codes: string[]): Card[] {
  return codes.map((c) => ({ rank: c.slice(0, -1) as Card['rank'], suit: c.slice(-1) as Card['suit'] }));
}

const cat = (c: Card[]) => evaluate7(c).category;

describe('evaluate7 categories', () => {
  it('detects a royal flush', () => {
    expect(cat(h('Ah', 'Kh', 'Qh', 'Jh', '10h', '2d', '3c'))).toBe('royal-flush');
  });

  it('detects a wheel straight flush as the lowest straight flush', () => {
    const r = evaluate7(h('Ah', '2h', '3h', '4h', '5h', 'Kc', 'Qd'));
    expect(r.category).toBe('straight-flush');
    expect(r.value).toBeLessThan(evaluate7(h('9h', '8h', '7h', '6h', '5h', 'Ac', 'Kd')).value);
  });

  it('straight through duplicated ranks (2,2,2,6,5,4,3 reads as a 6-high straight, not trips)', () => {
    const r = evaluate7(h('2c', '2d', '2h', '6h', '5d', '4c', '3s'));
    // uniq ranks {6,5,4,3,2} form a straight that outranks trip deuces.
    expect(r.category).toBe('straight');
    expect(r.label).toBe('Straight to the Six');
  });
});

describe('evaluate7 against known rankings', () => {
  it('royal > straight flush > quads > boat > flush > straight > trips > two pair > pair > high', () => {
    const hands: [HandCategory, Card[]][] = [
      ['royal-flush', h('Ah', 'Kh', 'Qh', 'Jh', '10h', '2d', '3c')],
      ['straight-flush', h('9h', '8h', '7h', '6h', '5h', 'Ac', 'Kd')],
      ['four-kind', h('9s', '9d', '9h', '9c', 'Ac', 'Kd', 'Qh')],
      ['full-house', h('Ks', 'Kd', 'Kh', '9c', '9h', 'Ah', 'Qd')],
      ['flush', h('Ah', 'Qh', '10h', '7h', '3h', 'Kd', '2c')],
      ['straight', h('Qc', 'Jd', '10h', '9h', '8s', '2d', '3c')],
      ['three-kind', h('Js', 'Jd', 'Jh', '9h', '8s', '2d', '3c')],
      ['two-pair', h('Js', 'Jd', '9h', '9c', '8s', '2d', '3c')],
      ['pair', h('Js', 'Jd', '9h', '8c', '7s', '2d', '3c')],
      ['high-card', h('Ah', 'Jd', '9h', '8c', '7s', '2d', '3c')],
    ];
    for (const [i, [, a]] of hands.entries()) {
      if (i === 0) continue;
      expect(compareHands(evaluate7(hands[i - 1][1]), evaluate7(a))).toBeGreaterThan(0);
    }
    for (const [catExpected, cards] of hands) {
      expect(evaluate7(cards).category).toBe(catExpected);
    }
  });

  it('two pair tiebreak uses the higher top pair', () => {
    const a = evaluate7(h('As', 'Ad', 'Jh', 'Jc', '8s', '2d', '3c'));
    const b = evaluate7(h('As', 'Ad', '9h', '9c', 'Ks', '2d', '3c'));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('flush kickers matter', () => {
    const a = evaluate7(h('As', 'Qs', '10s', '7s', '3s', '2d', '9c'));
    const b = evaluate7(h('As', 'Qs', '10s', '7s', '2s', '2d', '9c'));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('evaluate5 agrees with evaluate7 when exactly five cards', () => {
    const five = h('Kh', 'Qh', 'Jh', '10h', '9h');
    expect(evaluate5(five).value).toBe(evaluate7(five).value);
  });
});
