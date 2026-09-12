export interface PotLayer {
  index: number;
  amount: number;
  /** total chips locked in at this level by all contributors */
  total: number;
  eligible: number[];
  label: string;
}

export interface PayoutResult {
  /** won amount per seat index */
  won: number[];
  layers: PotLayer[];
}

/**
 * Pure side-pot construction from raw committed amounts.
 *
 * Level thresholds and layer sizes are derived from the committed chips of EVERY
 * seat, including folded players — their money stays in the pot but they are not
 * eligible to win any layer. Sometimes the "uncalled bet" (a raiser's over-chips
 * no one can match) surfaces as a trailing side pot that only that raiser is
 * eligible for; awarding them that layer equals returning their own unmatched
 * chips, which is handled by the caller via `payoutLayers`.
 */
export function buildPotLayers(committed: number[], alive: number[]): PotLayer[] {
  const allIdx = committed.map((_, i) => i);
  const levels = [...new Set(committed.filter((v) => v > 0))].sort((a, b) => a - b);

  const layers: PotLayer[] = [];
  let prev = 0;
  levels.forEach((cur) => {
    const size = cur - prev;
    prev = cur;
    if (size <= 0) return;
    const contributors = allIdx.filter((i) => committed[i] >= cur);
    const total = size * contributors.length;
    if (total <= 0) return;
    const eligible = alive.filter((i) => committed[i] >= cur);
    layers.push({
      index: layers.length,
      amount: total,
      total,
      eligible,
      label: layers.length === 0 ? 'Main pot' : `Side pot ${layers.length}`,
    });
  });

  return layers;
}

/**
 * Award each layer to its same-best eligible hands (winnerIdx arrays), splitting
 * evenly and distributing the odd-chip remainder starting from the first seat in
 * `seatsByPos` (positional priority — first left of the button claims the chip).
 */
export function payoutLayers(
  layers: PotLayer[],
  winners: number[][],
  seatsByPos: number[],
): PayoutResult {
  const won = layers.length > 0 ? new Array<number>(Math.max(...layers.map((l) => Math.max(...l.eligible, -1))) + 1).fill(0) : [];

  layers.forEach((layer) => {
    const idxs = winners[layer.index] ?? [];
    if (idxs.length === 0) return;
    const per = Math.floor(layer.amount / idxs.length);
    let remainder = layer.amount - per * idxs.length;
    // Positional priority for the odd chip: left of the button first.
    const ordered = [...seatsByPos].filter((i) => idxs.includes(i));
    const roundRobin = [...ordered, ...idxs.filter((i) => !ordered.includes(i))];
    roundRobin.forEach((i, ti) => {
      const share = per + (ti < remainder ? 1 : 0);
      won[i] += share;
    });
  });

  return { won, layers };
}

/** Flatten per-layer winner arrays from the same-best hands for payoutLayers. */
export function pickWinnersByLayer(layers: PotLayer[], rankOf: (i: number) => number): number[][] {
  return layers.map((layer) => {
    const es = layer.eligible;
    if (es.length === 0) return [];
    let bestVal = rankOf(es[0]);
    for (let i = 1; i < es.length; i++) {
      const v = rankOf(es[i]);
      if (v > bestVal) bestVal = v;
    }
    return es.filter((i) => rankOf(i) === bestVal);
  });
}