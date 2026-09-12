import { useMemo } from 'react';

/** Ambient floating gold particles + aurora + grain backdrop */
export function Scene() {
  const particles = useMemo(() => {
    const rng = mulberry(42);
    return Array.from({ length: 22 }, (_, i) => ({
      id: i,
      left: rng() * 100,
      top: rng() * 100,
      size: 2 + rng() * 5,
      dur: 9 + rng() * 12,
      delay: rng() * 8,
      dx: (rng() - 0.5) * 60,
      dy: -(20 + rng() * 60),
    }));
  }, []);

  return (
    <div className="bg-scene" aria-hidden="true">
      <div className="bg-aurora" />
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            '--dur': `${p.dur}s`,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
          } as React.CSSProperties}
        />
      ))}
      <div className="bg-grain" />
    </div>
  );
}

function mulberry(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}