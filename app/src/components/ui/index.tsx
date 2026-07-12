import { useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { CheckIcon, XIcon } from '../icons';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// ---------------------------------------------------------------------------
// Shared visual primitives. Kept in one file deliberately: they're small,
// used everywhere, and this avoids a sprawl of one-line component files.
// ---------------------------------------------------------------------------

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-card border border-card-border rounded-[var(--radius-card)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] font-extrabold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap leading-none';
  const sizes: Record<ButtonSize, string> = {
    sm: 'min-h-9 px-3.5 text-[12px]',
    md: 'min-h-11 px-4 text-[13px]',
    lg: 'min-h-12 px-5 text-[15px]',
  };
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-white hover:bg-accent-dark shadow-[0_2px_8px_rgba(23,128,90,0.25)]',
    secondary: 'border-[1.5px] border-accent text-accent hover:bg-accent-soft',
    ghost: 'text-muted hover:bg-muted-bg border border-transparent',
    danger: 'bg-white text-danger border border-[#e0b4ad] hover:bg-danger-soft',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {icon != null && <span className="text-[1.05em]">{icon}</span>}
      {children}
    </button>
  );
}

export function TextField({
  label,
  className = '',
  type,
  ...rest
}: { label?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (revealed ? 'text' : 'password') : type;

  return (
    <label className="flex flex-col gap-1.5 text-left">
      {label && <span className="text-[12px] font-extrabold text-muted">{label}</span>}
      <div className="relative flex">
        <input
          type={effectiveType}
          className={`min-h-11 px-3 w-full rounded-[var(--radius-control)] border border-border bg-white text-[15px] font-semibold text-ink placeholder:text-faint placeholder:font-medium ${isPassword ? 'pr-10' : ''} ${className}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            title={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-muted-bg cursor-pointer"
          >
            {revealed ? <EyeOff /> : <Eye />}
          </button>
        )}
      </div>
    </label>
  );
}

function Eye() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

export function TextArea({
  label,
  className = '',
  ...rest
}: { label?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      {label && <span className="text-[12px] font-extrabold text-muted">{label}</span>}
      <textarea
        className={`min-h-20 px-3 py-2.5 rounded-[var(--radius-control)] border border-border bg-white text-[15px] font-semibold text-ink placeholder:text-faint placeholder:font-medium resize-y ${className}`}
        {...rest}
      />
    </label>
  );
}

export function Select({
  label,
  className = '',
  children,
  ...rest
}: { label?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      {label && <span className="text-[12px] font-extrabold text-muted">{label}</span>}
      <select
        className={`min-h-11 px-3 rounded-[var(--radius-control)] border border-border bg-white text-[15px] font-semibold text-ink ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

export function Chip({
  children,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  tone?: 'default' | 'accent' | 'amber' | 'danger';
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: 'bg-chip-bg text-muted',
    accent: 'bg-accent-soft text-accent',
    amber: 'bg-[#f7ecdc] text-[#7a4e12]',
    danger: 'bg-danger-soft text-danger',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-extrabold whitespace-nowrap ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 cursor-pointer"
      aria-pressed={checked}
    >
      <span
        className="relative w-9 h-5 rounded-full transition-colors flex-none"
        style={{ background: checked ? 'var(--color-accent)' : '#d8dbd6' }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: checked ? '18px' : '2px' }}
        />
      </span>
      {label && <span className="text-[12px] font-bold">{label}</span>}
    </button>
  );
}

/**
 * Circle checkbox (spec §1.4): 30px, 2.5px #cfd4cf border; done = filled accent
 * with a white check. `onClick` receives the event so callers can stopPropagation
 * when the checkbox sits inside a tappable row.
 */
export function CircleCheckbox({
  checked,
  onClick,
  size = 30,
  className = '',
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onClick?: (e: React.MouseEvent) => void;
  size?: number;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      onClick={onClick}
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`flex-none grid place-items-center rounded-full cursor-pointer transition-colors ${className}`}
      style={{
        width: size,
        height: size,
        border: checked ? 'none' : '2.5px solid #cfd4cf',
        background: checked ? 'var(--color-accent)' : 'transparent',
        color: '#fff',
      }}
    >
      {checked && <CheckIcon size={Math.round(size * 0.62)} strokeWidth={2.6} />}
    </button>
  );
}

/**
 * Collar-ring identity (spec §5.2): white circle with a ring in the puppy's
 * collar colour + initial letter. Shared across weigh-in, Puppies, whelping,
 * and the desktop Home strip.
 */
/**
 * collar_color is free text ("mint", "RED", "raudona"). Used raw as a CSS colour
 * it silently renders no ring. Validate and fall back to a neutral grey.
 */
export function safeColor(c?: string | null, fallback = '#cfd4cf'): string {
  if (!c) return fallback;
  try {
    if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', c.trim())) return c.trim();
  } catch {
    /* CSS.supports unavailable — fall through */
  }
  return fallback;
}

export function CollarAvatar({
  name,
  collar,
  size = 34,
  ring,
  className = '',
}: {
  name: string;
  collar?: string | null;
  size?: number;
  ring?: number;
  className?: string;
}) {
  const initial = (name?.trim()?.[0] || '?').toUpperCase();
  const ringColor = safeColor(collar);
  const r = ring ?? Math.max(3, Math.round(size * 0.11));
  return (
    <div
      aria-hidden="true"
      className={`flex-none rounded-full grid place-items-center font-extrabold text-ink bg-white ${className}`}
      style={{ width: size, height: size, boxShadow: `inset 0 0 0 ${r}px ${ringColor}`, fontSize: Math.round(size * 0.4) }}
    >
      {initial}
    </div>
  );
}

export function Avatar({ name, color, size = 33 }: { name: string; color: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <div
      className="flex-none rounded-full text-white font-extrabold flex items-center justify-center"
      style={{ width: size, height: size, background: color, fontSize: size * 0.34 }}
    >
      {initials}
    </div>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-[5px] rounded-full bg-[#eef0ec] overflow-hidden">
      <div className="h-full bg-accent rounded-full transition-[width]" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, subtitle, action }: { icon?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-16 px-6">
      {icon && <div className="text-4xl opacity-60">{icon}</div>}
      <div className="text-[15px] font-extrabold">{title}</div>
      {subtitle && <div className="text-[12.5px] text-muted font-semibold max-w-xs">{subtitle}</div>}
      {action}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-[3px] bg-chip-bg rounded-[11px] p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 text-center py-2 px-1 rounded-[9px] text-[12px] font-extrabold cursor-pointer transition-colors ${
            value === o.value ? 'bg-white text-ink shadow-sm' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, subtitle, children, footer }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Modal a11y: focus the panel on open, trap Tab within it, Escape closes,
  // and focus returns to the opener on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const f = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!f.length) return;
        const a = f[0];
        const b = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative bg-card w-full sm:max-w-lg sm:rounded-[18px] rounded-t-[18px] max-h-[92vh] flex flex-col shadow-2xl focus:outline-none"
      >
        <div className="flex-none flex items-start justify-between px-5 pt-5 pb-3 border-b border-border-soft">
          <div>
            <h2 id={titleId} className="text-[15.5px] font-extrabold">{title}</h2>
            {subtitle && <div className="text-[11px] text-faint font-semibold mt-0.5">{subtitle}</div>}
          </div>
          <button aria-label="Close" onClick={onClose} className="w-8 h-8 flex-none rounded-full grid place-items-center text-muted hover:bg-muted-bg cursor-pointer">
            <XIcon size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex-none px-5 py-4 border-t border-border-soft flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-spin rounded-full border-2 border-border border-t-accent w-5 h-5 ${className}`} />
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] font-extrabold truncate">{title}</h1>
        {subtitle && <div className="text-[12.5px] text-faint font-semibold truncate">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
