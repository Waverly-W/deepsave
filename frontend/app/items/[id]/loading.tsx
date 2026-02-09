import { Skeleton } from "../../../components/ui/skeleton";

export default function ItemDetailLoading() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-8 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-400/20" />
        <div className="absolute top-40 right-0 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-400/20" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-400/10" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_0_85%,rgba(15,23,42,0.08)_100%)] dark:bg-[linear-gradient(transparent_0_85%,rgba(148,163,184,0.14)_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-9 w-32 rounded-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="rounded-3xl border border-neutral-200/70 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-10 w-2/3" />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-36 rounded-full" />
            </div>
            <div className="mt-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
            </div>
            <div className="mt-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
            </div>
            <div className="mt-6">
              <Skeleton className="h-52 w-full rounded-2xl" />
            </div>
          </article>

          <aside className="flex flex-col gap-4">
            <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
              <Skeleton className="h-3 w-20" />
              <div className="mt-4 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
              <Skeleton className="h-3 w-16" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/70">
              <Skeleton className="h-3 w-16" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
