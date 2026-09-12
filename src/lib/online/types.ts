import type { GameSnapshot } from '../poker/game';

export interface OnlineSettings {
  size: number; // seats
  bb: number; // big blind base
  buyin: number;
  timerSec: number; // 0 = no limit
  maxRaises: number; // 0 = unlimited
  speed: 'fast' | 'normal' | 'slow'; // deal / bot cadence
  mode: 'cash' | 'sitngo' | 'tournament'; // start format
}

export interface OnlinePlayer {
  seat: number;
  name: string;
  avatarId: string;
  stack: number | null; // null = not yet started
  host: boolean;
}

export interface OnlineRoom {
  code: string;
  settings: OnlineSettings;
  players: OnlinePlayer[];
  started: boolean;
}

export type ClientMsg =
  | { t: 'create'; name: string; avatarId: string; settings: OnlineSettings }
  | { t: 'join'; code: string; name: string; avatarId: string }
  | { t: 'leave' }
  | { t: 'start' }
  | { t: 'action'; kind: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'; amount?: number }
  | { t: 'rebuy' }
  | { t: 'chat'; text: string };

export type ServerMsg =
  | { t: 'hello'; code: string }
  | { t: 'room'; room: OnlineRoom }
  | { t: 'snap'; you: number; snap: GameSnapshot; winner: number[] }
  | { t: 'chat'; from: string; text: string; ts: number }
  | { t: 'settle'; delta: number }
  | { t: 'roomEnd'; reason: string }
  | { t: 'err'; message: string };