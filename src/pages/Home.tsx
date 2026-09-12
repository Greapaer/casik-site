import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/ui';
import { Icon, type IconName } from '../components/ui/Icon';
import { Reveal } from '../hooks/useInView';
import { useCountUp } from '../hooks/useCountUp';
import { fmtNumber, pct } from '../lib/utils';

export function Home() {
  const { user, balance, profile, activity } = useApp();
  const navigate = useNavigate();
  const displayBalance = useCountUp(balance, 900);

  const winRate = profile?.pokerHands ? pct(profile.pokerWins, profile.pokerHands) : 0;

  return (
    <div className="page">
      {/* ---- HERO ---- */}
      <section className="container hero-section">
        <div className="hero-grid">
          <motion.div
            className="stack"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ gap: 22 }}
          >
            <span className="eyebrow">Members-only virtual lounge</span>
            <h1 className="display-xl">
              Where the <span className="gold-text">night</span> deals
              <br /> the finest hand.
            </h1>
            <p className="page-sub" style={{ fontSize: '1.05rem', maxWidth: '52ch' }}>
              Noir Royale is a premium virtual-casino experience. Take a seat at the Texas Hold'em
              table, manage your balance, and climb the ranks — all with free casino chips.
            </p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
              <Button size="lg" icon="cards" onClick={() => navigate('/poker')}>
                Play Texas Hold'em
              </Button>
              <Button size="lg" variant="goldGhost" icon="wallet" onClick={() => navigate('/balance')}>
                Recharge balance
              </Button>
            </div>
            {!user && (
              <div className="guest-cta">
                <span className="badge" style={{ marginRight: 8 }}><Icon name="user" size={13} /> Guest mode</span>
                <Link to="/register" className="nav-link row" style={{ gap: 6 }}>
                  Create a free account <Icon name="arrowRight" size={14} />
                </Link>
              </div>
            )}
            <div className="hero-stats">
              <div className="inline-stat">
                <b className="mono">{(profile?.gamesPlayed ?? 0).toLocaleString('en-US')}</b>
                <span>Games played</span>
              </div>
              <div className="hero-stats-sep" />
              <div className="inline-stat">
                <b className="mono">{winRate}%</b>
                <span>Poker win rate</span>
              </div>
              <div className="hero-stats-sep" />
              <div className="inline-stat">
                <b className="mono">{fmtNumber(profile?.biggestWin ?? 0)}</b>
                <span>Biggest win</span>
              </div>
            </div>
          </motion.div>

          {/* Balance card */}
          <motion.div
            className="stack stack:md"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="panel panel-pad balance-card">
              <div className="row:between">
                <span className="eyebrow">Your balance</span>
              </div>
              <div className="big-value gold-text" style={{ marginTop: 10 }}>
                {fmtNumber(displayBalance)}
              </div>
              <div className="row:between" style={{ marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
                <Button variant="primary" icon="wallet" onClick={() => navigate('/balance')}>
                  Open balance
                </Button>
                <Link to="/balance" className="nav-link row" style={{ gap: 6 }}>
                  Top-ups & ledger <Icon name="arrowRight" size={15} />
                </Link>
              </div>
              <div className="hr" style={{ margin: '18px 0 14px' }} />
              <div className="row:between">
                <span className="muted" style={{ fontSize: '0.82rem' }}>
                  {user ? `Signed in as ${user.username}` : 'Playing as guest'}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---- PROMO TICKER ---- */}
      <section className="container" style={{ marginTop: 34 }}>
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="ticker" aria-hidden="true">
            <div className="ticker-track">
              {[0, 1].map((dup) => (
                <span key={dup} className="row" style={{ gap: 56 }}>
                  {[
                    'Welcome package: $5,000 for new players',
                    'Heads-up, five-handed and nine-handed tables',
                    'Eight distinct bot personalities read the board, the pot and you',
                    'Diamond-cut suits, side pots and full showdown logic',
                  ].map((t, i) => (
                    <span key={i} className="row" style={{ gap: 12, color: 'var(--text-2)', fontWeight: 600 }}>
                      <Icon name="spark" size={15} style={{ color: 'var(--gold-3)' }} /> {t}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- FEATURED POKER ---- */}
      <Reveal className="container section">
        <div className="featured">
          <div className="featured-visual" aria-hidden="true">
            <img className="featured-img" src="/featured.jpg" alt="" draggable={false} />
          </div>
          <div className="featured-copy stack" style={{ gap: 16 }}>
            <span className="eyebrow">Featured game</span>
            <h2 className="display-lg">Texas Hold'em, your table, real decisions.</h2>
            <p className="page-sub">
              A fully-simulated table with blinds, side pots, all-ins and showdown logic. Eight AI
              personalities read the board, the pot and your betting — then they make their move.
            </p>
            <ul className="feature-list">
              {['Heads-up, five-handed and nine-handed tables', 'Complete hand ranking & side-pot payouts', 'Animated dealing, hidden opponent cards and winning-hand reveal'].map((t) => (
                <li key={t} className="row" style={{ gap: 10 }}>
                  <Icon name="check" size={16} style={{ color: 'var(--good)' }} /> {t}
                </li>
              ))}
            </ul>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <Button size="lg" icon="cards" onClick={() => navigate('/poker')}>
                Take a seat
              </Button>
              <span className="muted" style={{ fontSize: '0.85rem' }}>Blinds from 10 / 20 · buy-in from 1,000</span>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- STATS + ACTIVITY ---- */}
      <Reveal className="container section">
        <div className="grid-2-asym">
          <div className="panel panel-pad stack" style={{ gap: 18 }}>
            <div className="row:between">
              <div>
                <span className="eyebrow">Player statistics</span>
                <h3 className="display" style={{ fontSize: '1.5rem', marginTop: 6 }}>Your form</h3>
              </div>
              {user && <Avatar avatarId={profile?.avatarId ?? user.avatarId} size={46} ring />}
            </div>
            <div className="grid-2">
              <Stat label="Hands played" value={(profile?.pokerHands ?? 0).toLocaleString('en-US')} icon="cards" />
              <Stat label="Hands won" value={(profile?.pokerWins ?? 0).toLocaleString('en-US')} icon="trophy" />
              <Stat label="Win rate" value={`${winRate}%`} icon="chart" />
              <Stat label="Biggest win" value={fmtNumber(profile?.biggestWin ?? 0)} icon="coins" />
            </div>
          </div>

          <div className="panel panel-pad stack" style={{ gap: 12 }}>
            <div className="row:between">
              <span className="eyebrow">Recent activity</span>
              <Icon name="activity" size={18} style={{ color: 'var(--gold-3)' }} />
            </div>
            {activity.length === 0 ? (
              <div className="empty" style={{ padding: '28px 0' }}>
                <div className="empty-icon"><Icon name="clock" size={24} /></div>
                <div className="empty-title">Nothing yet</div>
                <div className="empty-msg">Your wins, bonuses and milestones will appear here.</div>
              </div>
            ) : (
              <div>
                {activity.slice(0, 5).map((a) => (
                  <div key={a.id} className="activity-item">
                    <div className={`activity-ic ${a.tone === 'neutral' ? 'neutral' : a.tone}`}>
                      <Icon name={iconFor(a.icon)} size={17} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.text}</div>
                      <div className="muted" style={{ fontSize: '0.76rem' }}>{timeAgo(a.ts)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Reveal>

      </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <div className="stat">
      <div className="row:between">
        <span className="stat-label">{label}</span>
        <Icon name={icon} size={16} style={{ color: 'var(--gold-4)' }} />
      </div>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function iconFor(name: string): IconName {
  const map: Record<string, IconName> = {
    cards: 'cards', trophy: 'trophy', level: 'bolt', dice: 'dice', gift: 'gift',
    sun: 'sun', spark: 'spark', login: 'login', coins: 'coins',
  };
  return map[name] ?? 'spark';
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}