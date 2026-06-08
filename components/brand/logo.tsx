import { cn } from "@/lib/utils";

/**
 * Brand mark — a stylized "transcript → task" glyph.
 * Monochrome, scales with `currentColor`. No gradients.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-6", className)}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" className="fill-foreground" />
      <path
        d="M7.5 9.25h6M7.5 12.25h9M7.5 15.25h4"
        stroke="oklch(var(--background))"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14.6 15.1l1.5 1.5 2.6-2.9"
        stroke="oklch(var(--background))"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  withWordmark = true,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {withWordmark && (
        <span className="text-[15px] font-semibold tracking-tight">
          After<span className="text-muted-foreground">meet</span>
        </span>
      )}
    </span>
  );
}
