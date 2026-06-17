"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { updatePreferences } from "@/app/actions/settings";

const priorities = [
  ["tasks", "Action items"],
  ["summaries", "Summaries"],
  ["followups", "Follow-up emails"],
  ["mom", "Meeting minutes"],
] as const;

const tones = [
  ["professional", "Professional"],
  ["friendly", "Friendly"],
  ["concise", "Concise"],
] as const;

export function PreferencesForm({
  initialPriority,
  initialTone,
}: {
  initialPriority: string | null;
  initialTone: string;
}) {
  const [priority, setPriority] = useState(initialPriority ?? "tasks");
  const [tone, setTone] = useState(initialTone);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updatePreferences({
        priority: priority as "tasks",
        emailTone: tone as "professional",
      });
      res.ok ? toast.success("Preferences saved.") : toast.error(res.error);
    });
  }

  return (
    <div className="space-y-7">
      <div>
        <Label className="text-sm font-medium">What to emphasize</Label>
        <p className="mb-3 text-xs text-muted-foreground">The engine leads with this in every meeting record.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {priorities.map(([v, label]) => (
            <Chip key={v} active={priority === v} onClick={() => setPriority(v)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Follow-up email tone</Label>
        <p className="mb-3 text-xs text-muted-foreground">How your drafted recaps read.</p>
        <div className="grid grid-cols-3 gap-2">
          {tones.map(([v, label]) => (
            <Chip key={v} active={tone === v} onClick={() => setTone(v)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <Button onClick={save} disabled={pending} size="sm">
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl px-3 py-2 text-[13px] transition-all duration-300 ease-ios",
        active
          ? "glass-pill font-medium text-ember ring-1 ring-ember/30"
          : "border border-foreground/10 text-foreground/80 hover:border-foreground/20 hover:bg-foreground/[0.03]",
      )}
    >
      {children}
    </button>
  );
}
