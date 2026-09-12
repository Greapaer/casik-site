import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/Avatar';
import { Button, Segmented, Toggle } from '../components/ui';
import { Icon, type IconName } from '../components/ui/Icon';
import { AVATARS } from '../lib/avatars';
import { fmtNumber, pct, fmtDate, fmtSign } from '../lib/utils';
import { snd } from '../lib/sound';

export function Profile() {
  const { user, profile, settings, setSettings, updateSession, logout } = useApp();
  const [tab, setTab] = useState<'overview' | 'settings'>('overview');
  const winRate = profile?.pokerHands ? pct(profile.pokerWins, profile.pokerHands) : 0;

  const applyAvatar = (id: string) => {
    updateSession({ avatarId: id });
    snd.click();
  };

  return (
    <div className="page container" style={{ paddingTop: 8 }}>
      <div className="page-head">
        <span className="eyebrow">Profile</span>
        <h1 className="page-title">{user?.username}</h1>
        <p className="page-sub">Your stats and lounge preferences — all stored safely in this browser.</p>
      </div>

      <div className="grid-2-asym" style={{ marginBottom: 26 }}>
        <div className="stack stack:md">
          <div className="panel panel-pad">
            <div className="row:between" style={{ flexWrap: 'wrap', gap: 16 }}>
              <div className="row" style={{ gap: 16 }}>
                <Avatar avatarId={profile?.avatarId ?? user?.avatarId ?? 'lynx-gold'} size={72} ring />
                <div className="stack" style={{ gap: 4 }}>
                  <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>{user?.username}</div>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    Member since {fmtDate(profile?.joined ?? Date.now())}
                  </span>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Button variant="goldGhost" size="sm" icon="logout" onClick={() => { snd.click(); logout(); }}>
                  Sign out
                </Button>
              </div>
            </div>
          </div>

          <div className="grid-2">
            <StatBox label="Games played" value={(profile?.gamesPlayed ?? 0).toLocaleString('en-US')} icon="dice" />
            <StatBox label="Poker hands" value={(profile?.pokerHands ?? 0).toLocaleString('en-US')} icon="cards" />
            <StatBox label="Win rate" value={`${winRate}%`} icon="chart" />
            <StatBox label="Biggest win" value={fmtNumber(profile?.biggestWin ?? 0)} icon="coins" />
            <StatBox label="Net P/L" value={fmtSign(profile?.pokerNet ?? 0)} icon="chart" />
            <StatBox label="Best bankroll" value={fmtNumber(profile?.bankrollHigh ?? 0)} icon="wallet" />
            <StatBox label="Daily streak" value={`${profile?.dailyStreak ?? 0}d`} icon="flame" />
            <StatBox label="VPIP" value={`${profile?.volPreflop ?? 0}%`} icon="bolt" />
            <StatBox label="Preflop raise" value={`${profile?.pfr ?? 0}%`} icon="arrowUpRight" />
          </div>
        </div>

        <div className="stack stack:md">
          <div className="panel panel-pad">
            <span className="eyebrow">Favorite game</span>
            <div style={{ fontWeight: 800, fontSize: '1.3rem', marginTop: 8 }}>
              {profile?.favoriteGame ?? 'None yet'}
            </div>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: 6 }}>
              Auto-tracked from your most played games.
            </p>
            <div style={{ marginTop: 14 }}>
              <Link to="/poker" className="nav-link row" style={{ gap: 6 }}>
                Play your favorite <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 30 }}>
        <div>
          <span className="eyebrow">Profile detail</span>
          <h2 className="display" style={{ fontSize: '1.5rem', marginTop: 6 }}>Customize</h2>
        </div>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'settings', label: 'Settings' },
        ]}
      />

      {tab === 'overview' && (
        <div className="panel panel-pad" style={{ marginTop: 18 }}>
          <span className="eyebrow">Avatar</span>
          <p className="muted" style={{ fontSize: '0.85rem', margin: '6px 0 16px' }}>
            Pick a new emblem — it follows you across the lounge.
          </p>
          <div className="avatar-pick">
            {AVATARS.map((a) => {
              const active = (profile?.avatarId ?? user?.avatarId) === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  className="avatar-btn"
                  style={{ '--av': '58px' } as React.CSSProperties}
                  aria-pressed={active}
                  onClick={() => applyAvatar(a.id)}
                  title={a.id}
                >
                  <Avatar avatarId={a.id} size={58} />
                  {active && <span className="avatar-btn-check" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="panel panel-pad" style={{ marginTop: 18 }}>
          <div className="stack">
            <SettingRow
              icon="volume"
              title="Sound effects"
              desc="Casino ticks, deal blips and win chimes."
              control={<Toggle checked={settings.sound} onChange={(v) => setSettings({ sound: v })} label="Sound effects" />}
            />
            <SettingRow
              icon="activity"
              title="Animations"
              desc="Full effects or a calmer, reduced-motion experience."
              control={
                <Segmented
                  value={settings.animations}
                  onChange={(v) => setSettings({ animations: v })}
                  options={[
                    { value: 'full', label: 'Full' },
                    { value: 'reduced', label: 'Reduced' },
                  ]}
                />
              }
            />
            <SettingRow
              icon="sun"
              title="Theme"
              desc="Noir charcoal by default, with a bright 'Noir Day' option."
              control={
                <Segmented
                  value={settings.theme}
                  onChange={(v) => setSettings({ theme: v })}
                  options={[
                    { value: 'dark', label: 'Dark' },
                    { value: 'light', label: 'Light' },
                  ]}
                />
              }
            />
          </div>
          <div className="hr" style={{ margin: '18px 0 6px' }} />
          <p className="field-hint">
            Preferences are saved automatically and apply immediately.
          </p>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string; icon: IconName }) {
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

function SettingRow({
  icon,
  title,
  desc,
  control,
}: {
  icon: IconName;
  title: string;
  desc: string;
  control: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-left">
        <div className="setting-ic"><Icon name={icon} size={20} /></div>
        <div>
          <div className="setting-label">{title}</div>
          <div className="setting-desc">{desc}</div>
        </div>
      </div>
      {control}
    </div>
  );
}