import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';
import { snd } from '../../lib/sound';

/* ---------------- Button ---------------- */
export type ButtonVariant = 'primary' | 'ghost' | 'goldGhost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, loading, block, children, className = '', onClick, disabled, type = 'button', ...rest },
  ref,
) {
  const cls = [
    'btn',
    variant === 'primary' ? 'btn-primary' : '',
    variant === 'ghost' ? 'btn-ghost' : '',
    variant === 'goldGhost' ? 'btn-gold-ghost' : '',
    variant === 'danger' ? 'btn-danger' : '',
    size === 'lg' ? 'btn-lg' : size === 'sm' ? 'btn-sm' : '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={disabled || loading}
      onClick={(e) => {
        if (!disabled && !loading) snd.click();
        onClick?.(e);
      }}
      onMouseEnter={() => {
        if (!disabled) snd.hover();
      }}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 18} />}
      {children}
    </button>
  );
});

/* ---------------- Modal ---------------- */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdrop?: boolean;
}

export function Modal({ open, onClose, title, eyebrow, children, footer, size = 'md', closeOnBackdrop = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () =>
      panelRef.current
        ? Array.from(panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        : [];
    const first = () => focusables()[0];
    first()?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab') {
        const list = focusables();
        if (list.length === 0) return;
        const firstEl = list[0];
        const lastEl = list[list.length - 1];
        const active = document.activeElement as HTMLElement;
        if (e.shiftKey && (active === firstEl || active === panelRef.current || !panelRef.current?.contains(active))) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onMouseDown={() => closeOnBackdrop && onClose()}
          role="dialog"
          aria-modal="true"
          aria-label={title ?? 'Dialog'}
        >
          <motion.div
            ref={panelRef}
            className="modal"
            data-size={size}
            role="document"
            tabIndex={-1}
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {(title || eyebrow) && (
              <div className="modal-head">
                <div>
                  {eyebrow && <div className="eyebrow">{eyebrow}</div>}
                  {title && <h3 className="modal-title">{title}</h3>}
                </div>
                <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
                  <Icon name="close" size={18} />
                </button>
              </div>
            )}
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Toggle switch ---------------- */
interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'is-on' : ''}`}
      onClick={() => {
        snd.click();
        onChange(!checked);
      }}
    >
      <span className="toggle-knob" />
    </button>
  );
}

/* ---------------- Segmented ---------------- */
interface SegOption<T extends string> {
  value: T;
  label: string;
}
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className="seg-btn"
          onClick={() => {
            snd.click();
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Spinner ---------------- */
export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spin-wrap">
      <span className="spinner display" aria-hidden="true" />
      {label && <span className="muted" style={{ fontSize: '0.85rem' }}>{label}</span>}
    </span>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({
  icon = 'layers',
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <div className="empty-title">{title}</div>
      {message && <div className="empty-msg">{message}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

/* ---------------- Progress ---------------- */
export function ProgressBar({ value, max, tone = 'gold' }: { value: number; max: number; tone?: 'gold' | 'good' | 'info' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill progress-${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}