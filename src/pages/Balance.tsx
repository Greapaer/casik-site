import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui';
import { Icon, type IconName } from '../components/ui/Icon';
import { TopUpModal } from '../components/TopUpModal';
import { useCountUp } from '../hooks/useCountUp';
import { fmtDateTime, fmtNumber, fmtSign } from '../lib/utils';
import type { Transaction, TxCategory } from '../types';

type Filter = 'all' | TxCategory;

const CAT_META: Record<Filter, { label: string; icon: IconName }> = {
  all: { label: 'All', icon: 'layers' },
  topup: { label: 'Top ups', icon: 'coins' },
  bonus: { label: 'Bonuses', icon: 'gift' },
  wager: { label: 'Wagers', icon: 'dice' },
  win: { label: 'Wins', icon: 'trophy' },
  fee: { label: 'Fees', icon: 'clock' },
};

export function Balance() {
  const { balance, txHistory } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [topUp, setTopUp] = useState(false);
  const displayBalance = useCountUp(balance, 800);

  const totals = useMemo(() => {
    let inTotal = 0;
    let outTotal = 0;
    txHistory.forEach((t) => {
      if (t.amount >= 0) inTotal += t.amount;
      else outTotal += Math.abs(t.amount);
    });
    return { inTotal, outTotal };
  }, [txHistory]);

  const filtered = useMemo(
    () => (filter === 'all' ? txHistory : txHistory.filter((t) => t.category === filter)),
    [txHistory, filter],
  );

  return (
    <div className="page container" style={{ paddingTop: 8 }}>
      <div className="page-head">
        <span className="eyebrow">Balance & Ledger</span>
        <h1 className="page-title">Your vault</h1>
        <p className="page-sub">
          Every dollar in and out, recorded under your account. Top-ups are simulated play
          money — nothing here is real currency.
        </p>
      </div>

      <div className="grid-3" style={{ marginBottom: 26 }}>
        <div className="panel panel-pad balance-card stack" style={{ gap: 10 }}>
          <span className="eyebrow">Available balance</span>
          <div className="big-value gold-text mono">{fmtNumber(displayBalance)}</div>
        </div>
        <div className="panel panel-pad stack" style={{ gap: 10 }}>
          <span className="eyebrow">All-time in</span>
          <div className="big-value mono" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', color: 'var(--good)' }}>
            +{fmtNumber(totals.inTotal)}
          </div>
          <span className="muted" style={{ fontSize: '0.82rem' }}>Top-ups, bonuses, promotions & wins</span>
        </div>
        <div className="panel panel-pad stack" style={{ gap: 10 }}>
          <span className="eyebrow">All-time out</span>
          <div className="big-value mono" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', color: 'var(--bad)' }}>
            −{fmtNumber(totals.outTotal)}
          </div>
          <span className="muted" style={{ fontSize: '0.82rem' }}>Wagers placed across all games</span>
        </div>
      </div>

      <div className="panel panel-pad" style={{ marginBottom: 26 }}>
        <div className="row:between" style={{ flexWrap: 'wrap', gap: 14 }}>
          <Button icon="plus" onClick={() => setTopUp(true)}>
            Top Up
          </Button>
          <span className="field-hint">Top-ups capped at 3 per day (they're free, after all).</span>
        </div>
      </div>

      <div className="promo-banner" style={{ marginBottom: 26 }}>
        <img src="/promo.jpg" alt="" loading="lazy" />
        <div className="promo-text">
          <span className="eyebrow">Promotion</span>
          <h3 className="display" style={{ fontSize: '1.4rem', marginTop: 4 }}>Free chips, every day</h3>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem', maxWidth: '46ch' }}>
            Top-ups are capped at three per day — but bonuses, wins and promotions keep the stack
            plenty deep.
          </p>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 8 }}>
        <div>
          <span className="eyebrow">Transactions</span>
          <h2 className="display" style={{ fontSize: '1.5rem', marginTop: 6 }}>Ledger</h2>
        </div>
        <Link to="/poker" className="nav-link row" style={{ gap: 6 }}>
          Go play and make more <Icon name="arrowRight" size={16} />
        </Link>
      </div>

      <div className="filter-row" style={{ marginBottom: 16 }}>
        {(Object.keys(CAT_META) as Filter[]).map((f) => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? 'on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {CAT_META[f].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <div className="empty-icon"><Icon name="clock" size={26} /></div>
            <div className="empty-title">No transactions yet</div>
            <div className="empty-msg">
              {filter === 'all'
                ? 'Your ledger is empty. Claim a daily bonus or play a hand to get moving.'
                : 'Nothing in this category yet.'}
            </div>
            <div className="empty-action">
              <Link to="/">
                <Button size="sm" variant="goldGhost">Go to home</Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>When</th>
                <th>Detail</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 150).map((t) => (
                <TxRow key={t.id} tx={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 150 && (
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 12 }}>
          Showing the 150 most recent of {filtered.length} transactions.
        </p>
      )}

      <TopUpModal open={topUp} onClose={() => setTopUp(false)} />
    </div>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const isIn = tx.amount >= 0;
  return (
    <tr>
      <td className="muted">{tx.tx}</td>
      <td title={fmtDateTime(tx.ts)}>{fmtDateTime(tx.ts)}</td>
      <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.detail}</td>
      <td>
        <span className={`category-tag cat-${tx.category}`}>{CAT_META[tx.category].label}</span>
      </td>
      <td style={{ textAlign: 'right' }}>
        <span className={`tx-amount ${isIn ? 'tx-in' : 'tx-out'}`}>{fmtSign(tx.amount)}</span>
      </td>
    </tr>
  );
}