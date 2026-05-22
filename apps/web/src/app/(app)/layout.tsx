import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, email } = await requireUser();
  const isAdmin = user.role === 'ADMIN';
  const isModOrAdmin = user.role === 'ADMIN' || user.role === 'MODERATOR';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold tracking-tight">
              BNMP Monitor
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              <Link href="/dashboard" className="hover:text-slate-900">
                Mandados
              </Link>
              <Link href="/dashboard/telegram" className="hover:text-slate-900">
                Telegram
              </Link>
              {isModOrAdmin ? (
                <Link href="/dashboard/cities" className="hover:text-slate-900">
                  Cidades
                </Link>
              ) : null}
              {isAdmin ? (
                <Link href="/admin" className="hover:text-slate-900">
                  Admin
                </Link>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="hidden sm:inline">{email}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-700">
              {user.role}
            </span>
            <form action="/auth/sign-out" method="post">
              <Button type="submit" variant="ghost" size="sm">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
