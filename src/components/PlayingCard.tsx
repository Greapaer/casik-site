import type { Card } from '../types';
import { SUIT_META } from '../lib/poker/deck';
import { SuitGlyph } from './SuitGlyph';

interface PlayingCardProps {
  card?: Card | null;
  faceDown?: boolean;
  size?: 'normal' | 'hole' | 'board' | 'small';
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}

export function PlayingCard({ card, faceDown, size = 'normal', className = '', delay = 0, style }: PlayingCardProps) {
  const isDown = faceDown || !!card?.faceDown;
  if (!card || isDown) {
    return (
      <div
        className={`pcard face-down ${size} ${className}`}
        style={{ animationDelay: `${delay}ms`, ...style }}
        aria-label="Hidden card"
      />
    );
  }
  const meta = SUIT_META[card.suit];
  const red = card.suit === 'h' || card.suit === 'd';
  return (
    <div
      className={`pcard ${red ? 'red' : ''} ${size} ${className}`}
      style={{ animationDelay: `${delay}ms`, ...style }}
      aria-label={`${card.rank} of ${meta.label}`}
    >
      <span className="pc-rank">
        {card.rank}
        <SuitGlyph suit={card.suit} size={10} />
      </span>
      <span className="pc-glow">
        <SuitGlyph suit={card.suit} size={24} />
      </span>
      <span className="pc-tr">
        {card.rank}
        <SuitGlyph suit={card.suit} size={10} />
      </span>
    </div>
  );
}