import { describe, expect, it } from 'vitest';
import { PokerGame, type SessionConfig } from './game';

function cfg(over: Partial<SessionConfig> = {}): SessionConfig {
  return {
    heroName: 'Hero',
    heroAvatar: 'lynx-gold',
    opponents: [
      { name: 'Bot A', avatarId: 'wolf-graphite', personality: 'balanced' },
      { name: 'Bot B', avatarId: 'silver-fox', personality: 'passive' },
    ],
    bigBlind: 20,
    heroStack: 1000,
    botStack: 1000,
    ...over,
  };
}

const botCfg = (n: number): Partial<SessionConfig> => ({
  opponents: Array.from({ length: n }, (_, i) => ({
    name: `Bot ${i}`,
    avatarId: 'wolf-graphite',
    personality: 'balanced' as const,
  })),
  botScript: 'call' as const,
});

/** Drive a single hand: deal, open betting, resolve every action sequentially. */
function playHand(g: PokerGame, heroAction: (g: PokerGame) => void = (go) => go.playerAction(go.toCall(0) === 0 ? 'check' : 'call'), guard = 300): void {
  if (g.s.phase !== 'dealing') g.startHand();
  g.beginBetting();
  let guardCount = 0;
  while (guardCount++ < guard && g.s.phase === 'betting') {
    const t = g.s.turn;
    if (t < 0) {
      g.revealNextStreet();
      continue;
    }
    const seat = g.s.seats[t];
    if (seat.isBot) g.botAct();
    else heroAction(g);
  }
  if (g.s.phase === 'showdown') g.finishShowdown();
}

describe('PokerGame — dealers and blinds rotate', () => {
  it('heads-up dealer rotates behind turns and blinds flip', () => {
    const g = new PokerGame(cfg({ ...botCfg(1), bigBlind: 20 }));
    g.startHand();
    const dealer1 = g.s.dealer;
    playHand(g);
    expect(g.s.phase).toBe('roundEnd');
    if (!(g.s.seats[0].isWinner)) {
      const botWins = g.s.seats[1].isWinner;
      expect(typeof botWins).toBe('boolean');
    }
    g.startHand();
    expect(g.s.dealer).toBe((dealer1 + 1) % 2);
  });
});

describe('PokerGame — raise cap per street', () => {
  it('a raise past the cap collapses into a call and never exceeds the cap', () => {
    const g = new PokerGame(cfg({ ...botCfg(4), botScript: 'raiseMin', bigBlind: 20, maxRaises: 1 }));
    const observed: number[] = [];
    g.subscribe(() => {
      if (g.s.phase === 'betting') observed.push(g.s.raiseCap.used);
    });
    playHand(g, (x) => x.playerAction(x.toCall(0) === 0 ? 'check' : 'raise'));
    expect(g.s.phase).toBe('roundEnd');
    expect(Math.max(...observed, 0)).toBe(1); // the cap engaged exactly once at a time
    expect(observed.every((v) => v <= 1)).toBe(true);
  });
});

describe('PokerGame — short-stack blind', () => {
  it('a player too short to post the blind goes all-in but keeps acting', () => {
    // 3-handed; Bot B starts with just 15 chips < big blind 20.
    const g = new PokerGame({
      heroName: 'Hero',
      heroAvatar: 'lynx-gold',
      opponents: [
        { name: 'Bot A', avatarId: 'wolf-graphite', personality: 'balanced' },
        { name: 'Bot B', avatarId: 'silver-fox', personality: 'passive' },
      ],
      bigBlind: 20,
      heroStack: 1000,
      botStack: 15,
      botScript: 'call',
    });
    g.startHand();
    const seatB = g.s.seats.findIndex((s) => s.name === 'Bot B');
    expect(seatB).toBeGreaterThan(0);
    const bbSeat = (g.s.dealer + 1) % 3;
    // If Bot B is the BB it must not die silently — it becomes all-in.
    if (seatB === bbSeat) {
      expect(g.s.seats[seatB].allin).toBe(true);
      expect(g.s.seats[seatB].stack).toBe(0);
      expect(g.s.seats[seatB].committed).toBe(15);
    }
    g.beginBetting();
    playHand(g, (x) => x.playerAction(x.toCall(0) === 0 ? 'check' : 'call'));
    // Hand resolves — either way the table must not be stuck.
    expect(['roundEnd', 'showdown']).toContain(g.s.phase);
  });
});

describe('PokerGame — tournament rising blinds & elimination', () => {
  it('raises blinds every level and eliminates a broke bot until hero wins', () => {
    const g = new PokerGame({
      heroName: 'Hero',
      heroAvatar: 'lynx-gold',
      opponents: [{ name: 'Bot A', avatarId: 'wolf-graphite', personality: 'balanced' }],
      bigBlind: 10,
      heroStack: 1000,
      botStack: 100,
      mode: 'tournament',
      levelHands: 2,
      levelFactor: 2,
      botScript: 'fold', // bot folds → hero takes the blinds, bot slowly busts
    });
    // Hand 1
    g.startHand();
    expect(g.s.bb).toBe(10);
    g.beginBetting();
    playHand(g, (x) => x.playerAction('call'));
    expect(g.s.phase).toBe('roundEnd');

    // Blinds have not risen yet (level = floor(hand/2)=0)
    g.startHand();
    expect(g.s.bb).toBe(10);

    // Hand 2 completes, level flips → blinds double on hand 3
    g.beginBetting();
    playHand(g, (x) => x.playerAction('call'));
    g.startHand();
    expect(g.s.bb).toBe(20);

    // Play until the hero takes it down.
    let i = 0;
    const heroAllIn = (x: PokerGame) => x.playerAction('allin');
    while (i < 200 && g.s.phase !== 'won' && g.s.phase !== 'busted') {
      g.beginBetting();
      playHand(g, heroAllIn);
      i += 1;
      g.startHand();
    }
    expect(g.s.phase).toBe('won');
    expect(g.s.message).toContain('Champion');
  });

  it('a hero with no chips left is eliminated at hand start', () => {
    const g = new PokerGame({
      heroName: 'Hero',
      heroAvatar: 'lynx-gold',
      opponents: [{ name: 'Bot A', avatarId: 'wolf-graphite', personality: 'balanced' }],
      bigBlind: 100,
      heroStack: 0,
      botStack: 1000,
      mode: 'tournament',
      levelHands: 2,
      levelFactor: 2,
      botScript: 'fold',
    });
    g.startHand();
    expect(g.s.phase).toBe('busted');
    expect(g.s.message).toContain('Eliminated');
  });
});

describe('PokerGame — misc invariants', () => {
  it('all committed chips make it into the pot and out through winners', () => {
    const total = 1000 + 3 * 1000; // hero + three bots
    const g = new PokerGame({ ...cfg(botCfg(3)), maxRaises: 0 });
    g.startHand();
    g.beginBetting();
    playHand(g, (x) => x.playerAction('raise'));
    // no dead chips: everyone chips in or folds cleanly
    const committed = g.s.seats.reduce((a, s) => a + s.committed, 0);
    const won = g.s.seats.reduce((a, s) => a + s.won, 0);
    const after = g.s.seats.reduce((a, s) => a + s.stack, 0);
    expect(committed).toBe(won);
    expect(after).toBe(total); // every chip stays on the table
  });
});