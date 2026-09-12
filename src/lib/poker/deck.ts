import type { Card, Rank, Suit } from '../../types';
import { shuffle } from '../utils';

export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS: Suit[] = ['h', 'd', 's', 'c'];

export const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export const SUIT_META: Record<Suit, { glyph: string; color: string; label: string }> = {
  h: { glyph: '♥', color: 'var(--sw-red)', label: 'Hearts' },
  d: { glyph: '♦', color: 'var(--sw-red)', label: 'Diamonds' },
  s: { glyph: '♠', color: 'var(--sw-black)', label: 'Spades' },
  c: { glyph: '♣', color: 'var(--sw-black)', label: 'Clubs' },
};

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return shuffle(deck);
}

export function cardValue(c: Card): number {
  return RANK_VALUE[c.rank];
}

export function cardLabel(c: Card): string {
  return `${c.rank}${SUIT_META[c.suit].glyph}`;
}