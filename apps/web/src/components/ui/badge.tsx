import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-800',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Map a raw BNMP status string to a badge tone. */
export function statusTone(raw: string): Tone {
  const s = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (s.includes('pendente')) return 'warning';
  if (s.includes('cumprid')) return 'success';
  if (s.includes('revogad')) return 'danger';
  if (s.includes('baixad') || s.includes('suspens')) return 'info';
  return 'neutral';
}
