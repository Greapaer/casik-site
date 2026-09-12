import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { LogoMark } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import { AVATARS } from '../lib/avatars';
import { snd, primeAudio } from '../lib/sound';

export function Register() {
  const { register } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [avatar, setAvatar] = useState('lynx-gold');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    primeAudio();
    window.setTimeout(async () => {
      const res = await register(username, password, avatar);
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? 'Could not create your account.');
        snd.error();
        return;
      }
      snd.bell();
      navigate('/', { replace: true });
    }, 450);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo-mark">
            <LogoMark size={46} />
          </div>
          <span className="eyebrow">Join the lounge</span>
        </div>

        <div className="panel panel-pad stack" style={{ gap: 20 }}>
          <form
            className="stack stack:md"
            onSubmit={submit}
            noValidate
          >
            <div className="field">
              <label className="field-label">Choose an avatar</label>
              <div className="avatar-pick">
                {AVATARS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="avatar-btn"
                    style={{ '--av': '54px' } as React.CSSProperties}
                    aria-pressed={avatar === a.id}
                    onClick={() => setAvatar(a.id)}
                    title={a.id}
                  >
                    <Avatar avatarId={a.id} size={54} />
                    {avatar === a.id && <span className="avatar-btn-check" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="reg-username">
                Username
              </label>
              <div className="input-wrap">
                <Icon name="user" size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
                <input
                  id="reg-username"
                  className="input"
                  style={{ paddingLeft: 42 }}
                  autoComplete="username"
                  placeholder="e.g. Catherine"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <span className="field-hint">3+ characters, letters, numbers, spaces and _- only.</span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="reg-password">
                Password
              </label>
              <div className="input-wrap">
                <input
                  id="reg-password"
                  className="input"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
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

            <div className="field">
              <label className="field-label" htmlFor="reg-confirm">
                Confirm password
              </label>
              <input
                id="reg-confirm"
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            {error && <div className="field-error">{error}</div>}

            <Button type="submit" size="lg" block loading={busy} icon="spark">
              Create account — +$5,000
            </Button>
          </form>

          <div className="hr" />

          <div className="row" style={{ justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: '0.9rem' }}>Already a member?</span>
            <Link to="/login" className="nav-link" style={{ color: 'var(--gold-2)' }}>
              Sign in
            </Link>
          </div>
        </div>

        <div className="virtual-note" style={{ marginTop: 18 }}>
          <Icon name="shield" size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            New accounts start with <b>$5,000</b>. No email, no real money — ever.
          </span>
        </div>
      </div>
    </div>
  );
}