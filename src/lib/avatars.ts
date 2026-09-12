export interface AvatarDef {
  id: string;
  kind: 'lynx' | 'wolf' | 'eagle' | 'crown' | 'diamond' | 'lion' | 'serpent' | 'phoenix';
  from: string;
  to: string;
}

export const AVATARS: AvatarDef[] = [
  { id: 'lynx-gold', kind: 'lynx', from: '#f0d9a6', to: '#c9a96a' },
  { id: 'wolf-slate', kind: 'wolf', from: '#cfd6e4', to: '#7c8aa0' },
  { id: 'eagle-ivory', kind: 'eagle', from: '#f4efe6', to: '#b9ae9c' },
  { id: 'crown-emerald', kind: 'crown', from: '#7fe3b4', to: '#2f9e6e' },
  { id: 'diamond-azure', kind: 'diamond', from: '#93d4ff', to: '#3f6fd4' },
  { id: 'lion-fire', kind: 'lion', from: '#ffb37a', to: '#d6485e' },
  { id: 'serpent-violet', kind: 'serpent', from: '#d7a5ff', to: '#8a4fd0' },
  { id: 'phoenix-rose', kind: 'phoenix', from: '#ff9ec0', to: '#c2457a' },
  { id: 'lynx-crimson', kind: 'lynx', from: '#ff9a8a', to: '#c2453e' },
  { id: 'wolf-graphite', kind: 'wolf', from: '#e8e8e4', to: '#6f7074' },
  { id: 'crown-gold', kind: 'crown', from: '#fae7b0', to: '#b08a2f' },
  { id: 'diamond-jade', kind: 'diamond', from: '#a0f0d8', to: '#1f8f6b' },
];

export function avatarById(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}