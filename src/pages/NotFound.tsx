import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import { Icon } from '../components/ui/Icon';

export function NotFound() {
  return (
    <div className="page container" style={{ display: 'grid', placeItems: 'center', minHeight: '56vh' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <div className="empty-icon" style={{ width: 84, height: 84 }}>
          <Icon name="target" size={38} />
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.6rem, 6vw, 4rem)', fontWeight: 600, lineHeight: 1 }}>
          404
        </div>
        <p className="page-sub" style={{ maxWidth: '40ch', margin: 0 }}>
          This page folded and the deck didn't reshuffle. Head back to the lobby to keep playing.
        </p>
        <div className="row" style={{ gap: 10 }}>
          <Link to="/">
            <Button icon="home">Back to Home</Button>
          </Link>
          <Link to="/poker">
            <Button variant="goldGhost" icon="cards">Play poker</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}