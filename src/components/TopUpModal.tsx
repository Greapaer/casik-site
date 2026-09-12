import { useState } from 'react';
import { Modal, Button } from './ui';
import { Icon } from './ui/Icon';
import { useApp } from '../context/AppContext';
import { fmtNumber } from '../lib/utils';
import { snd } from '../lib/sound';

const PRESETS = [1000, 5000, 10000, 25000];

export function TopUpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addCredits, hasTopUpToday, pushToast } = useApp();
  const [custom, setCustom] = useState('');
  const capped = hasTopUpToday();

  const apply = (amount: number) => {
    addCredits(amount, 'topup', `Top-up (+${fmtNumber(amount)})`);
    snd.coin();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Balance / Top Up"
      title="Add To Your Balance"
      size="sm"
    >
      <div className="stack stack:md">
        <div className="virtual-note">
          <Icon name="info" size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <b>Fun only — no real money.</b> Top-ups are simulated for
            demonstration. Nothing here can be exchanged for real currency.
          </span>
        </div>

        <div className="topup-grid">
          {PRESETS.map((p) => (
            <button key={p} className="topup-btn" onClick={() => apply(p)}>
              <Icon name="coins" size={22} style={{ color: 'var(--gold-3)' }} />
              <b>+{fmtNumber(p)}</b>
              <span>Add</span>
            </button>
          ))}
        </div>

        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(custom, 10);
            if (Number.isFinite(n) && n > 0 && n <= 1000000) {
              apply(n);
            } else {
              pushToast({ tone: 'bad', title: 'Enter an amount', message: 'Use a number between 1 and 1,000,000.' });
            }
          }}
        >
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="custom-topup">
              Custom amount
            </label>
            <input
              id="custom-topup"
              className="input"
              inputMode="numeric"
              placeholder="e.g. 2500"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <Button type="submit" variant="goldGhost" style={{ marginTop: 24 }}>
            Add
          </Button>
        </form>

        {capped && (
          <div className="field-hint">
            You've topped up 3 times today. That's plenty of play money — see you tomorrow.
          </div>
        )}
      </div>
    </Modal>
  );
}