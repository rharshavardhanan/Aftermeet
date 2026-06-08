"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradeButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  function upgrade() {
    start(async () => {
      try {
        const res = await fetch("/api/stripe/checkout", { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not start checkout");
        window.location.href = json.url;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Checkout failed");
      }
    });
  }
  return (
    <Button className="w-full" onClick={upgrade} disabled={pending || disabled}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      Upgrade to Pro
    </Button>
  );
}
