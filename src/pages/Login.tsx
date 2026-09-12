import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { LogoMark } from '../components/Logo';
import { snd } from '../lib/sound';
import { primeAudio } from '../lib/sound';

export function Login() {
  const { login } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    primeAudio();
    // mimic a short async handshake
    window.setTimeout(async () => {
      const res = await login(username, password);
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? 'Could not sign in.');
        snd.error();
        return;
      }
      snd.bell();
      navigate(from, { replace: true });
    }, 450);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo-mark">
            <LogoMark size={46} />
          </div>
          <span className="eyebrow">Welcome back</span>
        </div>

        <div className="panel panel-pad stack" style={{ gap: 18 }}>
          <form className="stack stack:md" onSubmit={submit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="login-username">
                Username
              </label>
              <div className="input-wrap">
                <Icon name="user" size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
                <input
                  id="login-username"
                  className="input"
                  style={{ paddingLeft: 42 }}
                  autoComplete="username"
                  placeholder="e.g. Catherine"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="login-password">
                Password
              </label>
              <div className="input-wrap">
                <input
                  id="login-password"
                  className="input"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="input-eye"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => setShow((s) => !s)}
                >
                  <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
            </div>

            {error && <div className="field-error">{error}</div>}

            <Button type="submit" size="lg" block loading={busy} icon="login">
              Sign in
            </Button>
          </form>

          <div className="hr" />

          <div className="row" style={{ justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: '0.9rem' }}>New to Noir Royale?</span>
            <Link to="/register" className="nav-link" style={{ color: 'var(--gold-2)' }}>
              Create an account
            </Link>
          </div>
        </div>

        <div className="virtual-note" style={{ marginTop: 18 }}>
          <Icon name="shield" size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Your account, balance and history live only in this browser. No data leaves your device.
          </span>
        </div>
      </div>
    </div>
  );
}