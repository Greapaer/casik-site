import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { Icon, type IconName } from './ui/Icon';

const TONE_ICON: Record<string, IconName> = {
  good: 'check',
  bad: 'warning',
  gold: 'spark',
  info: 'info',
};

export function ToastRoot() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toast-root" aria-live="polite" aria-atomic="false">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast ${t.tone}`}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <div className="toast-ic">
              <Icon name={TONE_ICON[t.tone] ?? 'info'} size={18} />
            </div>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.message && <div className="toast-msg">{t.message}</div>}
            </div>
            <button className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification">
              <Icon name="close" size={15} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}