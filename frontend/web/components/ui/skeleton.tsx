import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/70 skeleton-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
