import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { PokerGame, type GameSnapshot, type PokerSeat } from '../lib/poker/game';
import { pickOpponents, TABLES, type TableDef, type BotDef } from '../lib/poker/roster';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';
import { PlayingCard } from '../components/PlayingCard';
import { ChipStack } from '../components/Chip';
import { Button, Modal, Segmented } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { TopUpModal } from '../components/TopUpModal';
import { useOnlineRoom } from '../hooks/useOnlineRoom';
import type { OnlineSettings } from '../lib/online/types';
import { useCountUp } from '../hooks/useCountUp';
import { fmtNumber, fmtSign } from '../lib/utils';
import { snd } from '../lib/sound';

type Mode = 'cash' | 'sitngo' | 'tournament';
type Speed = 'fast' | 'normal' | 'slow';
type SeatKind = 'fold' | 'check' | 'call' | 'raise' | 'allin';

/** Screen position (% of poker stage) for each seat index. Hero always sits bottom-center. */
function seatPose(i: number, count: number): { x: number; y: number } {
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 560px)').matches;
  const fit = (p: { x: number; y: number }): { x: number; y: number } =>
    narrow ? { x: Math.min(88, Math.max(12, p.x)), y: p.y } : p;
  if (count <= 2) {
    const HU = [
      { x: 50, y: 88 },
      { x: 50, y: 10 },
    ];
    return fit(HU[i] ?? { x: 50, y: 50 });
  }
  if (count <= 5) {
    const FIVE = [
      { x: 50, y: 90 },
      { x: 14, y: 62 },
      { x: 32, y: 12 },
      { x: 68, y: 12 },
      { x: 86, y: 62 },
    ];
    return fit(FIVE[i] ?? { x: 50, y: 50 });
  }
  const NINE = [
    { x: 50, y: 88 },
    { x: 8, y: 42 },
    { x: 20, y: 52 },
    { x: 14, y: 82 },
    { x: 30, y: 10 },
    { x: 50, y: 4 },
    { x: 70, y: 10 },
    { x: 86, y: 82 },
    { x: 92, y: 42 },
  ];
  return fit(NINE[i] ?? { x: 50, y: 50 });
}

const SEAT_SIZES = [
  { seats: 2, label: 'Heads-Up' },
  { seats: 5, label: 'Five' },
  { seats: 9, label: 'Nine' },
];

const SPEED_MS: Record<Speed, { deal: number; bot: number; showdown: number; next: number }> = {
  fast: { deal: 700, bot: 420, showdown: 900, next: 1600 },
  normal: { deal: 1250, bot: 800, showdown: 1600, next: 2400 },
  slow: { deal: 1900, bot: 1250, showdown: 2600, next: 3800 },
};

const MODE_LABEL: Record<Mode, string> = { cash: 'Cash game', sitngo: 'Sit & Go', tournament: 'Tournament' };

