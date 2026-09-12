import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { BalancePill } from './BalancePill';
import { Button } from './ui';
import { Icon } from './ui/Icon';
import { Avatar } from './Avatar';
import { MusicToggle } from './AmbientMusic';
import { useApp } from '../context/AppContext';
import { snd } from '../lib/sound';

export function Header() {
  const { user, profile } = useApp();
  const navigate = useNavigate();
  const loc = useLocation();

  const NAV: { to: string; label: string }[] = [
    { to: '/', label: 'Home' },
    { to: '/poker', label: 'Poker' },
    { to: '/balance', label: 'Balance' },
  ];

  return (
    <header className="header">
      <div className="container header-inner">
        <Logo />
        <nav className="desktop-nav row" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => snd.click()}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-right">
          <MusicToggle />
          {user ? (
            <>
              <BalancePill />
              {loc.pathname !== '/profile' && (
                <Link to="/profile" className="name-plate" aria-label="Open profile">
                  <Avatar avatarId={profile?.avatarId ?? user.avatarId} size={34} />
                  <span className="stack" style={{ gap: 0 }}>
                    <b>{user.username}</b>
                  </span>
                </Link>
              )}
            </>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Sign in
              </Button>
              <Button size="sm" onClick={() => navigate('/register')}>
                Join now
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const { user } = useApp();
  const [kbOpen, setKbOpen] = useState(false);
  const items = [
    { to: '/', label: 'Home', icon: 'home' as const },
    { to: '/poker', label: 'Poker', icon: 'cards' as const },
    { to: '/balance', label: 'Balance', icon: 'wallet' as const },
    { to: user ? '/profile' : '/login', label: user ? 'Profile' : 'Account', icon: 'user' as const },
  ];

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const isField = (el: EventTarget | null): boolean => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const n = t.nodeName;
      return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT' || (t.isContentEditable && !!t.closest('input, textarea, select'));
    };
    const onFocusIn = () => {
      if (mq.matches) setKbOpen(isField(document.activeElement));
    };
    const onFocusOut = () => setKbOpen(false);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <nav className={`bottom-nav ${kbOpen ? 'keyboard-open' : ''}`} aria-label="Mobile">
      <div className="bottom-nav-inner container" style={{ maxWidth: 520 }}>
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) => `bottom-item ${isActive ? 'active' : ''}`}
            onClick={() => snd.click()}
          >
            <Icon name={it.icon} size={21} />
            {it.label}
            <span className="ind" />
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Footer() {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  return (
    <footer className="footer">
      <div className="container stack" style={{ gap: 18 }}>
        <div className="row:between" style={{ flexWrap: 'wrap', gap: 14 }}>
          <Logo />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {user ? (
              <>
                <Link className="nav-link" to="/profile">Profile</Link>
                <Link className="nav-link" to="/balance">Balance</Link>
                <button
                  className="nav-link"
                  style={{ color: 'var(--bad)' }}
                  onClick={() => {
                    snd.click();
                    logout();
                    navigate('/');
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link className="nav-link" to="/login">Sign in</Link>
                <Link className="nav-link" to="/register">Join now</Link>
              </>
            )}
          </div>
        </div>
        <div className="hr" />
        <div className="row:between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <p className="muted" style={{ fontSize: '0.82rem', margin: 0, maxWidth: '58ch' }}>
            Noir Royale is an <b>entertainment demo</b>. All balances, chips, bonuses and rewards are
            <b> virtual in-game credits</b> with no real-world value. No real money is accepted or paid out.
          </p>
          <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
            © {new Date().getFullYear()} Noir Royale · All hands dealt fairly by RNG.
          </p>
        </div>
      </div>
    </footer>
  );
}