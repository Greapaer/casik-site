import { describe, expect, it } from 'vitest';
import { buildPotLayers, payoutLayers, pickWinnersByLayer } from './pot';

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

describe('buildPotLayers', () => {
  it('four players with progressively deeper stacks produce nested side pots', () => {
    const committed = [100, 100, 50, 25];
    const layers = buildPotLayers(committed, [0, 1, 2, 3]);
    expect(layers.map((l) => l.amount)).toEqual([100, 75, 100]);
    expect(sum(layers.map((l) => l.amount))).toBe(275); // all chips accounted for
    expect(layers[0].label).toBe('Main pot');
    expect(layers[1].label).toBe('Side pot 1');
    expect(layers.map((l) => l.eligible)).toEqual([
      [0, 1, 2, 3],
      [0, 1, 2],
      [0, 1],
    ]);
  });

  it('folded players keep their chips in the pot but are not eligible', () => {
    const committed = [100, 100, 50, 25];
    const layers = buildPotLayers(committed, [0, 1, 2]);
    expect(layers[0].eligible).toEqual([0, 1, 2]); // D folded — chips stay, no claim
    expect(layers[0].amount).toBe(100);
    expect(layers.map((l) => l.amount)).toEqual([100, 75, 100]);
  });

  it('uncalled all-in excess becomes a self-eligible side pot (returned money)', () => {
    // A jams 1000 over B who only has 500 — A's over-chips must come back.
    const committed = [1000, 500];
    const layers = buildPotLayers(committed, [0, 1]);
    expect(layers.length).toBe(2);
    expect(layers[0].amount).toBe(1000); // 2 × 500 matched
    expect(layers[1].amount).toBe(500); // A's unmatched 500
    expect(layers[1].eligible).toEqual([0]);
  });

  it('single equal stack collapse to one layer', () => {
    const layers = buildPotLayers([100, 100, 100], [0, 1, 2]);
    expect(layers).toHaveLength(1);
    expect(layers[0].amount).toBe(300);
  });

  it('short-stack fold-out still leaves their contributed chips pooled', () => {
    const layers = buildPotLayers([200, 200, 50], [0, 1]); // C(50) folded after posting
    expect(layers[0].amount).toBe(150); // 3 × 50
    expect(layers[1].amount).toBe(300); // 2 × 150
    expect(layers[0].eligible).toEqual([0, 1]);
    expect(layers[1].eligible).toEqual([0, 1]);
  });
});

describe('payoutLayers', () => {
  it('splits rest between tied winners with odd chip to the seat left of the button', () => {
    const layers = [
      { index: 0, amount: 200, total: 200, eligible: [0, 1], label: 'Main pot' },
    ];
    const won = payoutLayers(layers, [[0, 1]], [1, 0]).won; // button=0 → B(1) first
    expect(won[0]).toBe(100);
    expect(won[1]).toBe(100);

    const odd = [
      { index: 0, amount: 201, total: 201, eligible: [0, 1], label: 'Main pot' },
    ];
    const won2 = payoutLayers(odd, [[0, 1]], [1, 0]).won;
    expect(won2[0] + won2[1]).toBe(201);
    // odd chip goes to seat 1 (first left of the button)
    expect(won2[1]).toBe(Math.ceil(201 / 2));
  });

  it('every chip is distributed exactly once across nested layers', () => {
    const committed = [100, 100, 50, 25];
    const layers = buildPotLayers(committed, [0, 1, 2, 3]);
    const winners = pickWinnersByLayer(layers, (i) => (i === 0 ? 8 : i === 1 ? 6 : 2));
    const won = payoutLayers(layers, winners, [0, 1, 2, 3]).won;
    expect(sum(won)).toBe(275);
    expect(won[0]).toBe(275); // strongest player sweeps every layer
  });
});

describe('pickWinnersByLayer', () => {
  it('only alive eligible players can win each layer', () => {
    const committed = [100, 100, 50, 25];
    const layers = buildPotLayers(committed, [0, 1, 2]); // D folded
    // rank: A strongest (10), B (8), C (2)
    const winners = pickWinnersByLayer(layers, (i) => (i === 0 ? 10 : i === 1 ? 8 : 2));
    // layer1: A,B,C eligible → A only; layer2: A,B,C → A; layer3: A,B → A
    expect(winners).toEqual([[0], [0], [0]]);
  });
});