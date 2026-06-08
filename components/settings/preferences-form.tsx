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
  ["mom", "Meeting Minutes"],
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
    <div className="space-y-6">
      <div>
        <Label className="text-sm">AI priority</Label>
        <p className="mb-3 text-xs text-muted-foreground">What the engine emphasizes per meeting.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {priorities.map(([v, label]) => (
            <Chip key={v} active={priority === v} onClick={() => setPriority(v)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm">Follow-up email tone</Label>
        <p className="mb-3 text-xs text-muted-foreground">How drafted emails sound.</p>
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
        Save preferences
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
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm transition-all",
        active ? "border-foreground bg-secondary font-medium" : "border-border hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
