import { WebSocketServer, WebSocket } from 'ws';
import { PokerGame, type GameSnapshot } from '../src/lib/poker/game';
import { BOT_POOL } from '../src/lib/poker/roster';
import type { ClientMsg, OnlineSettings, OnlineRoom, ServerMsg } from '../src/lib/online/types';

const PORT = Number(process.env.PORT ?? 8088);

const wss = new WebSocketServer({ port: PORT });

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODES = new Set<string>();

function makeCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (CODES.has(code));
  CODES.add(code);
  return code;
}

interface Player {
  seat: number;
  name: string;
  avatarId: string;
  ws: WebSocket;
  host: boolean;
  buyin: number;
  contributed: number;
  online: boolean; // false once disconnected mid-session (seat turned into a bot)
}

function sanitize(name: string): string {
  const n = name.trim().slice(0, 16);
  return n.length > 0 ? n : 'Guest';
}

function roomView(room: Room): OnlineRoom {
  return {
    code: room.code,
    settings: room.settings,
    started: room.started,
    players: room.players.filter((p): p is Player => !!p).map((p) => ({
      seat: p.seat,
      name: p.name,
      avatarId: p.avatarId,
      host: p.host,
      stack: room.game ? room.game.s.seats[p.seat]?.stack ?? null : null,
    })),
  };
}

class Room {
  code: string;
  settings: OnlineSettings;
  players: (Player | null)[] = [];
  game: PokerGame | null = null;
  started = false;
  private timer: NodeJS.Timeout | null = null;
  chatLog: { from: string; text: string; ts: number }[] = [];

  constructor(settings: OnlineSettings) {
    this.code = makeCode();
    this.settings = settings;
    this.players = Array.from({ length: settings.size }, () => null);
  }

  /* ---------------- timing ---------------- */
  private get botMs(): number {
    return this.settings.speed === 'fast' ? 350 : this.settings.speed === 'slow' ? 1100 : 700;
  }
  private get dealMs(): number {
    return this.settings.speed === 'fast' ? 600 : this.settings.speed === 'slow' ? 1800 : 1100;
  }
  private get showdownMs(): number {
    return this.settings.speed === 'fast' ? 900 : this.settings.speed === 'slow' ? 2600 : 1500;
  }
  private get nextHandMs(): number {
    return this.settings.speed === 'fast' ? 1500 : this.settings.speed === 'slow' ? 3800 : 2200;
  }
  private get revealMs(): number {
    return this.settings.speed === 'fast' ? 900 : this.settings.speed === 'slow' ? 2400 : 1300;
  }

