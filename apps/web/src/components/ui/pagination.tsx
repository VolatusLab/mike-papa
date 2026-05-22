import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  /** zero-based current page */
  page: number;
  pageSize: number;
  total: number;
  /** builds the href for a given zero-based page */
  hrefFor: (page: number) => string;
}

export function Pagination({ page, pageSize, total, hrefFor }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  const linkCls = 'rounded-md border border-slate-300 px-3 py-1.5 text-sm';
  const disabledCls = 'cursor-not-allowed border-slate-200 text-slate-300';
  const activeCls = 'text-slate-700 hover:bg-slate-50';

  return (
    <div className="flex items-center justify-between text-sm text-slate-500">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link href={hrefFor(page - 1)} className={cn(linkCls, activeCls)}>
            Anterior
          </Link>
        ) : (
          <span className={cn(linkCls, disabledCls)}>Anterior</span>
        )}
        <span className="tabular-nums">
          {page + 1} / {totalPages}
        </span>
        {hasNext ? (
          <Link href={hrefFor(page + 1)} className={cn(linkCls, activeCls)}>
            Próxima
          </Link>
        ) : (
          <span className={cn(linkCls, disabledCls)}>Próxima</span>
        )}
      </div>
    </div>
  );
}
