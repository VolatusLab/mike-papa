import { cn } from '@/lib/utils';

export interface StatProps {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}

export function Stat({ label, value, hint, className }: StatProps) {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-4', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
}

/** Lightweight horizontal bar list — no chart library. */
export function BarList({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">Sem dados.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-44 shrink-0 truncate text-sm text-slate-600" title={item.label}>
            {item.label}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full rounded bg-slate-700"
              style={{ width: `${Math.round((item.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm tabular-nums text-slate-700">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
