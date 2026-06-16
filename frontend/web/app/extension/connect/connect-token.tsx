"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConnectToken() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/token")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("token"))))
      .then((j: { token: string }) => setToken(j.token))
      .catch(() => setError("Couldn't mint a token. Make sure you're signed in, then refresh."));
  }, []);

  async function copy() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="liquid-glass rounded-2xl p-7">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-foreground text-background">
          <Chrome className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Connect the extension</h1>
          <p className="text-xs text-muted-foreground">Copy this token into the Aftermeet popup.</p>
        </div>
      </div>

      {error ? (
        <p className="mt-6 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>
      ) : !token ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Minting a secure token…
        </div>
      ) : (
        <>
          <textarea
            readOnly
            value={token}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-6 h-24 w-full resize-none rounded-lg border border-border bg-card/60 p-3 font-mono text-xs leading-relaxed"
          />
          <Button onClick={copy} className="mt-3 w-full gap-2">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy token"}
          </Button>
          <ol className="mt-5 space-y-1.5 text-xs text-muted-foreground">
            <li>1. Copy the token above.</li>
            <li>2. Open the Aftermeet extension popup.</li>
            <li>3. Paste it into <span className="font-medium text-foreground">Connect token</span> and click Save.</li>
          </ol>
          <p className="mt-4 text-[11px] text-muted-foreground">
            The token is short-lived. If the extension stops working, just reconnect here.
          </p>
        </>
      )}
    </div>
  );
}
