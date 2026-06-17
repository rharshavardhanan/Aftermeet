import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="container max-w-6xl space-y-8 py-8 animate-fade-in">
      {/* header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2.5">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* stat ledger */}
      <div className="liquid-glass grid grid-cols-2 overflow-hidden rounded-2xl sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 p-5 [&:nth-child(2n)]:border-l [&:nth-child(2n)]:border-border/70 [&:nth-child(n+3)]:border-t [&:nth-child(n+3)]:border-border/70 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:border-border/70 sm:[&:nth-child(n+3)]:border-t-0"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="liquid-glass space-y-3 rounded-2xl p-5 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] rounded-lg" />
          ))}
        </div>
        <div className="space-y-6">
          <div className="liquid-glass space-y-3 rounded-2xl p-5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="liquid-glass space-y-3 rounded-2xl p-5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>

      {/* recent meetings */}
      <div className="liquid-glass space-y-3 rounded-2xl p-5">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
