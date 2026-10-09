import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';

/** Skeleton shown during route navigation to a tour detail page. */
export default function ServiceDetailLoading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Back link placeholder */}
        <div className="h-5 w-28 animate-pulse rounded bg-surface-3" />

        {/* Hero skeleton */}
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface-1">
          <div className="relative h-72 w-full animate-pulse bg-surface-2 sm:h-96">
            <div className="absolute inset-0 bg-gradient-to-br from-surface-2 to-surface-1" />
            <div className="absolute left-4 top-4 h-7 w-20 animate-pulse rounded-full bg-surface-3/70" />
            <div className="absolute bottom-4 right-4 h-9 w-28 animate-pulse rounded-xl bg-surface-3/70" />
          </div>
        </div>

        {/* Title + meta skeleton */}
        <div className="space-y-3">
          <div className="h-7 w-3/4 animate-pulse rounded bg-surface-3" />
          <div className="flex gap-4">
            <div className="h-4 w-32 animate-pulse rounded bg-surface-3" />
            <div className="h-4 w-24 animate-pulse rounded bg-surface-3" />
            <div className="h-4 w-28 animate-pulse rounded bg-surface-3" />
          </div>
        </div>

        {/* Description skeleton */}
        <Card className="p-5 sm:p-6">
          <div className="mb-3 h-5 w-32 animate-pulse rounded bg-surface-3" />
          <div className="space-y-2">
            <div className="h-3.5 w-full animate-pulse rounded bg-surface-3" />
            <div className="h-3.5 w-full animate-pulse rounded bg-surface-3" />
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-surface-3" />
          </div>
        </Card>

        {/* Guide skeleton */}
        <Card className="flex items-center gap-4 p-5">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-surface-3" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-surface-3" />
            <div className="h-4 w-32 animate-pulse rounded bg-surface-3" />
          </div>
        </Card>

        {/* Booking skeleton */}
        <Card className="p-5 sm:p-6">
          <div className="mb-4 h-5 w-24 animate-pulse rounded bg-surface-3" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="h-10 animate-pulse rounded-xl bg-surface-3" />
            <div className="h-10 animate-pulse rounded-xl bg-surface-3" />
          </div>
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-surface-3" />
        </Card>
      </div>
    </AppShell>
  );
}