  private schedule(fn: () => void, ms: number): void {
    this.clear();
    this.timer = setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  private clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /* ---------------- messaging ---------------- */
  private send(ws: WebSocket, msg: ServerMsg): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  broadcast(msg: ServerMsg): void {
    for (const p of this.players) if (p?.online) this.send(p.ws, msg);
  }

  private broadcastSnap(): void {
    const g = this.game;
    if (!g) return;
    const terminal = ['showdown', 'roundEnd', 'busted', 'won'].includes(g.s.phase);
    const winner = g.s.seats.map((s, i) => (s.isWinner ? i : -1)).filter((i) => i >= 0);
    for (const p of this.players) {
      if (!p?.online) continue;
      const snap: GameSnapshot = { ...g.s, log: g.s.log.slice(-40) };
      snap.seats = g.s.seats.map((s, i) => (terminal || i === p.seat ? s : { ...s, hole: [] }));
      this.send(p.ws, { t: 'snap', you: p.seat, snap, winner });
    }
  }

  broadcastLobby(): void {
    this.broadcast({ t: 'room', room: roomView(this) });
  }

  /* ---------------- driver loop ---------------- */
  /** Re-evaluate the table after any mutation and schedule the next step. */
  drive(): void {
    const g = this.game;
    if (!g) return;
    this.clear();
    switch (g.s.phase) {
      case 'dealing':
        this.schedule(() => {
          g.beginBetting();
          this.afterStep();
        }, this.dealMs);
        break;
      case 'betting': {
        const t = g.s.turn;
        if (t < 0) {
          // All-in runout: reveal the next street, then keep driving.
          this.schedule(() => {
            g.revealNextStreet();
            this.afterStep();
          }, this.revealMs);
          break;
        }
        const seat = g.s.seats[t];
        if (!seat || seat.eliminated) {
          this.afterStep();
          break;
        }
        if (seat.isBot) {
          this.schedule(() => {
            g.botAct();
            this.afterStep();
          }, this.botMs);
        } else if (this.settings.timerSec > 0) {
          this.schedule(() => {
            const toCall = g.toCall(t);
            g.seatAction(t, toCall > 0 ? 'fold' : 'check');
            this.afterStep();
          }, this.settings.timerSec * 1000);
        }
        break;
      }
      case 'showdown':
        this.schedule(() => {
          g.finishShowdown();
          this.afterStep();
        }, this.showdownMs);
        break;
      case 'roundEnd':
        this.schedule(() => {
          g.startHand();
          this.afterStep();
        }, this.nextHandMs);
        break;
      case 'busted':
      case 'won':
        this.endSession('Session complete.');
        break;
      default:
        break;
    }
  }

  private afterStep(): void {
    this.broadcastSnap();
    this.drive();
  }

  start(): void {
    if (this.started || this.game) return;
    if (this.players.filter(Boolean).length < 2) return;
    const humans = this.players.filter((p): p is Player => !!p);
    const humanSeats = humans.map((p) => p.seat);
    const bots = BOT_POOL.slice(0, this.settings.size - 1);
    const opponents = [];
    for (let seat = 1; seat < this.settings.size; seat++) {
      const human = this.players[seat];
      if (human) {
        opponents.push({ name: human.name, avatarId: human.avatarId, personality: 'balanced' as const });
      } else {
        const bot = bots[(seat - 1) % bots.length];
        opponents.push({ name: bot.name, avatarId: bot.avatarId, personality: bot.personality });
      }
    }
    const host = humans.find((p) => p.host) ?? humans[0];
    this.game = new PokerGame({
      heroName: host.name,
      heroAvatar: host.avatarId,
      heroStack: this.settings.buyin,
      botStack: this.settings.buyin,
      bigBlind: this.settings.bb,
      mode: this.settings.mode ?? 'cash',
      maxRaises: this.settings.maxRaises,
      opponents,
      humanSeats,
    });
    for (const p of humans) {
      p.buyin = this.settings.buyin;
      p.contributed = this.settings.buyin;
    }
    this.started = true;
    this.broadcastLobby();
    this.schedule(() => {
      this.game!.startHand();
      this.afterStep();
    }, 450);
  }

  /* ---------------- actions ---------------- */
  seatAct(seat: number, kind: 'fold' | 'check' | 'call' | 'raise' | 'allin', amount?: number): void {
    const g = this.game;
    if (!g || !this.started) return;
    this.clear();
    if (g.s.phase === 'betting' && g.s.turn === seat) {
      g.seatAction(seat, kind, amount);
    }
    this.afterStep();
  }

  disconnect(ws: WebSocket): void {
    const p = this.players.find((q) => q?.ws === ws);
    if (!p) return;
    const seat = p.seat;
    if (!this.game || !this.started) {
      this.players[seat] = null;
      if (p.host) {
        const next = this.players.find((q) => q);
        if (next) next.host = true;
      }
      if (this.players.filter(Boolean).filter((q) => q!.online).length === 0) this.destroy();
      else this.broadcastLobby();
      return;
    }
    // Mid-game: settle the leaver, turn their seat into a bot.
    this.settlePlayer(p);
    p.online = false;
    const g = this.game;
    if (g.s.seats[seat]) {
      g.s.seats[seat].isBot = true;
      g.s.seats[seat].personality = 'balanced';
    }
    this.broadcastLobby();
    this.drive();
  }

  private settlePlayer(p: Player): void {
    const g = this.game;
    const finalStack = g && g.s.seats[p.seat] ? g.s.seats[p.seat].stack : 0;
    const delta = finalStack - p.contributed;
    if (p.online) this.send(p.ws, { t: 'settle', delta });
  }

  endSession(reason: string): void {
    this.clear();
    for (const p of this.players) {
      if (!p?.online) continue;
      const g = this.game;
      const stack = g?.s.seats[p.seat]?.stack ?? 0;
      const delta = stack - p.contributed;
      this.send(p.ws, { t: 'settle', delta });
      this.send(p.ws, { t: 'roomEnd', reason });
    }
    this.destroy();
  }

  destroy(): void {
    this.clear();
    try {
      for (const p of this.players) {
        if (p?.online) {
          this.send(p.ws, { t: 'roomEnd', reason: 'Room closed.' });
          p.ws.close();
        }
      }
    } catch {
      /* noop */
    }
    CODES.delete(this.code);
    rooms.delete(this.code);
    console.log(`[room ${this.code}] closed (${this.settings.size}-seater).`);
  }
}

const rooms = new Map<string, Room>();

function findRoom(ws: WebSocket): Room | undefined {
  for (const r of rooms.values()) if (r.players.some((p) => p?.ws === ws)) return r;
  return undefined;
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    const room = findRoom(ws);

    switch (msg.t) {
      case 'create': {
        if (room) {
          ws.send(JSON.stringify({ t: 'err', message: 'Leave your current room first.' } satisfies ServerMsg));
          return;
        }
        const r = new Room({
          size: Math.min(9, Math.max(2, msg.settings.size)),
          bb: Math.min(500, Math.max(2, msg.settings.bb)),
          buyin: Math.min(1000000, Math.max(200, msg.settings.buyin)),
          timerSec: Math.min(120, Math.max(0, msg.settings.timerSec)),
          maxRaises: Math.min(8, Math.max(0, msg.settings.maxRaises)),
          speed: msg.settings.speed,
          mode: (msg.settings.mode ?? 'cash'),
        });
        const p: Player = { seat: 0, name: sanitize(msg.name), avatarId: msg.avatarId, ws, host: true, buyin: r.settings.buyin, contributed: 0, online: true };
        r.players[0] = p;
        rooms.set(r.code, r);
        ws.send(JSON.stringify({ t: 'hello', code: r.code } satisfies ServerMsg));
        r.broadcastLobby();
        console.log(`[room ${r.code}] created by ${p.name}.`);
        break;
      }
      case 'join': {
        if (room) {
          ws.send(JSON.stringify({ t: 'err', message: 'Leave your current room first.' } satisfies ServerMsg));
          return;
        }
        const r = rooms.get(String(msg.code).trim().toUpperCase());
        if (!r) {
          ws.send(JSON.stringify({ t: 'err', message: `Room "${msg.code}" not found.` } satisfies ServerMsg));
          return;
        }
        if (r.started) {
          ws.send(JSON.stringify({ t: 'err', message: 'That game already started.' } satisfies ServerMsg));
          return;
        }
        const seat = r.players.findIndex((q) => !q);
        if (seat < 0) {
          ws.send(JSON.stringify({ t: 'err', message: 'That room is full.' } satisfies ServerMsg));
          return;
        }
        r.players[seat] = { seat, name: sanitize(msg.name), avatarId: msg.avatarId, ws, host: false, buyin: r.settings.buyin, contributed: 0, online: true };
        for (const c of r.chatLog.slice(-30)) ws.send(JSON.stringify({ t: 'chat', ...c }));
        r.broadcastLobby();
        console.log(`[room ${r.code}] ${msg.name} joined seat ${seat}.`);
        break;
      }
      case 'start': {
        if (!room) return;
        const p = room.players.find((q) => q?.ws === ws);
        if (p?.host) room.start();
        break;
      }
      case 'action': {
        if (!room) return;
        const p = room.players.find((q) => q?.ws === ws);
        if (p && p.online) {
          if (msg.kind === 'bet' || msg.kind === 'raise') {
            room.seatAct(p.seat, 'raise', msg.amount);
          } else {
            room.seatAct(p.seat, msg.kind);
          }
        }
        break;
      }
      case 'chat': {
        if (!room) return;
        const p = room.players.find((q) => q?.ws === ws && q.online);
        if (!p || !msg.text.trim()) return;
        const entry = { from: p.name, text: String(msg.text).slice(0, 200), ts: Date.now() };
        room.chatLog.push(entry);
        room.broadcast({ t: 'chat', ...entry });
        break;
      }
      case 'leave': {
        const r = findRoom(ws);
        if (r) r.disconnect(ws);
        break;
      }
      default:
        break;
    }
  });

  ws.on('close', () => {
    const r = findRoom(ws);
    if (r) r.disconnect(ws);
  });
});

wss.on('listening', () => {
  console.log(`[noir] LAN poker server listening on ws://localhost:${PORT}`);
  console.log('[noir] start the app, open Poker -> Online table, then have a friend join from another browser.');
});