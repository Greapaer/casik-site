import type { Suit } from '../types';
import { SUIT_META } from '../lib/poker/deck';

function SuitGlyph({ suit, size = 18 }: { suit: Suit; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      {suit === 'h' && <path d="M12 21 3 12a5.5 5.5 0 1 1 8-7.5L12 5l1-0.5a5.5 5.5 0 1 1 8 7.5Z" />}
      {suit === 'd' && <path d="M12 2.5 21 12 12 21.5 3 12Z" />}
      {suit === 's' && (
        <path d="M12 2.5c2.5 3.5 6.5 6.8 6.5 11a6.5 6.5 0 1 1-10 5.4V18c0-4 3.3-6.8 6-10.5L12 6 9.5 7.5C12.2 11.2 15.5 14 15.5 18a6.4 6.4 0 0 1-3.5 5.7 6.5 6.5 0 1 1-6.5-10.2c0-4.2 4-7.5 6.5-11Z" />
      )}
      {suit === 'c' && (
        <path d="M12 3a4.5 4.5 0 0 1 2 8.5c.7.6 1.9 1 3.5.8a5 5 0 1 1-5.5 5.7A5 5 0 1 1 6.5 12c1.6.2 2.8-.2 3.5-.8A4.5 4.5 0 0 1 12 3Z" />
      )}
    </svg>
  );
}

export { SuitGlyph };

export function SuitBadge({ suit, size }: { suit: Suit; size?: number }) {
  const meta = SUIT_META[suit];
  return (
    <span style={{ color: meta.color, display: 'inline-flex' }}>
      <SuitGlyph suit={suit} size={size} />
    </span>
  );
}