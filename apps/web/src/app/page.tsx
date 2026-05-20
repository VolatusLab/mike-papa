export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 px-6">
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-800">
        Stage 1 — bootstrap
      </span>
      <h1 className="text-4xl font-bold tracking-tight">BNMP Monitor</h1>
      <p className="text-base text-slate-600">
        Plataforma SaaS multi-tenant para monitoramento do portal BNMP (CNJ). Esta tela é um
        placeholder. Auth, dashboard e analytics chegam nas próximas etapas.
      </p>
    </main>
  );
}
