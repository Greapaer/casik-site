import type { Card, Personality } from '../../types';
import { cardLabel, cardValue, makeDeck } from './deck';
import { compareHands, evaluate7 } from './handEval';
import { decideBot } from './ai';
import { buildPotLayers, payoutLayers, pickWinnersByLayer } from './pot';

export type Phase = 'idle' | 'dealing' | 'betting' | 'showdown' | 'roundEnd' | 'busted' | 'won';
export type GameMode = 'cash' | 'tournament' | 'sitngo';

export interface PokerSeat {
  name: string;
  avatarId: string;
  isBot: boolean;
  personality?: Personality;
  stack: number;
  hole: Card[];
  folded: boolean;
  allin: boolean;
  eliminated: boolean;
  hasActed: boolean;
  bet: number;
  committed: number;
  lastAction: string;
  show: boolean;
  isWinner: boolean;
  won: number;
}

export interface PotLayer {
  amount: number;
  winners: string[];
  label: string;
  eligible: number[];
}

export interface LogLine {
  seat: string;
  text: string;
  /** 0 preflop, 3 flop, 4 turn, 5 river/showdown */
  street?: number;
}

export interface GameSnapshot {
  phase: Phase;
  seats: PokerSeat[];
  dealer: number;
  board: Card[];
  pot: number;
  layers: PotLayer[];
  currentBet: number;
  minRaiseTotal: number;
  turn: number;
  street: number;
  handNum: number;
  message: string;
  log: LogLine[];
  heroDelta: number;
  lastWinningHand: string | null;
  mode: GameMode;
  /** current effective big blind (grows in tournaments) */
  bb: number;
  level: number;
  raiseCap: { used: number; max: number };
  /** human seats kept at the table even when a bot is eliminated */
  activeCount: number;
  /** nonce so clients can tell identical snapshots apart */
  cipher: number;
}

export interface SessionConfig {
  heroName: string;
  heroAvatar: string;
  opponents: { name: string; avatarId: string; personality: Personality }[];
  bigBlind: number;
  heroStack: number;
  botStack: number;
  mode?: GameMode;
  /** 0 = unlimited raises per street */
  maxRaises?: number;
  /** tournament level length in hands (blinds rise every N hands) */
  levelHands?: number;
  levelFactor?: number;
  /** deterministic bot behavior (mainly for tests) */
  botScript?: 'auto' | 'fold' | 'call' | 'raiseMin' | 'check';
  /** seats occupied by real humans (default [0]); others are driven by decideBot */
  humanSeats?: number[];
}

export function makeSeat(cfg: SessionConfig["opponents"][number] | null, name: string, avatarId: string, stack: number, isBot: boolean): PokerSeat {
  return {
    name,
    avatarId,
    isBot,
    personality: isBot && cfg ? cfg.personality : undefined,
    stack,
    hole: [],
    folded: false,
    allin: false,
    eliminated: false,
    hasActed: false,
    bet: 0,
    committed: 0,
    lastAction: '',
    show: false,
    isWinner: false,
    won: 0,
  };
}

export class PokerGame {
  private cfg: SessionConfig;
  private listeners = new Set<() => void>();
  s: GameSnapshot;
  private lastIncrement: number;
  private raiseCount = 0;
  private deck: Card[] = [];
  private handCounter = 0;
  private currentBlind: number;
  private dealerIdx = -1;
  private nonce = 0;

  /** Persistent stacks + identity, survives hand rebuilds */
  private live: { stack: number; name: string; avatarId: string; personality?: Personality }[] = [];

