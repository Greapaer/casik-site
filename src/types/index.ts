export type Suit = 'h' | 'd' | 's' | 'c';
export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
  faceDown?: boolean;
}

export type TxCategory =
  | 'topup'
  | 'bonus'
  | 'wager'
  | 'win'
  | 'fee';

export interface Transaction {
  id: string;
  ts: number;
  category: TxCategory;
  amount: number; // positive = credit in, negative = out
  detail: string;
  tx: number;
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

export type Personality = 'aggressive' | 'passive' | 'balanced' | 'wild';

export const PERSONALITY_META: Record<
  Personality,
  { name: string; desc: string }
> = {
  aggressive: { name: 'Ace Wolf', desc: 'Relentless raiser. Bettor.' },
  passive: { name: 'Tight Gate', desc: 'Checks when quiet, rarely bluffs.' },
  balanced: { name: 'Silver Fox', desc: 'Reads the table, plays the odds.' },
  wild: { name: 'Vega', desc: 'Chaos agent. Anything can happen.' },
};

export interface AIPlayer {
  id: string;
  name: string;
  personality: Personality;
}

export interface UserSettings {
  sound: boolean;
  animations: 'full' | 'reduced';
  theme: 'dark' | 'light';
}

export interface UserProfile {
  username: string;
  avatarId: string;
  gamesPlayed: number;
  pokerHands: number;
  pokerWins: number;
  pokerNet: number;
  bankrollHigh: number;
  biggestWin: number;
  favoriteGame: string;
  dailyStreak: number;
  lastDailyClaimed: string | null; // yyyy-mm-dd
  joined: number;
  /** Online/live-tagged poker style stats */
  volPreflop: number; // VPIP %
  pfr: number; // % of hands raised preflop
  vpipOpportunities: number; // hands dealt in
  vpipHands: number; // hands with a voluntary preflop investment
  pfrHands: number; // hands with a preflop raise
}

export interface SessionUser {
  username: string;
  avatarId: string;
  createdAt: number;
}

export interface StatsSummary {
  gamesPlayed: number;
  poker: {
    hands: number;
    wins: number;
    losses: number;
    winRate: number;
    biggestWin: number;
  };
}

export interface Toast {
  id: string;
  tone: 'good' | 'bad' | 'gold' | 'info';
  title: string;
  message?: string;
}

export interface ActivityEntry {
  id: string;
  ts: number;
  icon: string;
  text: string;
  tone: 'gold' | 'good' | 'bad' | 'neutral';
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  avatarId: string;
  value: number;
  tag?: string;
  isMe?: boolean;
}