'use client';

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton-shimmer rounded-md ${className}`} />;
}

export default function DashboardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <section role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Loading dashboard section</span>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="skeleton-surface rounded-2xl border p-5">
              <SkeletonBar className="h-3 w-28" />
              <SkeletonBar className="mt-4 h-8 w-20" />
              <SkeletonBar className="mt-3 h-3 w-3/4" />
            </div>
          ))}
        </div>
        <div className="skeleton-surface rounded-2xl border p-5">
          <SkeletonBar className="h-4 w-52" />
          <SkeletonBar className="mt-5 h-32 w-full rounded-xl" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2].map((item) => <SkeletonBar key={item} className="h-3 w-full" />)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="app-shell min-h-screen" role="status" aria-busy="true">
      <span className="sr-only">Loading your Carrybee Lead Bank dashboard</span>
      <header className="skeleton-surface border-b px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <SkeletonBar className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <SkeletonBar className="h-4 w-44 max-w-full" />
              <SkeletonBar className="h-3 w-64 max-w-full" />
            </div>
            <SkeletonBar className="h-8 w-20 rounded-full" />
            <SkeletonBar className="h-8 w-24 rounded-lg" />
          </div>
          <nav aria-hidden="true" className="mt-5 flex flex-wrap gap-2">
            <SkeletonBar className="h-10 w-36 rounded-xl" />
            <SkeletonBar className="h-10 w-48 rounded-xl" />
            <SkeletonBar className="h-10 w-40 rounded-xl" />
            <SkeletonBar className="h-10 w-36 rounded-xl" />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="skeleton-surface rounded-2xl border p-5">
              <div className="flex items-center justify-between">
                <SkeletonBar className="h-3 w-28" />
                <SkeletonBar className="h-8 w-8 rounded-full" />
              </div>
              <SkeletonBar className="mt-5 h-8 w-24" />
              <SkeletonBar className="mt-3 h-3 w-40 max-w-full" />
            </div>
          ))}
        </div>

        <section className="skeleton-surface rounded-2xl border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <SkeletonBar className="h-4 w-56 max-w-full" />
              <SkeletonBar className="h-3 w-72 max-w-full" />
            </div>
            <SkeletonBar className="h-3 w-40" />
          </div>
          <SkeletonBar className="mt-6 h-3 w-full rounded-full" />
          <div className="mt-4 flex gap-5">
            <SkeletonBar className="h-3 w-24" />
            <SkeletonBar className="h-3 w-32" />
            <SkeletonBar className="h-3 w-24" />
          </div>
        </section>

        <section className="skeleton-surface rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <SkeletonBar className="h-4 w-48" />
            <SkeletonBar className="h-8 w-28 rounded-lg" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="skeleton-surface rounded-xl border p-4">
                <SkeletonBar className="h-3 w-2/3" />
                <SkeletonBar className="mt-3 h-3 w-full" />
                <SkeletonBar className="mt-2 h-3 w-4/5" />
                <SkeletonBar className="mt-4 h-7 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
