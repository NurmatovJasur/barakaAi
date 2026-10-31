import clsx from 'clsx';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useToasts } from '../stores/toast';

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+var(--content-top)+8px)] z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={clsx(
            'pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-white shadow-lg',
            t.kind === 'success' && 'bg-[#166534]',
            t.kind === 'error' && 'bg-[#991b1b]',
            t.kind === 'info' && 'bg-[#1e3a8a]',
          )}
        >
          {t.kind === 'success' && <CheckCircle2 className="size-4 shrink-0" />}
          {t.kind === 'error' && <XCircle className="size-4 shrink-0" />}
          {t.kind === 'info' && <Info className="size-4 shrink-0" />}
          {t.text}
        </button>
      ))}
    </div>
  );
}
