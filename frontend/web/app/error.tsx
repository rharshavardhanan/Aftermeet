"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const detail = error?.message && !error.message.startsWith("An error occurred")
    ? error.message
    : null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo withWordmark={false} className="mb-6" />
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong.</h1>
      <p className="mt-2 max-w-sm text-pretty text-sm text-muted-foreground">
        {detail ?? "An unexpected error occurred. Your data is safe — try again, and if it persists, give it a moment."}
      </p>
      {error?.digest && (
        <p className="mt-1 font-mono text-xs text-muted-foreground/60">{error.digest}</p>
      )}
      <Button className="mt-6" onClick={reset}>
        <RotateCw className="size-4" /> Try again
      </Button>
    </div>
  );
}
