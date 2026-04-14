// src/types/index.ts

export type Slot      = number | null;
export type GameMode  = 'solo' | 'multi';
export type GameState = 'idle' | 'rolled' | 'over' | 'jackpot';
export type RankName  = 'Beginner' | 'Junior' | 'Senior' | 'Supreme' | 'Global';

export interface RankTier {
  name:  RankName;
  scope: string;
  icon:  string;
  min:   number;
  max:   number;
}

export interface Player {
  uid:       string;
  id:        string;
  username:  string;
  email:     string;
  pts:       number;
  rank:      RankName;
  online:    boolean;
  location:  string;
}

export interface FriendData {
  uid:      string;
  id:       string;
  username: string;
  rank:     RankName;
  pts:      number;
  online:   boolean;
}

export interface ChatMessage {
  id:             string;
  fromUid:        string;
  fromUsername:   string;
  text:           string;
  timestamp:      any;
  visibleOffline: boolean;
}

export interface Conversation {
  withUid:      string;
  withUsername: string;
  lastMsg:      string;
  lastTime:     number;
  online:       boolean;
}

export interface FriendRequest {
  id:           string;
  fromUid:      string;
  fromUsername: string;
  fromId:       string;
  fromRank:     RankName;
  fromPts:      number;
}

export const RANKS: RankTier[] = [
  { name: 'Beginner', scope: 'Barangay', icon: '🌱', min: 0,    max: 49   },
  { name: 'Junior',   scope: 'City',     icon: '🏙️', min: 50,   max: 199  },
  { name: 'Senior',   scope: 'Province', icon: '🏔️', min: 200,  max: 499  },
  { name: 'Supreme',  scope: 'Country',  icon: '🦅', min: 500,  max: 999  },
  { name: 'Global',   scope: 'World',    icon: '🌏', min: 1000, max: Infinity },
];

export const C = {
  gold:    '#EF9F27',
  goldD:   '#BA7517',
  goldBg:  '#FAEEDA',
  green:   '#1D9E75',
  greenBg: '#E1F5EE',
  greenD:  '#0F6E56',
  red:     '#E24B4A',
  redBg:   '#FCEBEB',
  redD:    '#A32D2D',
  border:  '#E2E0D8',
  bg:      '#FFFFFF',
  bg2:     '#F5F4F0',
  text:    '#1A1A1A',
  text2:   '#6B6A66',
  text3:   '#A09E99',
  info:    '#378ADD',
};

export function getRank(pts: number): RankTier {
  return RANKS.find(r => pts >= r.min && pts <= r.max) ?? RANKS[0];
}

export function initials(name: string): string {
  return name.substring(0, 2).toUpperCase();
}

export function generatePlayerId(): string {
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

export function validateUsername(u: string): string | null {
  if (u.length < 6)               return 'Username must be at least 6 characters.';
  if (u.length > 16)              return 'Username must be 16 characters or less.';
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Only letters, numbers and underscores allowed.';
  return null;
}
