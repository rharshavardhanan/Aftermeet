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

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo withWordmark={false} className="mb-6" />
      <h1 className="text-2xl font-semibold tracking-tight">Something went sideways.</h1>
      <p className="mt-2 max-w-sm text-pretty text-sm text-muted-foreground">
        We hit an unexpected error. Your data is safe — try again, and if it persists, give it a moment.
      </p>
      <Button className="mt-6" onClick={reset}>
        <RotateCw className="size-4" /> Try again
      </Button>
    </div>
  );
}