  constructor(cfg: SessionConfig) {
    this.cfg = {
      mode: 'cash',
      maxRaises: 0,
      levelHands: 8,
      levelFactor: 1.8,
      ...cfg,
    };
    this.lastIncrement = this.cfg.bigBlind;
    this.currentBlind = this.cfg.bigBlind;
    this.s = this.freshSnapshot();
    this.live.push({ stack: cfg.heroStack, name: cfg.heroName, avatarId: cfg.heroAvatar });
    for (const o of cfg.opponents) {
      this.live.push({ stack: cfg.botStack, name: o.name, avatarId: o.avatarId, personality: o.personality });
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.nonce += 1;
    this.s.cipher = this.nonce;
    this.s.minRaiseTotal = this.minRaiseTotal;
    this.s.pot = this.totalPot;
    this.s.raiseCap = { used: this.raiseCount, max: this.cfg.maxRaises ?? 0 };
    this.listeners.forEach((fn) => fn());
  }

  private freshSnapshot(): GameSnapshot {
    return {
      phase: 'idle',
      seats: [],
      dealer: 0,
      board: [],
      pot: 0,
      layers: [],
      currentBet: 0,
      minRaiseTotal: 0,
      turn: -1,
      street: 0,
      handNum: 0,
      message: 'Welcome to the table.',
      log: [],
      heroDelta: 0,
      lastWinningHand: null,
      mode: this.cfg.mode ?? 'cash',
      bb: this.currentBlind,
      level: 0,
      raiseCap: { used: 0, max: this.cfg.maxRaises ?? 0 },
      activeCount: this.live.length,
      cipher: 0,
    };
  }

  get totalPot(): number {
    return this.s.seats.reduce((a, s) => a + s.committed, 0);
  }

  get seatCount(): number {
    return this.s.seats.length;
  }

  private activeSeats(): number[] {
    return this.s.seats.map((s, i) => (s.eliminated ? -1 : i)).filter((i) => i >= 0);
  }

  private get isHeadsUp(): boolean {
    return this.activeSeats().length === 2;
  }

  private getOrderFrom(dealer: number): number[] {
    const n = this.live.length;
    const active = this.activeSeats();
    if (active.length === 0) return [];
    const out: number[] = [];
    for (let k = 1; k <= n; k++) {
      const idx = (dealer + k) % n;
      if (active.includes(idx)) out.push(idx);
    }
    return out;
  }

  getOrder(): number[] {
    return this.getOrderFrom(this.s.dealer);
  }

  startHand(): void {
    if (this.s.phase !== 'idle' && this.s.phase !== 'roundEnd' && this.s.phase !== 'won') return;

    if (this.s.seats.length === this.live.length) {
      this.s.seats.forEach((seat, i) => {
        this.live[i].stack = seat.stack;
      });
    }

    const isTournament = this.cfg.mode !== 'cash';
    const heroGone = this.live[0].stack <= 0;

    if (isTournament) {
      // mark previously-clipped bots as eliminated
      const eliminatedSet = new Set<number>();
      for (let i = 1; i < this.live.length; i++) {
        if (this.live[i].stack <= 0) eliminatedSet.add(i);
      }
      const actives = [...eliminatedSet].length === this.live.length - 1 ? 1 : this.live.length - eliminatedSet.size;
      if (heroGone || actives <= 1) {
        if (heroGone) {
          this.s.phase = 'busted';
          this.s.message =
            actives === this.live.length
              ? 'Eliminated — no virtual chips left.'
              : `Eliminated — you finished #${actives} of ${this.live.length}.`;
        } else {
          this.s.phase = 'won';
          this.s.message = `Champion! You took down the ${this.cfg.mode === 'sitngo' ? 'Sit & Go' : 'tournament'}.`;
        }
        this.emit();
        return;
      }
      const level = Math.floor(this.handCounter / (this.cfg.levelHands ?? 8));
      this.currentBlind = Math.max(
        this.cfg.bigBlind,
        Math.round(this.cfg.bigBlind * Math.pow(this.cfg.levelFactor ?? 1.8, level)),
      );
    } else {
      this.currentBlind = this.cfg.bigBlind;
      if (heroGone) {
        this.s.phase = 'busted';
        this.s.message = 'You ran out of virtual chips — rebuy to continue.';
        this.emit();
        return;
      }
      for (let i = 1; i < this.live.length; i++) {
        if (this.live[i].stack <= 0) this.live[i].stack = this.cfg.botStack;
      }
    }

    this.s = this.freshSnapshot();
    this.handCounter += 1;
    this.s.handNum = this.handCounter;
    this.s.mode = this.cfg.mode ?? 'cash';
    this.s.bb = this.currentBlind;
    this.s.level = isTournament ? Math.floor((this.handCounter - 1) / (this.cfg.levelHands ?? 8)) + 1 : 0;
    this.lastIncrement = this.currentBlind;
    this.raiseCount = 0;
    this.logLine('Table', `New hand · ${this.s.mode === 'cash' ? 'cash' : this.s.mode === 'sitngo' ? 'Sit & Go' : 'tournament'} · BB ${this.s.bb}.`, 0);

    // Rotate the button across participating seats
    const participants = this.live.map((_, i) => i);
    const eligible = this.cfg.mode === 'cash' ? participants : participants.filter((i) => (i === 0 ? this.live[0].stack > 0 : this.live[i].stack > 0));
    if (!eligible.includes(this.dealerIdx) || this.dealerIdx === -1) {
      this.dealerIdx = eligible.length > 0 ? eligible[eligible.length - 1] : 0;
    }
    const di = eligible.indexOf(this.dealerIdx);
    this.dealerIdx = eligible[(di + 1) % eligible.length];

    // Rebuild seats keeping stacks + elimination flags
    const humanSeats = new Set(this.cfg.humanSeats ?? [0]);
    this.s.seats = [];
    for (let i = 0; i < this.live.length; i++) {
      const l = this.live[i];
      const isBot = !humanSeats.has(i);
      this.s.seats.push(
        isBot
          ? makeSeat({ name: l.name, avatarId: l.avatarId, personality: l.personality ?? 'balanced' }, l.name, l.avatarId, l.stack, true)
          : makeSeat(null, l.name, l.avatarId, l.stack, false),
      );
    }
    if (isTournament) {
      for (let i = 1; i < this.live.length; i++) {
        if (this.live[i].stack <= 0) this.s.seats[i].eliminated = true;
      }
    }
    this.s.dealer = this.dealerIdx;
    this.s.activeCount = this.activeSeats().length;

    // Dealing to everyone still in
    const deck = makeDeck();
    const dealOrder = this.getOrder();
    for (let round = 0; round < 2; round++) {
      for (const idx of dealOrder) {
        const card = deck.pop();
        if (card) this.s.seats[idx].hole.push(card);
      }
    }
    this.deck = deck;

    this.postBlinds();
    this.s.turn = -1;
    this.s.phase = 'dealing';
    this.s.message = `Hand #${this.s.handNum} — dealing… (blinds $${this.currentBlind / 2} / $${this.currentBlind})`;
    this.logLine('Table', `New hand #${this.s.handNum}. Blinds $${this.currentBlind / 2} / $${this.currentBlind}${this.s.level > 1 ? ` · Level ${this.s.level}` : ''}`);
    this.emit();
  }

  /** Called by the UI once the dealing animation completes — opens the preflop betting round */
  beginBetting(): void {
    if (this.s.phase !== 'dealing') return;
    this.s.phase = 'betting';
    this.s.turn = this.firstToAct(true);
    const actor = this.s.turn >= 0 ? this.s.seats[this.s.turn].name : 'Table';
    this.s.message = `${actor} to act.`;
    this.emit();
  }

  rebuy(): void {
    if (this.s.phase !== 'busted' || this.cfg.mode !== 'cash') return;
    this.live[0].stack = this.cfg.heroStack;
    for (let i = 1; i < this.live.length; i++) {
      if (this.live[i].stack <= 0) this.live[i].stack = this.cfg.botStack;
    }
    this.s = this.freshSnapshot();
    this.s.message = 'Fresh virtual chips on the table. Good luck.';
    this.emit();
  }

  private postBlinds(): void {
    const bb = this.currentBlind;
    const order = this.getOrder();
    if (order.length < 2) return;
    const isHU = this.isHeadsUp;
    const sbIdx = isHU ? this.s.dealer : order[0];
    const bbIdx = isHU ? order[0] : order[1];
    this.forceBet(sbIdx, Math.floor(bb / 2));
    this.forceBet(bbIdx, bb);
    // A short-stack blind caps the current bet at what was actually posted.
    this.s.currentBet = Math.min(bb, this.s.seats[bbIdx].committed);
    if (this.s.seats[sbIdx].allin) this.s.seats[sbIdx].hasActed = true;
    if (this.s.seats[bbIdx].allin) this.s.seats[bbIdx].hasActed = true;
    this.s.message = `Blinds posted — ${this.s.seats[sbIdx].name} $${Math.floor(bb / 2)}, ${this.s.seats[bbIdx].name} $${bb}.`;
  }

  private forceBet(idx: number, amount: number): void {
    const seat = this.s.seats[idx];
    const pay = Math.min(seat.stack, amount);
    seat.bet += pay;
    seat.committed += pay;
    seat.stack -= pay;
    if (seat.stack === 0) seat.allin = true;
    if (pay < amount) {
      seat.lastAction = `all-in $${pay}`;
    }
    this.s.pot = this.totalPot;
  }

  /** Seat who must act first preflop (1 left of BB, or dealer/SB heads-up) or first postflop (left of dealer) */
  private firstToAct(preflop: boolean): number {
    const n = this.seatCount;
    const order = this.getOrder();
    let start: number;
    if (preflop) {
      // HU: dealer (SB) acts first. Ring: first to act is left of the BB, i.e. order[2].
      start = this.isHeadsUp ? this.s.dealer : (order[2] ?? order[1] ?? order[0]);
    } else {
      start = order[0];
    }
    if (start === undefined || start < 0) return -1;
    for (let i = 0; i < n; i++) {
      const idx = (start + i) % n;
      const s = this.s.seats[idx];
      if (s && !s.folded && !s.allin && !s.eliminated) return idx;
    }
    return -1;
  }

  private alive(): number[] {
    return this.s.seats.map((s, i) => (s.folded || s.eliminated ? -1 : i)).filter((i) => i >= 0);
  }

  private actable(): number[] {
    return this.s.seats.map((s, i) => (s.folded || s.allin || s.eliminated ? -1 : i)).filter((i) => i >= 0);
  }

  toCall(idx: number): number {
    return Math.max(0, this.s.currentBet - this.s.seats[idx].bet);
  }

  get minRaiseTotal(): number {
    return this.s.currentBet + this.lastIncrement;
  }

  /** Hero convenience — seat 0. */
  playerAction(kind: 'fold' | 'check' | 'call' | 'raise' | 'allin', amount?: number): void {
    this.seatAction(0, kind, amount);
  }

  /** Generalized action — used for any human seat, including online play */
  seatAction(idx: number, kind: 'fold' | 'check' | 'call' | 'raise' | 'allin', amount?: number): void {
    if (this.s.phase !== 'betting' || this.s.turn !== idx) return;
    const seat = this.s.seats[idx];
    if (!seat || seat.folded || seat.allin || seat.eliminated) return;
    this.applyAction(idx, kind, amount);
  }

  botAct(): void {
    if (this.s.phase !== 'betting') return;
    const idx = this.s.turn;
    if (idx < 0 || !this.s.seats[idx].isBot || this.s.seats[idx].eliminated) return;
    const seat = this.s.seats[idx];
    const opponents = Math.max(1, this.alive().filter((i) => i !== idx).length);
    const script = this.cfg.botScript ?? 'auto';
    let action: { kind: 'fold' | 'check' | 'call' | 'raise' | 'allin'; amount?: number };
    if (script === 'fold') {
      action = { kind: this.toCall(idx) === 0 ? 'check' : 'fold' };
    } else if (script === 'call') {
      action = { kind: this.toCall(idx) === 0 ? 'check' : 'call' };
    } else if (script === 'check') {
      action = { kind: 'check' };
    } else if (script === 'raiseMin') {
      action = { kind: 'raise', amount: this.minRaiseTotal };
    } else {
      action = decideBot({
        personality: seat.personality ?? 'balanced',
        hole: seat.hole,
        board: this.s.board,
        pot: this.totalPot,
        toCall: this.toCall(idx),
        minRaiseTotal: this.minRaiseTotal,
        stack: seat.stack,
        bigBlind: this.s.bb,
        playersActive: opponents,
        street: this.s.street,
        handAggression: Math.min(1, this.raiseCount * 0.25),
        isLastFirst: false,
      });
    }
    this.applyAction(idx, action.kind, action.kind === 'raise' ? action.amount : undefined);
  }

  private canRaise(): boolean {
    const max = this.cfg.maxRaises ?? 0;
    return max === 0 || this.raiseCount < max;
  }

  private applyAction(idx: number, kind: 'fold' | 'check' | 'call' | 'raise' | 'allin', raw?: number): void {
    const seat = this.s.seats[idx];
    const toCall = this.toCall(idx);
    const name = seat.name;

    switch (kind) {
      case 'fold': {
        seat.folded = true;
        seat.lastAction = 'fold';
        this.s.message = `${name} folds.`;
        this.logLine(name, 'folds');
        break;
      }
      case 'check': {
        seat.hasActed = true;
        seat.lastAction = 'check';
        this.s.message = `${name} checks.`;
        this.logLine(name, 'checks');
        break;
      }
      case 'call': {
        const pay = Math.min(toCall, seat.stack);
        seat.bet += pay;
        seat.committed += pay;
        seat.stack -= pay;
        seat.hasActed = true;
        if (seat.stack === 0) seat.allin = true;
        seat.lastAction = `call $${pay}`;
        this.s.message = seat.allin ? `${name} calls all-in $${pay}.` : `${name} calls $${pay}.`;
        this.logLine(name, this.s.message);
        break;
      }
      case 'raise': {
        if (!this.canRaise()) {
          this.applyAction(idx, 'call');
          return;
        }
        const stackMax = seat.stack;
        if (stackMax <= toCall) {
          this.applyAction(idx, 'allin');
          return;
        }
        const target = raw === undefined ? this.minRaiseTotal : Math.round(raw);
        const clamped = Math.min(stackMax + seat.bet, Math.max(this.minRaiseTotal, target));
        const increment = clamped - this.s.currentBet;
        const pay = clamped - seat.bet;
        seat.bet = clamped;
        seat.committed += pay;
        seat.stack -= pay;
        seat.hasActed = true;
        seat.lastAction = `raise $${clamped}`;
        this.s.currentBet = clamped;
        this.lastIncrement = Math.max(this.currentBlind, increment);
        this.raiseCount += 1;
        this.s.message = seat.stack === 0 ? `${name} raises all-in to $${clamped}.` : `${name} raises to $${clamped}.`;
        this.logLine(name, this.s.message);
        this.s.seats.forEach((s, i) => {
          if (i !== idx && !s.folded && !s.allin && !s.eliminated) s.hasActed = false;
        });
        if (seat.stack === 0) seat.allin = true;
        break;
      }
      case 'allin': {
        const target = seat.bet + seat.stack;
        const increment = Math.max(0, target - this.s.currentBet);
        const pay = seat.stack;
        seat.bet = target;
        seat.committed += pay;
        seat.stack = 0;
        seat.allin = true;
        seat.hasActed = true;
        seat.lastAction = `all-in $${target}`;
        if (increment > 0) {
          if (!this.canRaise()) {
            this.applyAction(idx, 'call');
            return;
          }
          this.s.currentBet = target;
          this.lastIncrement = Math.max(this.lastIncrement, increment);
          this.raiseCount += 1;
          this.s.seats.forEach((s, i) => {
            if (i !== idx && !s.folded && !s.allin && !s.eliminated) s.hasActed = false;
          });
        }
        this.s.message = `${name} is all-in for $${target}.`;
        this.logLine(name, this.s.message);
        break;
      }
    }

    this.s.pot = this.totalPot;
    this.handlePostAction();
    this.emit();
  }

  private handlePostAction(): void {
    const alive = this.alive();
    if (alive.length <= 1) {
      const winnerIdx = alive[0];
      if (winnerIdx === undefined) {
        this.s.phase = 'roundEnd';
        this.emit();
        return;
      }
      const winAmt = this.totalPot;
      this.s.seats[winnerIdx].stack += winAmt;
      this.s.seats[winnerIdx].won = winAmt;
      this.s.seats[winnerIdx].isWinner = true;
      const eligible = this.s.seats.map((_, i) => i).filter((i) => this.s.seats[i].committed > 0);
      this.s.layers = [{ amount: winAmt, winners: [this.s.seats[winnerIdx].name], label: 'Pot', eligible }];
      this.s.message = `${this.s.seats[winnerIdx].name} wins $${winAmt}.`;
      this.logLine('Table', this.s.message);
      this.s.heroDelta = this.s.seats[0].won - this.s.seats[0].committed;
      this.s.phase = 'roundEnd';
      return;
    }

    const actable = this.actable();
    const roundDone =
      actable.length === 0 ||
      actable.every((i) => this.s.seats[i].hasActed && this.s.seats[i].bet === this.s.currentBet);

    if (!roundDone) {
      this.advanceTurn();
      return;
    }

    if (this.s.street >= 5) {
      this.runShowdown();
    } else {
      this.nextStreetOrShowdown();
    }
  }

  private advanceTurn(): void {
    const order = this.getOrder();
    if (order.length === 0) {
      this.s.turn = -1;
      this.runShowdown();
      return;
    }
    const cur = this.s.turn;
    const start = order.indexOf(cur) + 1;
    for (let k = 0; k < order.length; k++) {
      const idx = order[(start + k) % order.length];
      const s = this.s.seats[idx];
      if (s && !s.folded && !s.allin && !s.eliminated) {
        this.s.turn = idx;
        return;
      }
    }
    this.s.turn = -1;
    this.runShowdown();
  }

  private nextStreetOrShowdown(): void {
    if (this.s.street < 3) {
      this.s.street = 3;
      this.dealBoard(3);
    } else if (this.s.street === 3) {
      this.s.street = 4;
      this.dealBoard(1);
    } else {
      this.s.street = 5;
      this.dealBoard(1);
    }

    this.resetStreet();
    this.s.message = `Street ${this.streetName(this.s.street)} dealt.`;
    this.logLine('Table', `Street ${this.streetName(this.s.street)} dealt.`, this.s.street);

    const actable = this.actable();
    if (actable.length === 0) {
      // All-in runout: reveal streets one at a time — the driver calls revealNextStreet().
      this.s.turn = -1;
      if (this.s.street >= 5) this.runShowdown();
      return;
    }
    this.s.turn = this.firstToAct(false);
  }

  /** Advances to the next board street during an all-in runout; no-op otherwise. */
  revealNextStreet(): void {
    if (this.s.phase !== 'betting' || this.s.turn !== -1) return;
    if (this.actable().length > 0 || this.s.board.length >= 5) {
      this.runShowdown();
      this.emit();
      return;
    }
    this.nextStreetOrShowdown();
    this.emit();
  }

  private resetStreet(): void {
    this.s.currentBet = 0;
    this.lastIncrement = this.currentBlind;
    this.raiseCount = 0;
    this.s.seats.forEach((s) => {
      s.bet = 0;
      s.hasActed = false;
    });
  }

  private dealBoard(count: number): void {
    for (let i = 0; i < count; i++) {
      const next = this.deck.pop();
      if (next) this.s.board.push(next);
    }
  }

  private streetName(street: number): string {
    if (street === 3) return 'Flop';
    if (street === 4) return 'Turn';
    return 'River';
  }

  private runShowdown(): void {
    const alive = this.alive();
    alive.forEach((i) => (this.s.seats[i].show = true));

    const committed = this.s.seats.map((s) => s.committed);
    const potLayers = buildPotLayers(committed, alive);
    const winners = pickWinnersByLayer(
      potLayers,
      (i) => evaluate7([...this.s.seats[i].hole, ...this.s.board]).value,
    );
    const payout = payoutLayers(potLayers, winners, [...new Set(this.getOrder())]);

    this.s.layers = potLayers.map((pl, li) => ({
      amount: pl.amount,
      eligible: pl.eligible,
      label: pl.label,
      winners: (winners[li] ?? []).map((i) => this.s.seats[i].name),
    }));

    payout.won.forEach((share, i) => {
      if (share > 0) {
        this.s.seats[i].won += share;
        this.s.seats[i].isWinner = true;
        this.s.seats[i].stack += share;
      }
    });

    if (this.s.seats[0]) {
      this.s.heroDelta = this.s.seats[0].won - this.s.seats[0].committed;
    }

    const best = alive
      .map((i) => ({ i, r: evaluate7([...this.s.seats[i].hole, ...this.s.board]) }))
      .sort((a, b) => compareHands(b.r, a.r))[0];
    this.s.lastWinningHand = best ? best.r.label : null;
    this.s.message = best ? `Showdown — ${this.s.seats[best.i].name} wins with ${best.r.label}.` : 'Showdown — nobody left to win.';
    this.logLine('Table', best ? `Showdown: ${this.s.seats[best.i].name} — ${best.r.label}` : 'Showdown.');
    this.s.phase = 'showdown';
  }

  /** Called by the UI after the reveal moment to move into the payout frame */
  finishShowdown(): void {
    if (this.s.phase === 'showdown') {
      this.s.phase = 'roundEnd';
      this.emit();
    }
  }

  private logLine(seat: string, text: string, street: number = this.s.street): void {
    this.s.log = [...this.s.log, { seat, text, street }].slice(-60);
  }

  heroHandStrength(): number {
    const h = this.s.seats[0]?.hole ?? [];
    if (h.length !== 2) return 0;
    const v = (n: number) => (n >= 11 ? (n === 14 ? 4 : 3) : n >= 8 ? 2 : 1);
    const [a, b] = h.map(cardValue).sort((x, y) => y - x);
    let score = v(a) + v(b);
    if (a === b) score += 4;
    if (h[0].suit === h[1].suit) score += 1;
    if (a - b <= 2) score += 1;
    return Math.min(10, score);
  }

  /** net result for an arbitrary seat since the start of the current hand */
  deltaFor(idx: number): number {
    return this.s.seats[idx].won - this.s.seats[idx].committed;
  }
}

export { cardLabel };