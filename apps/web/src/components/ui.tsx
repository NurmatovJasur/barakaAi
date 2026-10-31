import clsx from 'clsx';
import { AlertTriangle, Inbox, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { DataQualityStatus, FreshnessLevel, VerificationStatus } from '@smp/shared';
import { errorMessage } from '../services/api';

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('rounded-xl border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        variant === 'primary' && 'bg-primary text-white',
        variant === 'secondary' && 'border border-line bg-surface text-ink',
        variant === 'ghost' && 'text-primary',
        variant === 'danger' && 'bg-danger-soft text-danger',
        className,
      )}
    >
      {loading && <RefreshCw className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
        tone === 'neutral' && 'bg-surface-2 text-muted',
        tone === 'primary' && 'bg-primary-soft text-primary',
        tone === 'success' && 'bg-success-soft text-success',
        tone === 'warning' && 'bg-warning-soft text-warning',
        tone === 'danger' && 'bg-danger-soft text-danger',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warning" className={className}>
      DEMO DATA
    </Badge>
  );
}

const FRESH: Record<FreshnessLevel, { tone: Tone; label: string }> = {
  FRESH: { tone: 'success', label: 'Актуально' },
  ATTENTION: { tone: 'warning', label: 'Проверьте' },
  STALE: { tone: 'danger', label: 'Устарело' },
};
export const FreshnessBadge = ({ level }: { level: FreshnessLevel }) => (
  <Badge tone={FRESH[level].tone}>{FRESH[level].label}</Badge>
);

export function QualityBadge({ status }: { status: DataQualityStatus }) {
  if (status === 'VALID') return null;
  const map = { WARNING: ['warning', 'Подозрительно'], INVALID: ['danger', 'Ошибка данных'], EXPIRED: ['danger', 'Истекло'] } as const;
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const VERIF: Record<VerificationStatus, { tone: Tone; label: string }> = {
  UNVERIFIED: { tone: 'neutral', label: 'Не проверен' },
  PENDING: { tone: 'warning', label: 'На проверке' },
  VERIFIED: { tone: 'success', label: 'Проверен' },
  REJECTED: { tone: 'danger', label: 'Отклонён' },
};
export const VerificationBadge = ({ status }: { status: VerificationStatus }) => (
  <Badge tone={VERIF[status].tone}>
    {status !== 'VERIFIED' && <ShieldAlert className="size-3" />}
    {VERIF[status].label}
  </Badge>
);

export const Skeleton = ({ className }: { className?: string }) => <div className={clsx('skeleton', className)} />;

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="size-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon ?? <Inbox className="size-6" />}
      </div>
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-6" />
      </div>
      <p className="font-semibold">Не удалось загрузить данные</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          <RefreshCw className="size-4" /> Повторить
        </Button>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmText = 'Подтвердить',
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  text?: ReactNode;
  confirmText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+var(--safe-bottom))] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button aria-label="Закрыть" onClick={onClose} className="text-muted">
            <X className="size-5" />
          </button>
        </div>
        {text && <div className="mt-2 text-sm text-muted">{text}</div>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className="tabular mt-1 text-lg font-semibold leading-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </Card>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={clsx('flex rounded-lg bg-surface-2 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition',
            o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
