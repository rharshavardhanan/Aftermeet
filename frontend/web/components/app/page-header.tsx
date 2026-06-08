import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        {/* iOS large-title feel on mobile; refined size on desktop. */}
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-xl sm:font-semibold sm:tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[15px] text-muted-foreground sm:text-sm">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
