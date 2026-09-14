export interface ChipDef {
  color: string;
  edge: string;
}

export const CHIP_DEFS: Record<string, ChipDef> = {
  base: { color: '#c9a96a', edge: '#7a5c22' },
  red: { color: '#c2453e', edge: '#6e1f1b' },
  blue: { color: '#3f6fd4', edge: '#1e346b' },
  green: { color: '#2f9e6e', edge: '#14503a' },
  black: { color: '#2b2f36', edge: '#101216' },
  white: { color: '#e8e8e4', edge: '#999990' },
};

const IDS: string[] = ['base', 'red', 'blue', 'green', 'black', 'white'];

export function chipDefFor(n: number): ChipDef {
  return CHIP_DEFS[IDS[Math.abs(n) % IDS.length]];
}

export function ChipToken({
  value,
  size = 34,
  def = CHIP_DEFS.base,
  label,
  className,
  style,
}: {
  value?: number;
  size?: number;
  def?: ChipDef;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`chip-token ${className ?? ''}`}
      style={{ '--c-size': `${size}px`, '--base': def.color, '--edge': def.edge, ...style } as React.CSSProperties}
      title={label}
    >
      {value !== undefined ? `$${value.toLocaleString('en-US')}` : ''}
    </div>
  );
}

/** A stack of chips used to indicate a bet */
export function ChipStack({ amount, size = 24, max = 6 }: { amount: number; size?: number; max?: number }) {
  if (amount <= 0) return null;
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 560px)').matches;
  const mobileSize = isMobile ? Math.max(16, size * 0.7) : size;
  const stackSize = Math.min(max, Math.max(1, Math.ceil(amount / 400)));
  const items = Array.from({ length: stackSize }, (_, i) => chipDefFor(amount + i * 7));
  return (
    <div className="chip-stack">
      {items.map((d, i) => (
        <ChipToken key={i} size={mobileSize} def={d} />
      ))}
    </div>
  );
}