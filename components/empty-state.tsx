import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-subtle/50 px-6 py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground shadow-subtle">
          <Icon className="size-5" />
        </div>
      )}
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-pretty text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
