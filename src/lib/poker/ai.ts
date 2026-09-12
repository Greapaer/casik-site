import type { Card, Personality } from '../../types';
import { cardValue } from './deck';
import { evaluate7 } from './handEval';

export interface BotContext {
  personality: Personality;
  hole: Card[];
  board: Card[];
  pot: number;
  toCall: number;
  minRaiseTotal: number;
  stack: number;
  bigBlind: number;
  playersActive: number; // opponents still in the hand (not folded)
  street: number; // 0 preflop, 3 flop, 4 turn, 5 river
  handAggression: number; // 0..1 how aggressive the hand has been
  isLastFirst: boolean; // acts first w/ no raise (check/cheap play position)
}

export type BotAction =
  | { kind: 'fold' }
  | { kind: 'check' }
  | { kind: 'call' }
  | { kind: 'raise'; amount: number } // absolute chip amount of the bet
  | { kind: 'allin' };

interface Persona {
  aggression: number;
  bluffFreq: number;
  looseness: number; // how often played
  variance: number;
  multiplayerAggro: number; // resist raising many opponents
}

function persona(p: Personality, rng: () => number): Persona {
  switch (p) {
    case 'aggressive':
      return { aggression: 0.78, bluffFreq: 0.34, looseness: 0.32, variance: 0.08, multiplayerAggro: 0.8 };
    case 'passive':
      return { aggression: 0.34, bluffFreq: 0.04, looseness: 0.66, variance: 0.06, multiplayerAggro: 1.6 };
    case 'balanced':
      return { aggression: 0.5, bluffFreq: 0.16, looseness: 0.42, variance: 0.1, multiplayerAggro: 1.1 };
    case 'wild':
      return { aggression: 0.55 + (rng() - 0.5) * 0.55, bluffFreq: 0.4, looseness: 0.52, variance: 0.3, multiplayerAggro: 0.85 };
  }
}

/** Monte-Carlo win probability approximation */
export function estimateEquity(
  hole: Card[],
  board: Card[],
  opponents: number,
  rollouts = 75,
): number {
  const inPlay = new Set([...hole, ...board].map((c) => `${c.rank}${c.suit}`));
  const unknown: Card[] = [];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
  const suits = ['h', 'd', 's', 'c'] as const;
  for (const r of ranks) {
    for (const s of suits) {
      if (!inPlay.has(`${r}${s}`)) unknown.push({ rank: r, suit: s });
    }
  }

  const boardNeed = Math.max(0, 5 - board.length);
  let wins = 0;
  let total = 0;

  for (let r = 0; r < rollouts; r++) {
    const pool = [...unknown];
    // Fisher–Yates
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let idx = 0;
    const fill = pool.slice(idx, idx + boardNeed);
    idx += boardNeed;
    const fullBoard = [...board, ...fill];
    const hero = evaluate7([...hole, ...fullBoard]);
    let beatAll = true;
    let tie = false;
    for (let o = 0; o < opponents; o++) {
      const oppHole = pool.slice(idx, idx + 2);
      idx += 2;
      const opp = evaluate7([...oppHole, ...fullBoard]);
      if (opp.value > hero.value) {
        beatAll = false;
        break;
      }
      if (opp.value === hero.value) tie = true;
    }
    if (beatAll) {
      wins += tie ? 0.5 : 1;
    }
    total += 1;
  }
  return total > 0 ? wins / total : 0;
}

export function decideBot(ctx: BotContext): BotAction {
  const rng = Math.random;
  const pers = persona(ctx.personality, rng);
  const { pot, toCall, stack } = ctx;
  const opponents = Math.max(1, ctx.playersActive);

  // All-in-ish situations
  if (toCall >= stack) {
    const quick = Math.random() < 0.35;
    if (quick) return { kind: 'allin' };
    return { kind: 'fold' };
  }

  const equity = estimateEquity(ctx.hole, ctx.board, opponents, ctx.street === 0 ? 65 : 80);

  const potOdds = pot + toCall > 0 ? toCall / (pot + toCall) : 0;
  const effEquity = equity * (1 - pers.multiplayerAggro * (opponents - 1) * 0.08);
  const edge = effEquity - potOdds;

  let foldIf = 1 - pers.looseness; // probability folded when weak
  if (ctx.handAggression > 0.55) foldIf += 0.12;
  if (ctx.street >= 4) foldIf += 0.06;

  // Strong hold
  const strong = effEquity >= 0.62;
  const solid = effEquity >= 0.42 && edge >= 0;

  const jitter = (Math.random() - 0.5) * pers.variance * 2;

  // Raise sizing
  const sizeTarget = 0.55 + effEquity * 0.5 + pers.aggression * 0.25;
  const raiseAmt = Math.min(stack, Math.max(ctx.minRaiseTotal, Math.round((pot * 0.4 + toCall) * sizeTarget)));

  // Bluff?
  const bluffRoll = Math.random();
  const bluffChance = pers.bluffFreq * (ctx.handAggression < 0.5 ? 1.4 : 0.6);

  if (strong) {
    const allInOdds = Math.random() < Math.min(0.18, 0.05 + effEquity * 0.1);
    if (allInOdds && stack <= pot) return { kind: 'allin' };
    return { kind: 'raise', amount: raiseAmt };
  }

  if (solid) {
    if (Math.random() < pers.aggression * 0.5 + jitter) {
      return { kind: 'raise', amount: raiseAmt };
    }
    return { kind: 'call' };
  }

  // Bluff
  if (bluffRoll < bluffChance && potOdds < 0.5) {
    return { kind: 'raise', amount: raiseAmt };
  }

  // Weak — decide between call (loose) and fold
  if (effEquity >= potOdds * 1.15 && Math.random() > foldIf) {
    return { kind: 'call' };
  }

  if (toCall === 0) return { kind: 'check' };
  return { kind: 'fold' };
}

/** Rough preflop category label for UI (e.g. "Premium", "Playable") */
export function holeLabel(hole: Card[]): string {
  if (hole.length !== 2) return '';
  const [a, b] = hole.map(cardValue).sort((x, y) => y - x);
  const paired = a === b;
  const suited = hole[0].suit === hole[1].suit;
  const connected = a - b <= 2;
  const bothHigh = b >= 11;
  const oneHigh = a >= 11;
  if (paired && a >= 12) return 'Premium';
  if (paired && a >= 9) return 'Strong';
  if (paired) return 'Pair';
  if (suited && bothHigh) return 'Strong';
  if (suited && connected) return 'Suited Connector';
  if (connected && bothHigh) return 'Connector';
  if (bothHigh) return 'High';
  if (oneHigh && suited) return 'Playable';
  return 'Speculative';
}