export function Poker() {
  const { user, balance, profile, pushToast, recordPokerHand, recordGameRound, recordPokerStats, grantBonus } = useApp();
  const [realm, setRealm] = useState<'offline' | 'online' | null>(null);
  const online = useOnlineRoom({
    enabled: realm === 'online',
    onSettle: (delta) => {
      if (delta !== 0) recordGameRound(delta, 'Texas Hold\u2019em', 'Online session settlement');
    },
  });

  /* ----- offline ----- */
  const [table, setTable] = useState<TableDef | null>(null);
  const [seatCount, setSeatCount] = useState(5);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [timerSec, setTimerSec] = useState(20);
  const [mode, setMode] = useState<Mode>('cash');
  const [maxRaises, setMaxRaises] = useState(0);
  const [blindMul, setBlindMul] = useState<1 | 2 | 5>(1);
  const [playing, setPlaying] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const gameRef = useRef<PokerGame | null>(null);
  const recordedRef = useRef<number | null>(null);

  /* ----- online ----- */
  const [onlineName, setOnlineName] = useState('');
  const [onlineCode, setOnlineCode] = useState('');

  const snap: GameSnapshot | null = gameRef.current?.s ?? null;
  const startStack = useCountUp(balance, 700);

  const speedRef = useRef<Speed>(speed);
  speedRef.current = speed;
  const driveRef = useRef({ last: 0, phase: '', turn: -2 });

  /* Offline driver: a polling ticker (90ms) that drives the deal, bot turns,
     runout reveals, showdown and next hand. The interval lives for the whole
     table session, so re-renders / effect teardowns can never cancel a move. */
  useEffect(() => {
    const iv = window.setInterval(() => {
      const g = gameRef.current;
      if (!g) return;
      const s = g.s;
      const now = Date.now();
      try {
        if (s.phase !== driveRef.current.phase) {
          driveRef.current.phase = s.phase;
          driveRef.current.last = now;
          if (s.phase === 'dealing') snd.deal();
          else if (s.phase === 'showdown') snd[s.seats[0]?.isWinner ? 'win' : 'lose']();
          else if (s.phase === 'busted') snd.lose();
        }
        if (s.phase === 'betting' && s.turn !== driveRef.current.turn) {
          driveRef.current.turn = s.turn;
          driveRef.current.last = now;
        } else if (s.phase !== 'betting') {
          driveRef.current.turn = -2;
        }
        const d = SPEED_MS[speedRef.current];
        const ready = (ms: number): boolean => now - driveRef.current.last >= ms;

        if (s.phase === 'dealing' && ready(d.deal)) {
          driveRef.current.last = now;
          g.beginBetting();
        } else if (s.phase === 'betting') {
          if (s.turn >= 0 && s.seats[s.turn]?.isBot) {
            if (ready(d.bot + Math.random() * 260)) {
              driveRef.current.last = now;
              g.botAct();
              snd.chip();
            }
          } else if (s.turn < 0 && ready(Math.max(500, d.bot * 1.6))) {
            driveRef.current.last = now;
            g.revealNextStreet();
            snd.deal();
          }
        } else if (s.phase === 'showdown' && ready(d.showdown)) {
          driveRef.current.last = now;
          g.finishShowdown();
        } else if (s.phase === 'roundEnd') {
          if (recordedRef.current !== s.handNum) {
            recordedRef.current = s.handNum;
            const delta = s.heroDelta;
            recordPokerHand(delta, `Poker hand #${s.handNum}`);
            if (delta > 0) pushToast({ tone: 'good', title: fmtSign(delta), message: `Pot won on hand #${s.handNum}` });
          }
          if (ready(d.next)) {
            driveRef.current.last = now;
            if (!g.s.phase || g.s.phase === 'roundEnd') g.startHand();
            else g.emit();
          }
        }
      } catch (err) {
        console.error('[offline]', err);
        pushToast({ tone: 'bad', title: 'Game hiccup', message: err instanceof Error ? err.message : String(err) });
      }
    }, 90);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gameRef.current) return;
    return gameRef.current.subscribe(() => force());
  }, [gameRef]);

  const effectiveBb = table ? table.bb * blindMul : 0;

  const startOffline = useCallback(
    (t: TableDef, opps: number) => {
      if (!user) {
        pushToast({ tone: 'bad', title: 'Sign in first', message: 'Create a free account to sit at the table.' });
        return;
      }
      if (balance < t.buyin) {
        setTopUpOpen(true);
        pushToast({ tone: 'info', title: 'Not enough balance', message: `You need at least ${fmtNumber(t.buyin)} to sit here.` });
        return;
      }
      const tournament = mode !== 'cash';
      const g = new PokerGame({
        heroName: user.username,
        heroAvatar: profile?.avatarId ?? user.avatarId,
        opponents: pickOpponents(opps).map((b) => ({ name: b.name, avatarId: b.avatarId, personality: b.personality })),
        bigBlind: t.bb * blindMul,
        heroStack: t.buyin,
        botStack: tournament ? t.buyin : t.buyin * 6,
        mode,
        maxRaises,
      });
      gameRef.current = g;
      recordedRef.current = null;
      setTable(t);
      setSeatCount(opps + 1);
      g.startHand();
      setPlaying(true);
    },
    [balance, blindMul, maxRaises, mode, profile?.avatarId, pushToast, user],
  );

  const leaveOffline = useCallback(() => {
    gameRef.current = null;
    setPlaying(false);
    setTable(null);
  }, []);

  const handleRebuy = useCallback(() => {
    if (!table || !gameRef.current) return;
    grantBonus(table.buyin, `Poker stack rebuy (${fmtNumber(table.buyin)})`, 'rebuy');
    gameRef.current.rebuy();
    window.setTimeout(() => gameRef.current?.startHand(), 500);
  }, [grantBonus, table]);

  const onlineAct = (kind: SeatKind, amount?: number) => online.act(kind, amount);

  /* ----- render ----- */
  if (online.status === 'playing' && online.snap) {
    return (
      <>
        <PokerTable
          snap={online.snap}
          mySeat={online.you}
          tableName={(online.room?.players.find((p) => p.seat === online.you)?.host ? 'Your table' : 'Buddy table') + ' · Online'}
          mode={online.room?.settings.mode ?? 'cash'}
          bb={online.room?.settings.bb ?? 10}
          timerSec={online.room?.settings.timerSec ?? 20}
          maxRaises={online.room?.settings.maxRaises ?? 0}
          buyin={online.room?.settings.buyin ?? 1000}
          heroAvatar={profile?.avatarId ?? user?.avatarId ?? 'lynx-gold'}
          onLeave={() => {
            online.leave();
            setRealm(null);
          }}
          onRebuy={() => undefined}
          onOnlineAction={onlineAct}
          online
        />
        <div className="chat-wrap">
          <ChatPanel log={online.chatLog} onSend={online.chat} compact />
        </div>
      </>
    );
  }

  if (online.status === 'playing') {
    return (
      <div className="page container">
        <div className="deal-panel panel">
          <span className="pulse-dot" />
          <h2 className="display-lg" style={{ textAlign: 'center' }}>Dealing the cards…</h2>
          <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
            Waiting for the first snapshot from the server.
          </p>
        </div>
      </div>
    );
  }

  if (playing && gameRef.current) {
    return (
      <PokerTable
        snap={gameRef.current.s}
        game={gameRef.current}
        mySeat={0}
        tableName={table?.name ?? 'Table'}
        mode={mode}
        bb={effectiveBb}
        timerSec={timerSec}
        maxRaises={maxRaises}
        buyin={table?.buyin ?? 1000}
        heroAvatar={profile?.avatarId ?? user?.avatarId ?? 'lynx-gold'}
        onLeave={leaveOffline}
        onRebuy={handleRebuy}
        onOnlineAction={() => undefined}
        onHandStat={recordPokerStats}
      />
    );
  }

  return (
    <div className="page container">
      <div className="page-head">
        <span className="eyebrow">Poker</span>
        <h1 className="page-title">Texas Hold'em</h1>
        <p className="page-sub">
          Play the AI tables alone, or run a private local-table so a friend can register on their own
          browser and sit down with you. Any player can be the host.
        </p>
      </div>

      {realm === null && (
        <div className="stack" style={{ gap: 16, marginTop: 12 }}>
          <div className="mode-banner">
            <div className="mode-banner-inner">
              <span className="eyebrow">Choose your game</span>
              <h2 className="display" style={{ fontSize: 'clamp(1.5rem, 3.4vw, 2rem)', marginTop: 6 }}>
                Texas Hold&rsquo;em, two ways.
              </h2>
              <p className="muted" style={{ maxWidth: '58ch', margin: '10px 0 0' }}>
                Play privately with friends on your own network, or sharpen your game against a field of
                distinct AI personalities. Both start at the same table — pick a buy-in and deal.
              </p>
            </div>
          </div>

          <div className="mode-grid">
            <article className="mode-card">
              <div className="mode-card-head">
                <div className="mode-ic"><Icon name="users" size={26} /></div>
                <span className="badge badge-gold"><Icon name="activity" size={12} /> LAN multiplayer</span>
              </div>
              <h3 className="mode-title">Online table</h3>
              <p className="muted">
                Run the LAN poker server on your machine, create a room and share the 5-letter code.
                Friends register on their own browser and sit down with the same buy-in.
              </p>
              <ul className="mode-feats">
                <li><Icon name="check" size={14} /> Live chat in the room</li>
                <li><Icon name="check" size={14} /> Cash, Sit &amp; Go and tournaments</li>
                <li><Icon name="check" size={14} /> 2–9 seats — everyone plays</li>
              </ul>
              <Button size="lg" variant="primary" icon="play" block onClick={() => setRealm('online')}>
                Set up online table
              </Button>
            </article>

            <article className="mode-card">
              <div className="mode-card-head">
                <div className="mode-ic"><Icon name="target" size={26} /></div>
                <span className="badge badge-gold"><Icon name="bolt" size={12} /> 8 AI personalities</span>
              </div>
              <h3 className="mode-title">Practice vs AI</h3>
              <p className="muted">
                Heads-up, five-handed and nine-handed tables against eight distinct bot personalities —
                tune blinds, deal speed and the turn timer to your liking.
              </p>
              <ul className="mode-feats">
                <li><Icon name="check" size={14} /> Cash, Sit &amp; Go and tournaments</li>
                <li><Icon name="check" size={14} /> Heads-up, five-handed and nine-handed tables</li>
                <li><Icon name="check" size={14} /> Full profile stats and net P/L</li>
              </ul>
              <Button size="lg" variant="goldGhost" icon="cards" block onClick={() => setRealm('offline')}>
                Play practice table
              </Button>
            </article>
          </div>
        </div>
      )}

      {realm === 'offline' && (
        <>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <Button variant="ghost" size="sm" icon="chevronLeft" onClick={() => setRealm(null)}>
              All tables
            </Button>
            <span className="badge badge-gold"><Icon name="target" size={13} /> Practice table</span>
          </div>

          <div className="grid-2" style={{ marginTop: 16 }}>
            <div className="panel panel-pad stack" style={{ gap: 18 }}>
              <div className="row:between">
                <span className="eyebrow">Choose a table</span>
              </div>
              <div className="stack" style={{ gap: 12 }}>
                {TABLES.map((t) => (
                  <button
                    key={t.id}
                    className={`table-option ${table?.id === t.id ? 'on' : ''}`}
                    onClick={() => {
                      snd.click();
                      setTable(t);
                    }}
                  >
                    <div className="row:between">
                      <div>
                        <div style={{ fontWeight: 800 }}>{t.name}</div>
                        <div className="muted" style={{ fontSize: '0.82rem' }}>{t.desc}</div>
                      </div>
                      <div className="stack" style={{ alignItems: 'flex-end', gap: 2 }}>
                        <span className="mono" style={{ fontWeight: 800, color: 'var(--gold-2)' }}>{fmtNumber(t.buyin)}</span>
                        <span className="muted" style={{ fontSize: '0.72rem' }}>buy-in</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel panel-pad stack" style={{ gap: 18 }}>
              <span className="eyebrow">Table setup</span>
              <div className="stack" style={{ gap: 14 }}>
                <div>
                  <div className="field-label">Seats</div>
                  <div className="seg" role="group">
                    {SEAT_SIZES.map((s) => (
                      <button
                        key={s.seats}
                        className={`seg-btn ${seatCount === s.seats ? 'active' : ''}`}
                        aria-pressed={seatCount === s.seats}
                        onClick={() => {
                          snd.click();
                          setSeatCount(s.seats);
                        }}
                      >
                        {s.seats} · {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="field-label">Game format</div>
                  <Segmented<Mode>
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: 'cash', label: 'Cash' },
                      { value: 'sitngo', label: 'Sit & Go' },
                      { value: 'tournament', label: 'Tournament' },
                    ]}
                  />
                  <div className="field-hint" style={{ marginTop: 6 }}>
                    {mode === 'cash' && 'Unlimited hands; top up at the table whenever you bust.'}
                    {mode === 'sitngo' && 'Every player starts equal — win it all or get eliminated.'}
                    {mode === 'tournament' && 'Blinds rise every 8 hands until one player holds every chip.'}
                  </div>
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <SettingLabel label="Blinds" hint={`BB ${table ? table.bb * blindMul : '-'}`} />
                  <Segmented<'1' | '2' | '5'>
                    value={String(blindMul) as '1' | '2' | '5'}
                    onChange={(v) => setBlindMul(Number(v) as 1 | 2 | 5)}
                    options={[
                      { value: '1', label: '1x' },
                      { value: '2', label: '2x' },
                      { value: '5', label: '5x' },
                    ]}
                  />
                  <SettingLabel label="Deal speed" />
                  <Segmented<Speed>
                    value={speed}
                    onChange={setSpeed}
                    options={[
                      { value: 'fast', label: 'Fast' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'slow', label: 'Slow' },
                    ]}
                  />
                  <SettingLabel label="Turn timer" hint={timerSec === 0 ? 'off' : `${timerSec}s`} />
                  <Segmented<'0' | '20' | '30' | '60'>
                    value={String(timerSec) as '0' | '20' | '30' | '60'}
                    onChange={(v) => setTimerSec(Number(v))}
                    options={[
                      { value: '0', label: 'Off' },
                      { value: '20', label: '20s' },
                      { value: '30', label: '30s' },
                      { value: '60', label: '60s' },
                    ]}
                  />
                  <SettingLabel label="Raises per street" hint={maxRaises === 0 ? 'unlimited' : maxRaises === 1 ? `max ${maxRaises} raise` : `max ${maxRaises} raises`} />
                  <Segmented<'0' | '3' | '4'>
                    value={String(maxRaises) as '0' | '3' | '4'}
                    onChange={(v) => setMaxRaises(Number(v))}
                    options={[
                      { value: '0', label: 'Unlimited' },
                      { value: '3', label: '3' },
                      { value: '4', label: '4' },
                    ]}
                  />
                </div>
              </div>
              <Button
                size="lg"
                icon="cards"
                block
                disabled={!table}
                onClick={() => table && startOffline(table, seatCount - 1)}
              >
                {table ? `Sit at ${table?.name}` : 'Select a table first'}
              </Button>
              {table && (
                <div className="field-hint" style={{ textAlign: 'center' }}>
                  Buy-in is {fmtNumber(table.buyin)} · you have {fmtNumber(startStack)}.
                </div>
              )}
            </div>
          </div>

          <div className="section-head" style={{ marginTop: 28 }}>
            <div>
              <span className="eyebrow">The field</span>
              <h2 className="display" style={{ fontSize: '1.3rem', marginTop: 6 }}>Opponents at this table</h2>
            </div>
          </div>
          <div className="grid-3" style={{ marginTop: 4 }}>
            {pickOpponents(seatCount - 1).map((b) => (
              <BotCard key={b.name} bot={b} />
            ))}
          </div>
        </>
      )}

      {realm === 'online' && (
        <>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <Button variant="ghost" size="sm" icon="chevronLeft" onClick={() => { online.leave(); setRealm(null); }}>
              All tables
            </Button>
            <span className="badge badge-gold"><Icon name="users" size={13} /> Online table</span>
            {online.status === 'connecting' && <span className="badge"><Icon name="activity" size={13} /> Connecting…</span>}
          </div>

          {online.error && (
            <div className="panel" style={{ marginTop: 14, borderColor: 'var(--bad)' }}>
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>{online.error}</p>
            </div>
          )}

          {online.status === 'lobby' && online.room ? (
            <RoomLobbyPanel
              roomCode={online.room.code}
              players={online.room.players}
              settings={online.room.settings}
              isHost={online.room.players.find((p) => p.seat === online.you)?.host ?? false}
              onStart={() => {
                snd.click();
                online.start();
              }}
              onLeave={() => { online.leave(); setRealm(null); }}
              chatLog={online.chatLog}
              onChat={online.chat}
            />
          ) : (
            <div className="grid-2" style={{ marginTop: 16 }}>
              <div className="panel panel-pad stack" style={{ gap: 16 }}>
                <span className="eyebrow">Host a room</span>
                <p className="muted" style={{ fontSize: '0.88rem', margin: 0 }}>
                  Start the server with <code>npm run server</code>, fill the table settings, and share the
                  room code with a friend.
                </p>
                <div className="stack" style={{ gap: 12 }}>
                  <HostSettingsPanel
                    user={user}
                    balance={balance}
                    name={onlineName}
                    onName={setOnlineName}
                    onCreate={(settings, name) => {
                      online.create(name, profile?.avatarId ?? user?.avatarId ?? 'lynx-gold', settings);
                    }}
                    onTopUp={() => setTopUpOpen(true)}
                  />
                </div>
              </div>
              <div className="panel panel-pad stack" style={{ gap: 16 }}>
                <span className="eyebrow">Join a room</span>
                <p className="muted" style={{ fontSize: '0.88rem', margin: 0 }}>
                  Ask your friend for their room code and enter it here. Each player brings the room
                  buy-in from their own balance.
                </p>
                <form
                  className="stack"
                  style={{ gap: 12 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!user) {
                      pushToast({ tone: 'bad', title: 'Sign in first', message: 'Create a free account to join an online table.' });
                      return;
                    }
                    if (!onlineCode.trim()) {
                      pushToast({ tone: 'bad', title: 'Enter a room code', message: 'Use the 5-letter code from the host.' });
                      return;
                    }
                    online.join(onlineCode, user.username, profile?.avatarId ?? user.avatarId);
                  }}
                >
                  <div className="field">
                    <label className="field-label" htmlFor="room-code">Room code</label>
                    <input
                      id="room-code"
                      className="input mono"
                      style={{ textTransform: 'uppercase' }}
                      placeholder="ABCDE"
                      maxLength={5}
                      value={onlineCode}
                      onChange={(e) => setOnlineCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    />
                  </div>
                  <Button size="lg" icon="link" block type="submit">
                    Join room
                  </Button>
                </form>
                <div className="hr" />
                <div className="field-hint">
                  Rooms live only while the server is running on the host's machine. Any player who
                  entered the lobby can start the game once at least two people are seated.
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {(online.result?.reason || (online.result && online.result.delta !== 0)) && (
        <SessionModal
          result={online.result}
          title="Session over"
          onClose={() => {
            online.clearResult();
          }}
        />
      )}

      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </div>
  );
}

/* ================= support cards ================= */

function SettingLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="row:between">
      <div className="field-label" style={{ margin: 0 }}>{label}</div>
      {hint && <span className="muted" style={{ fontSize: '0.75rem' }}>{hint}</span>}
    </div>
  );
}

const STYLE_TEXT: Record<string, string> = {
  aggressive: 'Aggressive — bets and raises often',
  passive: 'Passive — checks and calls, rarely bluffs',
  balanced: 'Balanced — reads the pot and plays the odds',
  wild: 'Unpredictable — chaos at the table',
};

function BotCard({ bot }: { bot: BotDef }) {
  return (
    <div className="panel panel-pad row" style={{ gap: 12, alignItems: 'center' }}>
      <Avatar avatarId={bot.avatarId} size={40} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{bot.name}</div>
        <div className="muted" style={{ fontSize: '0.76rem' }}>{STYLE_TEXT[bot.personality] ?? bot.personality}</div>
      </div>
      <span className="badge" style={{ marginLeft: 'auto' }}>{bot.personality}</span>
    </div>
  );
}

/* ================= Online lobby ================= */

function RoomLobbyPanel({
  roomCode,
  players,
  settings,
  isHost,
  onStart,
  onLeave,
  chatLog,
  onChat,
}: {
  roomCode: string;
  players: { seat: number; name: string; avatarId: string; host: boolean; stack: number | null }[];
  settings: OnlineSettings;
  isHost: boolean;
  onStart: () => void;
  onLeave: () => void;
  chatLog: { from: string; text: string; ts: number }[];
  onChat: (text: string) => void;
}) {
  const humanCount = players.length;
  const canStart = humanCount >= 2;
  return (
    <div className="stack" style={{ gap: 16, marginTop: 16 }}>
      <div className="panel panel-pad row" style={{ gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <Avatar avatarId="crown-gold" size={46} ring />
        <div style={{ flex: 1, minWidth: 200 }}>
          <span className="eyebrow">Room code</span>
          <div className="room-code mono">{roomCode}</div>
          <div className="muted" style={{ fontSize: '0.8rem' }}>
            Ask a friend to open <b>Poker → Online table</b> and enter this code.
          </div>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <Button variant="ghost" size="sm" icon="logout" onClick={onLeave}>Leave</Button>
          <Button
            variant="primary"
            icon="play"
            disabled={!canStart || !isHost}
            onClick={onStart}
            title={isHost ? (canStart ? 'Deal the cards' : 'Wait for more players') : 'Only the host can start'}
          >
            {isHost ? 'Start game' : 'Waiting for host…'}
          </Button>
        </div>
      </div>

      <div className="grid-2-asym">
        <div className="panel panel-pad stack" style={{ gap: 12 }}>
          <span className="eyebrow">Seated players</span>
          {players.map((p) => (
            <div key={p.seat} className="row" style={{ gap: 12 }}>
              <Avatar avatarId={p.avatarId} size={36} />
              <div>
                <div style={{ fontWeight: 700 }}>{p.name} {p.host && <span className="badge badge-gold" style={{ marginLeft: 6 }}>Host</span>}</div>
                <div className="muted" style={{ fontSize: '0.76rem' }}>Seat {p.seat + 1}{p.stack !== null ? ` · stack ${fmtNumber(p.stack)}` : ''}</div>
              </div>
            </div>
          ))}
          {players.length < settings.size && (
            <div className="muted" style={{ fontSize: '0.82rem', padding: '10px 0' }}>
              {settings.size - players.length} empty seat{settings.size - players.length > 1 ? 's' : ''} — bots fill them at the start.
            </div>
          )}
          {players.length < 2 && (
            <div className="field-hint">
              <Icon name="users" size={14} /> Invite at least one friend — the game starts at the table.
            </div>
          )}
        </div>

        <div className="panel panel-pad stack" style={{ gap: 10 }}>
          <span className="eyebrow">Table settings</span>
          <InfoRow label="Seats" value={`${settings.size} (heads-up to nine)`} />
          <InfoRow label="Big blind" value={fmtNumber(settings.bb)} />
          <InfoRow label="Buy-in" value={fmtNumber(settings.buyin)} />
          <InfoRow label="Turn timer" value={settings.timerSec > 0 ? `${settings.timerSec}s` : 'No limit'} />
          <InfoRow label="Raises per street" value={settings.maxRaises === 0 ? 'Unlimited' : String(settings.maxRaises)} />
          <InfoRow label="Format" value={MODE_LABEL[settings.mode] ?? settings.mode} />
          <InfoRow label="Deal speed" value={settings.speed} />
          <div className="field-hint" style={{ marginTop: 2 }}>
            Friend games are house-backed: the server restocks any player who busts, so nobody is ever
            locked out of the evening.
          </div>
        </div>
      </div>

      <ChatPanel log={chatLog} onSend={onChat} />
    </div>
  );
}

function ChatPanel({ log, onSend, compact }: { log: { from: string; text: string; ts: number }[]; onSend: (text: string) => void; compact?: boolean }) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t.slice(0, 200));
    setText('');
  };
  return (
    <div className={`panel chat-panel ${compact ? 'chat-compact' : ''}`}>
      <div className="row:between">
        <span className="eyebrow">Table chat</span>
        <span className="badge"><Icon name="users" size={12} /> {log.length > 0 ? `${log.length} messages` : 'say hi'}</span>
      </div>
      <div className="chat-scroll" ref={scrollRef}>
        {log.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>No messages yet — players in this room see each other's table talk.</p>
        ) : (
          log.map((m, i) => (
            <div key={i} className="chat-line">
              <span className="chat-name">{m.from}</span>
              <span className="chat-msg">{m.text}</span>
            </div>
          ))
        )}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          className="input"
          placeholder="Type a message…"
          maxLength={200}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Table chat message"
        />
        <Button type="submit" size="sm" icon="arrowRight" variant="primary">Send</Button>
      </form>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row:between">
      <span className="muted" style={{ fontSize: '0.85rem' }}>{label}</span>
      <b style={{ fontSize: '0.9rem' }}>{value}</b>
    </div>
  );
}

function HostSettingsPanel({
  user,
  balance,
  name,
  onName,
  onCreate,
  onTopUp,
}: {
  user: { username: string } | null;
  balance: number;
  name: string;
  onName: (v: string) => void;
  onCreate: (settings: OnlineSettings, name: string) => void;
  onTopUp: () => void;
}) {
  const [seatCount, setSeatCount] = useState(5);
  const [table, setTable] = useState<TableDef | null>(null);
  const [timerSec, setTimerSec] = useState(20);
  const [maxRaises, setMaxRaises] = useState(0);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [hostMode, setHostMode] = useState<'cash'|'sitngo'|'tournament'>('cash');

  const clickName = user?.username ?? name;

  const submit = () => {
    if (!clickName.trim()) {
      onName('');
      return;
    }
    onCreate(
      {
        size: seatCount,
        bb: table?.bb ?? 10,
        buyin: table?.buyin ?? 1000,
        timerSec,
        maxRaises,
        speed,
        mode: hostMode,
      },
      clickName.trim().slice(0, 16),
    );
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="field">
        <label className="field-label" htmlFor="host-name">Your table name</label>
        <input
          id="host-name"
          className="input"
          placeholder={user?.username ?? 'e.g. Nova'}
          maxLength={16}
          value={user ? '' : name}
          onChange={(e) => onName(e.target.value)}
          disabled={!!user}
        />
      </div>
      <div>
        <div className="field-label">Seats</div>
        <div className="seg" role="group">
          {SEAT_SIZES.map((s) => (
            <button
              key={s.seats}
              className={`seg-btn ${seatCount === s.seats ? 'active' : ''}`}
              aria-pressed={seatCount === s.seats}
              onClick={() => { snd.click(); setSeatCount(s.seats); }}
            >
              {s.seats}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="field-label">Stakes (big blind)</div>
        <div className="stack" style={{ gap: 8 }}>
          {TABLES.map((t) => (
            <button
              key={t.id}
              className={`table-option ${table?.id === t.id ? 'on' : ''}`}
              onClick={() => { snd.click(); setTable(t); }}
            >
              <div className="row:between">
                <span style={{ fontWeight: 700 }}>{t.name}</span>
                <span className="mono" style={{ fontWeight: 800, color: 'var(--gold-2)' }}>BB ${t.bb} · {fmtNumber(t.buyin)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <SettingLabel label="Game format" hint={hostMode === 'cash' ? 'Unlimited hands; top up anytime' : hostMode === 'sitngo' ? 'Win it all or get eliminated' : 'Blinds rise every 8 hands'} />
        <Segmented<'cash'|'sitngo'|'tournament'>
          value={hostMode}
          onChange={(v)=>setHostMode(v)}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'sitngo', label: 'Sit & Go' },
            { value: 'tournament', label: 'Tournament' },
          ]}
        />
        <SettingLabel label="Turn timer" hint={timerSec === 0 ? 'off' : `${timerSec}s`} />
        <Segmented<'0' | '20' | '30' | '60'>
          value={String(timerSec) as '0' | '20' | '30' | '60'}
          onChange={(v) => setTimerSec(Number(v))}
          options={[
            { value: '0', label: 'Off' },
            { value: '20', label: '20s' },
            { value: '30', label: '30s' },
            { value: '60', label: '60s' },
          ]}
        />
        <SettingLabel label="Raises per street" hint={maxRaises === 0 ? 'unlimited' : String(maxRaises)} />
        <Segmented<'0' | '3' | '4'>
          value={String(maxRaises) as '0' | '3' | '4'}
          onChange={(v) => setMaxRaises(Number(v))}
          options={[
            { value: '0', label: 'Unlimited' },
            { value: '3', label: '3' },
            { value: '4', label: '4' },
          ]}
        />
        <SettingLabel label="Deal speed" />
        <Segmented<Speed>
          value={speed}
          onChange={setSpeed}
          options={[
            { value: 'fast', label: 'Fast' },
            { value: 'normal', label: 'Normal' },
            { value: 'slow', label: 'Slow' },
          ]}
        />
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <Button size="lg" icon="play" block onClick={submit}>
          Create room
        </Button>
        {table && balance < table.buyin && (
          <Button size="lg" variant="goldGhost" icon="wallet" onClick={onTopUp} title="Top up balance">
            {fmtNumber(balance)}
          </Button>
        )}
      </div>
      {table && (
        <div className="field-hint" style={{ textAlign: 'center' }}>
          The room buy-in is <b>{fmtNumber(table.buyin)}</b>. You have {fmtNumber(balance)}.
        </div>
      )}
    </div>
  );
}

/* ================= Session-end modal (online) ================= */

function SessionModal({ result, title, onClose }: { result: { delta: number; reason: string }; title: string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} eyebrow="Online poker" title={title} size="sm">
      <div className="stack stack:md" style={{ alignItems: 'center', textAlign: 'center' }}>
        <Icon name={result.delta >= 0 ? 'trophy' : 'wallet'} size={38} style={{ color: result.delta >= 0 ? 'var(--good)' : 'var(--received)' }} />
        <div className="display" style={{ fontSize: '1.6rem' }}>
          {result.delta === 0 ? 'Square' : result.delta > 0 ? `+${fmtNumber(result.delta)}` : fmtNumber(result.delta)}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          {result.reason
            ? result.reason
            : result.delta >= 0
              ? 'Your stacked chips were cashed back into your balance.'
              : 'Your table losses were settled from your balance.'}
        </p>
        <Button variant="primary" block onClick={onClose}>
          Back to poker lobby
        </Button>
      </div>
    </Modal>
  );
}

/* ================= TABLE ================= */

function PokerTable({
  snap,
  game,
  mySeat,
  tableName,
  mode,
  bb,
  timerSec,
  maxRaises,
  buyin,
  heroAvatar,
  onLeave,
  onRebuy,
  onOnlineAction,
  onHandStat,
  online = false,
}: {
  snap: GameSnapshot;
  game?: PokerGame;
  mySeat: number;
  tableName: string;
  mode: Mode;
  bb: number;
  timerSec: number;
  maxRaises: number;
  buyin: number;
  heroAvatar: string;
  onLeave: () => void;
  onRebuy: () => void;
  onOnlineAction: (kind: SeatKind, amount?: number) => void;
  onHandStat?: (stat: { vpip: boolean; pfr: boolean }) => void;
  online?: boolean;
}) {
  const me = snap.seats[mySeat];
  const myStack = me?.stack ?? 0;
  const toCall =
    game && game.s.seats[mySeat]
      ? game.toCall(mySeat)
      : Math.max(0, snap.currentBet - (me?.bet ?? 0));
  const minRaise = snap.minRaiseTotal;
  const raiseMax = me ? me.bet + me.stack : 0;
  const [raiseMode, setRaiseMode] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(minRaise);
  const [historyOpen, setHistoryOpen] = useState(false);
  const displayPot = useCountUp(snap.pot, 600);
  const lastReportedHand = useRef(-1);
  const vpipRef = useRef(false);
  const pfrRef = useRef(false);

  const isMyTurn = snap.phase === 'betting' && snap.turn === mySeat;
  const potStyle = { '--fill': `${(((raiseAmount - minRaise) / Math.max(1, raiseMax - minRaise)) * 100)}%` } as React.CSSProperties;

  const act = (kind: SeatKind, amount?: number) => {
    const voluntaryToMoney: SeatKind[] = ['call', 'raise', 'allin'];
    if (snap.street === 0 && voluntaryToMoney.includes(kind)) {
      vpipRef.current = true;
      if (kind === 'raise' || kind === 'allin') pfrRef.current = true;
    }
    if (game) game.playerAction(kind, amount);
    else onOnlineAction(kind, amount);
    if (kind === 'raise') setRaiseMode(false);
    if (kind === 'raise' || kind === 'allin') snd.raise();
    else if (kind === 'fold') snd.fold();
    else snd.chip();
  };

  useEffect(() => {
    setRaiseAmount(minRaise);
  }, [minRaise]);

  /* reset per-hand VPIP/PFR trackers */
  useEffect(() => {
    if (snap.phase === 'dealing' || (snap.handNum !== lastReportedHand.current && snap.phase !== 'roundEnd')) {
      vpipRef.current = false;
      pfrRef.current = false;
    }
  }, [snap.handNum, snap.phase]);

  /* report once per completed hand */
  useEffect(() => {
    if (snap.phase === 'roundEnd' && onHandStat && lastReportedHand.current !== snap.handNum) {
      lastReportedHand.current = snap.handNum;
      onHandStat({ vpip: vpipRef.current, pfr: pfrRef.current });
    }
  }, [snap.phase, snap.handNum, onHandStat]);

  /* client-side turn countdown — fires fold/check only when the timer truly expires */
  const [secondsLeft, setSecondsLeft] = useState(0);
  const actRef = useRef(act);
  const toCallRef = useRef(toCall);
  actRef.current = act;
  toCallRef.current = toCall;
  const timerKey = isMyTurn ? `${snap.handNum}:${snap.street}:${snap.turn}` : '';
  useEffect(() => {
    if (!isMyTurn || timerSec <= 0) {
      setSecondsLeft(0);
      return;
    }
    setSecondsLeft(timerSec);
    const iv = window.setInterval(() => {
      setSecondsLeft((x) => (x <= 1 ? 0 : x - 1));
    }, 1000);
    const fire = window.setTimeout(() => {
      actRef.current(toCallRef.current > 0 ? 'fold' : 'check');
    }, timerSec * 1000);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(fire);
    };
  }, [timerKey, isMyTurn, timerSec]);

  const myWon = snap.seats[mySeat]?.isWinner;

  return (
    <div className="page poker-page">
      {/* top bar */}
      <div className="container" style={{ paddingTop: 18 }}>
        <div className="row:between" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">Table · {tableName}</span>
            <h1 className="page-title" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              Texas Hold'em
              <span className="badge badge-gold">BB {bb}</span>
              <span className="badge">{MODE_LABEL[mode]}</span>
              {maxRaises > 0 && <span className="badge">{maxRaises}-raise cap</span>}
            </h1>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {online && (
              <span className="badge" style={{ color: 'var(--good)' }}>
                <Icon name="activity" size={13} /> Live
              </span>
            )}
            <button className="icon-btn" onClick={() => setHistoryOpen((v) => !v)} aria-label="Toggle hand history" title="Hand history">
              <Icon name={historyOpen ? 'close' : 'clock'} size={18} />
            </button>
            <Button variant="ghost" size="sm" icon="logout" onClick={onLeave}>
              {online ? 'Lobby' : 'Leave'}
            </Button>
          </div>
        </div>
      </div>

      {/* table */}
      <div className="container" style={{ paddingTop: 12 }}>
        <div className="poker-stage" data-phase={snap.phase}>
          <div className="poker-rail">
            <div className="poker-felt">
              <div className="board-lane-position">
                {snap.layers.length > 1 && (snap.phase === 'showdown' || snap.phase === 'roundEnd') ? (
                  <div className="pot-dishes">
                    {snap.layers.map((layer, i) => (
                      <div key={i} className={`pot-dish pot-dish-layer ${i % 2 === 1 ? 'layer-b' : ''}`} style={{ zIndex: snap.layers.length - i }}>
                        <div className="eyebrow" style={{ fontSize: '0.6rem' }}>{layer.label}</div>
                        <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 800 }}>{fmtNumber(layer.amount)}</div>
                        <div className="pot-winners">{layer.winners.join(' · ')}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pot-dish">
                    <div className="eyebrow" style={{ fontSize: '0.6rem' }}>Pot</div>
                    <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 800 }}>{fmtNumber(displayPot)}</div>
                  </div>
                )}
                <div className="board-lane">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="board-card" style={{ animationDelay: `${i * 90}ms` }}>
                      {snap.board[i] ? (
                        <PlayingCard card={snap.board[i]} size="board" delay={i * 90} />
                      ) : (
                        <div className="board-empty" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* seats */}
          {snap.seats.map((seat, i) => (
            <Seat
              key={i}
              seat={seat}
              idx={i}
              mySeat={online ? mySeat : 0}
              pos={seatPose(i, snap.seats.length)}
              dealer={snap.dealer === i}
              isTurn={snap.phase === 'betting' && snap.turn === i}
              betting={snap.phase === 'betting'}
              revealAll={snap.phase === 'showdown' || snap.phase === 'roundEnd' || snap.phase === 'won' || snap.phase === 'busted'}
              myAvatar={heroAvatar}
            />
          ))}

          {snap.phase === 'roundEnd' && (
            <RoundBanner
              myWon={!!myWon}
              wonAmount={snap.seats[mySeat]?.won ?? 0}
              winnerName={snap.seats.find((s) => s.isWinner)?.name ?? ''}
              winningHand={snap.lastWinningHand}
              isMine={snap.seats[mySeat]?.isWinner ?? false}
            />
          )}

          {snap.phase === 'won' && (
            <div className="bust-overlay winner-overlay">
              <div className="stack" style={{ gap: 12, alignItems: 'center', textAlign: 'center' }}>
                <Icon name="crown" size={42} style={{ color: 'var(--gold-3)' }} />
                <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>Champion</div>
                <p className="muted" style={{ margin: 0, fontSize: '0.9rem', maxWidth: '36ch' }}>{snap.message}</p>
                <Button variant="primary" icon="logout" onClick={onLeave}>
                  Return to lobby
                </Button>
              </div>
            </div>
          )}

          {snap.phase === 'busted' && (
            <div className="bust-overlay">
              <div className="stack" style={{ gap: 12, alignItems: 'center', textAlign: 'center' }}>
                <Icon name={mode === 'cash' ? 'coins' : 'medal'} size={40} style={{ color: 'var(--gold-3)' }} />
                <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>
                  {mode === 'cash' ? 'Table busted' : 'Eliminated'}
                </div>
                <p className="muted" style={{ margin: 0, fontSize: '0.9rem', maxWidth: '38ch' }}>{snap.message}</p>
                {mode === 'cash' && !online ? (
                  <Button variant="primary" icon="plus" onClick={onRebuy}>
                    Rebuy {fmtNumber(buyin)}
                  </Button>
                ) : (
                  <Button variant="primary" icon="logout" onClick={onLeave}>
                    Leave table
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* message */}
        <p className="table-msg" role="status">{snap.message}</p>

        {/* action bar (me only) */}
        <div className={`action-bar ${isMyTurn ? '' : 'dimmed'}`}>
          <div className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="badge badge-gold"><Icon name="coins" size={13} /> {fmtNumber(myStack)}</span>
              {online ? (
                <span className="badge"><Icon name="users" size={13} /> Seat {mySeat + 1}</span>
              ) : (
                <span className="badge badge-gold"><Icon name="shield" size={13} /> {fmtNumber(buyin)} stack</span>
              )}
              {!isMyTurn && snap.phase === 'betting' && (
                <span className="badge">{snap.turn >= 0 ? `${snap.seats[snap.turn].name} to act…` : ''}</span>
              )}
            </div>
            {timerSec > 0 && isMyTurn && (
              <div className="turn-timer" role="timer" aria-live="off">
                <div className="turn-timer-fill" style={{ '--tt': `${Math.max(0, (secondsLeft / timerSec) * 100)}%` } as React.CSSProperties} />
                <span className="mono">{secondsLeft}s</span>
              </div>
            )}
          </div>

          {isMyTurn ? (
            <div className="stack" style={{ gap: 10 }}>
              {raiseMode && (
                <div className="raise-ctl">
                  <span className="raise-val mono">{fmtNumber(raiseAmount)}</span>
                  <input
                    type="range"
                    min={minRaise}
                    max={raiseMax}
                    step={Math.max(1, Math.round(bb / 2))}
                    value={Math.min(raiseAmount, raiseMax)}
                    style={potStyle}
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    aria-label="Raise amount"
                  />
                  <span className="raise-val mono">{fmtNumber(raiseMax)}</span>
                </div>
              )}
              <div className="action-btns">
                <Button variant="danger" icon="close" onClick={() => act('fold')}>
                  Fold
                </Button>
                {toCall === 0 ? (
                  <Button variant="ghost" icon="check" onClick={() => act('check')}>
                    Check
                  </Button>
                ) : (
                  <Button variant="primary" icon="check" onClick={() => act('call')}>
                    Call {fmtNumber(toCall)}
                  </Button>
                )}
                <Button variant="goldGhost" icon="arrowUpRight" onClick={() => setRaiseMode((v) => !v)}>
                  {raiseMode ? 'Cancel' : 'Raise'}
                </Button>
                {raiseMode && (
                  <Button variant="primary" icon="arrowUpRight" onClick={() => act('raise', raiseAmount)}>
                    Commit
                  </Button>
                )}
                <Button
                  variant="ghost"
                  icon="bolt"
                  disabled={myStack === 0}
                  onClick={() => act('allin')}
                  title="All-in"
                >
                  All-in
                </Button>
              </div>
            </div>
          ) : (
            <div className="action-btns" style={{ opacity: 0.5, pointerEvents: 'none' }}>
              <Button variant="ghost" disabled>Fold</Button>
              <Button variant="ghost" disabled>Check</Button>
              <Button variant="ghost" disabled>Call</Button>
            </div>
          )}
        </div>

        {/* hand history */}
        {historyOpen && (
          <div className="panel panel-pad" style={{ marginTop: 18 }}>
            <div className="row:between" style={{ marginBottom: 10 }}>
              <span className="eyebrow">Hand history</span>
              <span className="muted" style={{ fontSize: '0.78rem' }}>Hand #{snap.handNum} · live</span>
            </div>
            <div className="log-scroll">
              {snap.log.slice(-18).reverse().map((l, i) => (
                <div key={i} className="log-line">
                  <span className="log-name">{l.seat}</span>
                  <span className="log-text">{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Seat({
  seat,
  idx,
  mySeat,
  pos,
  dealer,
  isTurn,
  betting,
  revealAll,
  myAvatar,
}: {
  seat: PokerSeat;
  idx: number;
  mySeat: number;
  pos: { x: number; y: number };
  dealer: boolean;
  isTurn: boolean;
  betting: boolean;
  revealAll: boolean;
  myAvatar: string;
}) {
  const isMe = idx === mySeat;
  const showCards = revealAll || isMe;
  const person = seat.isBot ? seat.name : isMe ? 'You' : seat.name;
  const folded = seat.folded || seat.eliminated;
  return (
    <div
      className={`seat ${isTurn ? 'is-turn' : ''} ${folded ? 'folded-seat' : ''} ${isMe ? 'is-me' : ''}`}
      style={{ '--s-x': `${pos.x}%`, '--s-y': `${pos.y}%` } as React.CSSProperties}
    >
      <div className="seat-frame">
        <div className="seat-plate">
          {dealer && (
            <span className="seat-dealer" title="Dealer button">
              D
            </span>
          )}
          <div className="seat-face-row">
            <Avatar avatarId={isMe ? myAvatar : seat.avatarId} size={34} ring={isTurn} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {person}
              </div>
              {seat.isBot && seat.personality && (
                <div className="muted" style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {seat.personality}
                </div>
              )}
            </div>
          </div>
          <div className="seat-holes">
            {seat.hole.length === 0 ? (
              <div className="seat-holes">
                <span className="hole-empty" />
                <span className="hole-empty" />
              </div>
            ) : (
              seat.hole.map((c, i) => (
                <PlayingCard key={i} card={c} faceDown={!showCards} size="hole" className={isMe ? 'hero' : ''} delay={i * 120} />
              ))
            )}
          </div>
          <div className="seat-stack mono">{fmtNumber(seat.stack)}</div>
          <div className="seat-status">
            {seat.eliminated && <span>Out</span>}
            {!seat.eliminated && seat.folded && <span className="folded">Folded</span>}
            {!seat.eliminated && !seat.folded && seat.allin && <span>All-in</span>}
            {!seat.eliminated && !seat.folded && !seat.allin && isTurn && betting && (
              <span className="thinking"><span className="pulse-dot" /> thinking…</span>
            )}
            {!seat.eliminated && !seat.folded && !seat.allin && betting && <span>&nbsp;</span>}
            {!betting && seat.isWinner && <span className="winner-tag">Winner</span>}
            {!betting && !seat.isWinner && !seat.folded && !seat.eliminated && <span>&nbsp;</span>}
          </div>
        </div>
        {(seat.bet > 0 || isMe) && (
          <div className="seat-bet">
            <ChipStack amount={seat.bet} size={18} />
            {seat.bet > 0 && <span className="seat-bet-num mono">{fmtNumber(seat.bet)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function RoundBanner({ myWon, wonAmount, winnerName, winningHand, isMine }: { myWon: boolean; wonAmount: number; winnerName: string; winningHand: string | null; isMine: boolean }) {
  return (
    <div className="win-banner">
      <div className={`win-card ${isMine ? 'win' : 'lose'}`}>
        <div className="win-title">{isMine ? 'You take the pot' : `${winnerName} takes the pot`}</div>
        {myWon && <div className="win-amount mono">+{fmtNumber(wonAmount)}</div>}
        {winningHand && <div className="win-hand">{winningHand}</div>}
      </div>
    </div>
  );
}