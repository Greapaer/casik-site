import { avatarById, type AvatarDef } from '../lib/avatars';

export function Shape({ kind, color = 'rgba(20,16,8,0.82)' }: { kind: AvatarDef['kind']; color?: string }) {
  switch (kind) {
    case 'lynx':
      return (
        <svg viewBox="0 0 100 100" fill={color}>
          <polygon points="22,34 42,42 20,52" />
          <polygon points="58,20 76,16 66,34" />
          <circle cx="34" cy="52" r="3.4" />
          <circle cx="66" cy="52" r="3.4" />
          <path d="M22 48 C20 70 40 78 50 78 C60 78 80 70 78 48" />
          <path d="M44 66 l6 5 6-5" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'wolf':
      return (
        <svg viewBox="0 0 100 100" fill={color}>
          <polygon points="30,30 46,46 26,58" />
          <polygon points="70,30 54,46 74,58" />
          <path d="M30 34 C20 64 40 78 50 78 C60 78 80 64 70 34" />
          <path d="M40 56 q10 2 20 0" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M38 64 l12 6 12-6" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'eagle':
      return (
        <svg viewBox="0 0 100 100" fill={color}>
          <path d="M50 58 L20 26 C16 44 22 54 30 58 C22 66 18 74 20 82 C38 74 46 68 50 58 Z" />
          <path d="M50 58 L80 26 C84 44 78 54 70 58 C78 66 82 74 80 82 C62 74 54 68 50 58 Z" />
          <path d="M50 40 L56 52 L50 62 L44 52 Z" />
        </svg>
      );
    case 'crown':
      return (
        <svg viewBox="0 0 100 100" fill="rgba(255,248,232,0.92)">
          <path d="M24 62 L22 36 L38 48 L50 24 L62 48 L78 36 L76 62 Z" />
          <rect x="24" y="64" width="52" height="14" rx="4" />
          <circle cx="50" cy="72" r="6" fill="rgba(20,16,8,0.55)" />
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 100 100" fill="rgba(255,250,240,0.92)">
          <path d="M50 14 L84 50 L50 86 L16 50 Z" />
          <path d="M50 14 L50 86 M16 50 L84 50" stroke="rgba(20,16,8,0.4)" strokeWidth="3" />
          <path d="M50 14 L38 50 L50 86 L62 50 Z" fill="rgba(20,16,8,0.18)" />
        </svg>
      );
    case 'lion':
      return (
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="34" fill="rgba(20,16,8,0.28)" />
          <circle cx="50" cy="52" r="23" fill="rgba(20,16,8,0.5)" />
          <path d="M38 50 q12 6 24 0" stroke="rgba(255,248,232,0.95)" strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx="42" cy="42" r="3.4" fill="rgba(20,16,8,0.95)" />
          <circle cx="58" cy="42" r="3.4" fill="rgba(20,16,8,0.95)" />
        </svg>
      );
    case 'serpent':
      return (
        <svg viewBox="0 0 100 100">
          <path d="M30 20 h40 c14 0 14 16 0 16 h-40 c-14 0 -14 24 0 24 h30 c14 0 14 16 0 16 h-32"
            stroke={color} strokeWidth="13" fill="none" strokeLinecap="round" />
          <circle cx="30" cy="88" r="5" fill={color} />
        </svg>
      );
    case 'phoenix':
      return (
        <svg viewBox="0 0 100 100" fill={color}>
          <path d="M50 12 c4 14 14 18 18 32 c-4 2 -8 3 -12 3 c-8-10 -10-20 -6-35 Z" />
          <path d="M50 12 c-4 14 -14 18 -18 32 c4 2 8 3 12 3 c8-10 10-20 6-35 Z" />
          <path d="M50 30 c6 10 18 14 24 26 c-6 6 -12 8 -18 8 c-4-6 -6-12 -6-18 Z" />
          <path d="M50 30 c-6 10 -18 14 -24 26 c6 6 12 8 18 8 c4-6 6-12 6-18 Z" />
          <path d="M50 52 c3 10 12 16 18 24 c-4 4 -9 6 -14 6 c-3-8 -4-16 -4-24 Z" />
          <path d="M50 52 c-3 10 -12 16 -18 24 c4 4 9 6 14 6 c3-8 4-16 4-24 Z" />
          <circle cx="50" cy="20" r="3" fill="rgba(255,248,232,0.95)" />
        </svg>
      );
  }
}

/** Gradient circle with emblem */
export function Avatar({
  avatarId,
  size = 44,
  ring = false,
}: {
  avatarId: string;
  size?: number;
  ring?: boolean;
}) {
  const def = avatarById(avatarId);
  return (
    <div
      className={`avatar ${ring ? 'avatar-ring' : ''}`}
      style={{ width: size, height: size, background: `linear-gradient(140deg, ${def.from}, ${def.to})` }}
    >
      <Shape kind={def.kind} />
    </div>
  );
}