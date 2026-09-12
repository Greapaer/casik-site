import { Link } from 'react-router-dom';
import { useCountUp } from '../hooks/useCountUp';
import { useApp } from '../context/AppContext';
import { fmtCompact } from '../lib/utils';

export function BalancePill() {
  const { balance } = useApp();
  const display = useCountUp(balance, 800);
  return (
    <Link to="/balance" className="bal-pill" title="Balance">
      <span className="bal-dot" />
      <span className="mono">{fmtCompact(display)}</span>
    </Link>
  );
}