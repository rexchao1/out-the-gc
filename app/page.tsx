export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
      <section className="w-full rounded-3xl border border-black/5 bg-white/80 p-10 shadow-sm backdrop-blur sm:p-14">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Out of the GC</p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
          Plan a group trip without the planning chaos.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">
          Turn one idea into a clear plan everyone can align on. We will build the trip flow next.
        </p>
        <button
          type="button"
          className="mt-9 inline-flex items-center rounded-xl bg-[var(--accent)] px-6 py-3 text-base font-semibold text-[var(--accent-foreground)] transition hover:opacity-90"
        >
          Plan a Trip
        </button>
      </section>
    </main>
  );
}
