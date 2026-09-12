import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ActivityEntry,
  SessionUser,
  Toast,
  Transaction,
  UserProfile,
  UserSettings,
} from '../types';
import { load, save, uid, todayKey, fmtNumber, fmtSign } from '../lib/utils';
import { setSoundEnabled } from '../lib/sound';

interface RegisteredUser {
  username: string;
  passwordHash: string;
  avatarId: string;
  createdAt: number;
}

/**
 * Демонстрационное хэширование пароля через Web Crypto (SHA-256 + соль).
 * Это клиентское приложение без backend, поэтому пароли всё равно нельзя
 * защитить по-настоящему — но хранить их в открытом виде в localStorage
 * не следует даже в демо. В реальном проекте хэширование и хранение
 * учётных данных должны выполняться на сервере (bcrypt/argon2).
 */
async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function makePasswordHash(password: string): Promise<string> {
  const salt = crypto.randomUUID();
  return `${salt}$${await hashPassword(password, salt)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split('$');
  if (!salt || !expected) return false;
  const actual = await hashPassword(password, salt);
  return actual === expected;
}

export interface AppContextValue {
  user: SessionUser | null;
  ready: boolean;
  balance: number;
  txHistory: Transaction[];
  profile: UserProfile;
  settings: UserSettings;
  toasts: Toast[];
  activity: ActivityEntry[];
  register: (username: string, password: string, avatarId: string) => Promise<{ ok: boolean; error?: string }>;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateSession: (patch: Partial<SessionUser>) => void;
  addCredits: (amount: number, category: Transaction['category'], detail: string, opts?: { silent?: boolean }) => void;
  spendCredits: (amount: number, category: Transaction['category'], detail: string, opts?: { silent?: boolean }) => boolean;
  recordPokerHand: (delta: number, detail: string) => void;
  recordPokerStats: (stat: { vpip: boolean; pfr: boolean }) => void;
  recordGameRound: (delta: number, game: string, detail: string) => void;
  claimDaily: () => { amount: number; streak: number } | null;
  isDailyClaimed: () => boolean;
  nextDailyReset: () => number;
  setSettings: (patch: Partial<UserSettings>) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'ts'>) => void;
  grantBonus: (amount: number, detail: string, kind: 'daily' | 'rebuy' | 'promo') => void;
  hasTopUpToday: () => boolean;
}

const STARTING_CREDITS = 5000;
const DAILY_BONUS_BASE = 250;

const AppContext = createContext<AppContextValue | null>(null);

function defaultProfile(username: string): UserProfile {
  return {
    username,
    avatarId: 'lynx-gold',
    gamesPlayed: 0,
    pokerHands: 0,
    pokerWins: 0,
    pokerNet: 0,
    bankrollHigh: STARTING_CREDITS,
    biggestWin: 0,
    favoriteGame: '—',
    dailyStreak: 0,
    lastDailyClaimed: null,
    joined: Date.now(),
    volPreflop: 0,
    pfr: 0,
    vpipOpportunities: 0,
    vpipHands: 0,
    pfrHands: 0,
  };
}

const defaultSettings: UserSettings = {
  sound: true,
  animations: 'full',
  theme: 'dark',
};

function readUsers(): RegisteredUser[] {
  return load<RegisteredUser[]>('users', []);
}
function writeUsers(u: RegisteredUser[]): void {
  save('users', u);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettingsState] = useState<UserSettings>(defaultSettings);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const txCounter = useRef(1);
  const balanceRef = useRef(0);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = uid('t');
    setToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addActivity = useCallback((entry: Omit<ActivityEntry, 'id' | 'ts'>) => {
    setActivity((prev) => [{ ...entry, id: uid('a'), ts: Date.now() }, ...prev].slice(0, 40));
  }, []);

  const recordTx = useCallback(
    (
      category: Transaction['category'],
      amount: number,
      detail: string,
    ) => {
      txCounter.current += 1;
      const tx: Transaction = { id: uid('x'), ts: Date.now(), category, amount, detail, tx: txCounter.current };
      setTxHistory((prev) => [tx, ...prev].slice(0, 400));
      return tx;
    },
    [],
  );

  // ---- Hydration ----
  useEffect(() => {
    const storedUser = load<SessionUser | null>('session', null);
    const storedSettings = load<UserSettings>('settings', defaultSettings);
    const storedActivity = load<ActivityEntry[]>('activity', []);
    setUser(storedUser);
    setSettingsState({ ...defaultSettings, ...storedSettings });
    setActivity(storedActivity);
    if (storedUser) {
      const p = load<UserProfile>(`profile.${storedUser.username}`, defaultProfile(storedUser.username));
      setProfile(p);
      const b = load<number>(`balance.${storedUser.username}`, p.bankrollHigh);
      const tx = load<Transaction[]>(`tx.${storedUser.username}`, []);
      setBalance(b);
      setTxHistory(tx);
      txCounter.current = tx.length;
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    setSoundEnabled(settings.sound);
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.setAttribute('data-motion', settings.animations === 'reduced' ? 'reduced' : 'full');
  }, [ready, settings]);

  useEffect(() => {
    if (!ready) return;
    if (user) {
      setProfile((prev) => prev ?? defaultProfile(user.username));
    }
  }, [ready, user]);

  useEffect(() => {
    if (!ready) return;
    save('session', user);
    if (user) {
      save(`balance.${user.username}`, balance);
      save(`tx.${user.username}`, txHistory);
      save(`profile.${user.username}`, profile);
    }
    save('settings', settings);
    save('activity', activity);
  }, [ready, user, balance, txHistory, settings, activity, profile]);

  const register = useCallback(
    async (username: string, password: string, avatarId: string): Promise<{ ok: boolean; error?: string }> => {
      const name = username.trim();
      if (name.length < 3) return { ok: false, error: 'Username must be at least 3 characters.' };
      if (/[^a-zA-Z0-9_\- ]/.test(name)) return { ok: false, error: 'Letters, numbers, spaces, dashes and underscores only.' };
      if (password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };
      const users = readUsers();
      if (users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
        return { ok: false, error: 'That username is already taken.' };
      }
      const passwordHash = await makePasswordHash(password);
      const nu: RegisteredUser = { username: name, passwordHash, avatarId, createdAt: Date.now() };
      writeUsers([...users, nu]);
      const su: SessionUser = { username: name, avatarId, createdAt: Date.now() };
      setUser(su);
      setProfile(defaultProfile(name));
      setBalance(STARTING_CREDITS);
      setTxHistory([recordTx('bonus', STARTING_CREDITS, 'Welcome package for new players')]);
      addActivity({ icon: 'spark', text: `Welcome to Noir Royale, ${name}!`, tone: 'gold' });
      pushToast({ tone: 'gold', title: 'Welcome, ' + name, message: `You received ${fmtNumber(STARTING_CREDITS)}.` });
      return { ok: true };
    },
    [addActivity, pushToast, recordTx],
  );

  const login = useCallback(
    async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      const users = readUsers();
      const found = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
      if (!found || !(await verifyPassword(password, found.passwordHash))) {
        return { ok: false, error: 'Invalid username or password.' };
      }
      const su: SessionUser = { username: found.username, avatarId: found.avatarId, createdAt: found.createdAt };
      setUser(su);
      setProfile(load<UserProfile>(`profile.${found.username}`, defaultProfile(found.username)));
      setBalance(load<number>(`balance.${found.username}`, STARTING_CREDITS));
      setTxHistory(load<Transaction[]>(`tx.${found.username}`, []));
      addActivity({ icon: 'login', text: 'Signed in', tone: 'neutral' });
      pushToast({ tone: 'info', title: 'Welcome back, ' + found.username });
      return { ok: true };
    },
    [addActivity, pushToast],
  );

  const logout = useCallback(() => {
    setUser(null);
    setProfile(null);
    setBalance(0);
    setTxHistory([]);
    pushToast({ tone: 'info', title: 'Signed out', message: 'Your session has ended.' });
  }, [pushToast]);

  const updateSession = useCallback((patch: Partial<SessionUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const addCredits = useCallback(
    (
      amount: number,
      category: Transaction['category'],
      detail: string,
      opts?: { silent?: boolean },
    ) => {
      setBalance((b) => b + amount);
      recordTx(category, amount, detail);
      if (!opts?.silent) {
        pushToast({ tone: 'good', title: fmtSign(amount), message: detail });
      }
    },
    [pushToast, recordTx],
  );

  const spendCredits = useCallback(
    (amount: number, category: Transaction['category'], detail: string, opts?: { silent?: boolean }) => {
      let ok = false;
      setBalance((b) => {
        if (b >= amount) {
          ok = true;
          recordTx(category, -amount, detail);
          return b - amount;
        }
        return b;
      });
      if (ok && !opts?.silent) pushToast({ tone: 'info', title: fmtSign(-amount), message: detail });
      return ok;
    },
    [pushToast, recordTx],
  );

  const recordPokerHand = useCallback(
    (delta: number, detail: string) => {
      setProfile((prev) => {
        if (!prev) return prev;
        const next: UserProfile = {
          ...prev,
          pokerHands: prev.pokerHands + 1,
          pokerWins: delta > 0 ? prev.pokerWins + 1 : prev.pokerWins,
          pokerNet: (prev.pokerNet ?? 0) + delta,
          gamesPlayed: prev.gamesPlayed + 1,
          biggestWin: Math.max(prev.biggestWin, delta > 0 ? delta : 0),
          favoriteGame: 'Texas Hold\u2019em',
          bankrollHigh: Math.max(prev.bankrollHigh, balanceRef.current + delta),
        };
        return next;
      });
      setBalance((b) => b + delta);
      const category: Transaction['category'] = delta > 0 ? 'win' : delta < 0 ? 'wager' : 'bonus';
      if (delta !== 0) recordTx(category, delta, detail);
      if (delta > 0) addActivity({ icon: 'cards', text: `Won ${fmtNumber(delta)} in Texas Hold\u2019em`, tone: 'good' });
    },
    [addActivity, recordTx],
  );

  const recordPokerStats = useCallback(
    (stat: { vpip: boolean; pfr: boolean }) => {
      setProfile((prev) => {
        if (!prev) return prev;
        const opportunities = prev.vpipOpportunities + 1;
        const vpipHands = prev.vpipHands + (stat.vpip ? 1 : 0);
        const pfrHands = prev.pfrHands + (stat.pfr ? 1 : 0);
        const next: UserProfile = {
          ...prev,
          vpipOpportunities: opportunities,
          vpipHands,
          pfrHands,
          volPreflop: opportunities > 0 ? Math.round((vpipHands / opportunities) * 100) : 0,
          pfr: opportunities > 0 ? Math.round((pfrHands / opportunities) * 100) : 0,
        };
        return next;
      });
    },
    [],
  );

  const recordGameRound = useCallback(
    (delta: number, game: string, detail: string) => {
      setProfile((prev) => {
        if (!prev) return prev;
        const next: UserProfile = {
          ...prev,
          gamesPlayed: prev.gamesPlayed + 1,
          biggestWin: Math.max(prev.biggestWin, delta > 0 ? delta : 0),
          favoriteGame: prev.favoriteGame === '—' ? game : prev.favoriteGame,
          bankrollHigh: Math.max(prev.bankrollHigh, balanceRef.current + delta),
        };
        return next;
      });
      setBalance((b) => b + delta);
      const category: Transaction['category'] = delta > 0 ? 'win' : delta < 0 ? 'wager' : 'bonus';
      if (delta !== 0) recordTx(category, delta, detail);
      if (delta > 0) addActivity({ icon: 'dice', text: `Won ${fmtNumber(delta)} on ${game}`, tone: 'good' });
    },
    [addActivity, recordTx],
  );

  const isDailyClaimed = useCallback(() => {
    const last = load<string | null>('daily-claimed', null);
    return last === todayKey();
  }, []);

  const nextDailyReset = useCallback(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    return next.getTime() - now.getTime();
  }, []);

  const claimDaily = useCallback((): { amount: number; streak: number } | null => {
    if (isDailyClaimed()) return null;
    const last = load<string | null>('daily-claimed', null);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const streakBase = profile?.dailyStreak ?? 0;
    const streak = last === todayKey(yesterday) ? streakBase + 1 : 1;
    const amount = DAILY_BONUS_BASE * streak;
    save('daily-claimed', todayKey());
    setProfile((prev) => (prev ? { ...prev, dailyStreak: streak, lastDailyClaimed: todayKey() } : prev));
    setBalance((b) => b + amount);
    recordTx('bonus', amount, `Daily virtual bonus (streak ${streak})`);
    addActivity({ icon: 'sun', text: `Claimed daily bonus: ${fmtNumber(amount)}`, tone: 'gold' });
    pushToast({ tone: 'gold', title: `Daily bonus: ${fmtSign(amount)}`, message: `${streak}-day streak. See you tomorrow!` });
    return { amount, streak };
  }, [addActivity, isDailyClaimed, profile, pushToast, recordTx]);

  const grantBonus = useCallback(
    (amount: number, detail: string, kind: 'daily' | 'rebuy' | 'promo') => {
      setBalance((b) => b + amount);
      recordTx('bonus', amount, detail);
      addActivity({ icon: 'gift', text: detail, tone: 'gold' });
      pushToast({ tone: 'gold', title: fmtSign(amount), message: detail });
    },
    [addActivity, pushToast, recordTx],
  );

  const hasTopUpToday = useCallback(() => {
    const todayTops = txHistory.filter((t) => t.category === 'topup' && new Date(t.ts).toDateString() === new Date().toDateString());
    return todayTops.length >= 3;
  }, [txHistory]);

  const setSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      ready,
      balance,
      txHistory,
      profile: profile ?? defaultProfile('guest'),
      settings,
      toasts,
      activity: activity.slice(0, 12),
      register,
      login,
      logout,
      updateSession,
      addCredits,
      spendCredits,
      recordPokerHand,
      recordPokerStats,
      recordGameRound,
      claimDaily,
      isDailyClaimed,
      nextDailyReset,
      setSettings,
      updateProfile,
      pushToast,
      dismissToast,
      addActivity,
      grantBonus,
      hasTopUpToday,
    }),
    [
      user, ready, balance, txHistory, profile, settings, toasts, activity,
      register, login, logout, updateSession, addCredits, spendCredits,
      recordPokerHand, recordGameRound, claimDaily, isDailyClaimed, nextDailyReset,
      setSettings, updateProfile, pushToast, dismissToast,
      addActivity, grantBonus, hasTopUpToday,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}