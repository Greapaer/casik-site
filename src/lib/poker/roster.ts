import type { Personality } from '../../types';

export interface BotDef {
  name: string;
  avatarId: string;
  personality: Personality;
}

const POOL: BotDef[] = [
  { name: 'Ace Wolf', avatarId: 'lynx-crimson', personality: 'aggressive' },
  { name: 'Tight Gate', avatarId: 'eagle-ivory', personality: 'passive' },
  { name: 'Silver Fox', avatarId: 'wolf-slate', personality: 'balanced' },
  { name: 'Vega', avatarId: 'phoenix-rose', personality: 'wild' },
  { name: 'Mirage', avatarId: 'diamond-azure', personality: 'balanced' },
  { name: 'Lord Ash', avatarId: 'crown-gold', personality: 'passive' },
  { name: 'Jade Talon', avatarId: 'diamond-jade', personality: 'aggressive' },
  { name: 'Onyx Rain', avatarId: 'wolf-graphite', personality: 'wild' },
];

export function pickOpponents(count: number): BotDef[] {
  return POOL.slice(0, Math.min(POOL.length, Math.max(1, count)));
}

export const BOT_POOL = POOL;

export interface TableDef {
  id: string;
  name: string;
  desc: string;
  bb: number;
  buyin: number;
}

export const TABLES: TableDef[] = [
  { id: 'low', name: 'Aurum Lounge', desc: 'Gentle stakes · BB 10', bb: 10, buyin: 1000 },
  { id: 'club', name: 'Obsidian Club', desc: 'Balanced · BB 20', bb: 20, buyin: 2000 },
  { id: 'high', name: 'Rubedo Room', desc: 'Serious · BB 50', bb: 50, buyin: 5000 },
  { id: 'vip', name: 'Noir Suite', desc: 'High society · BB 100', bb: 100, buyin: 10000 },
];