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
    <div className="liquid-glass animate-rise rounded-2xl p-7">
      <div className="flex items-center gap-3">
        <span className="glass-pill grid size-10 place-items-center rounded-xl text-ember">
          <Chrome className="size-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight">Connect the extension</h1>
          <p className="text-xs text-muted-foreground">A short-lived token links this account to the extension.</p>
        </div>
      </div>

      {error ? (
        <p className="mt-6 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive">{error}</p>
      ) : !token ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-ember" /> Minting a secure token…
        </div>
      ) : (
        <div className="animate-fade-in-sm">
          <p className="mb-2 mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Your token
          </p>
          <textarea
            readOnly
            value={token}
            onFocus={(e) => e.currentTarget.select()}
            className="h-24 w-full resize-none rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 font-mono text-xs leading-relaxed"
          />
          <Button onClick={copy} className="mt-3 w-full gap-2">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy token"}
          </Button>
          <ol className="mt-6 space-y-3 text-sm">
            {[
              "Copy the token above.",
              "Open the Aftermeet extension popup.",
              <>Paste it into <span className="font-medium text-foreground">Connect token</span> and click Save.</>,
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-muted-foreground">
                <span className="glass-pill mt-px grid size-5 shrink-0 place-items-center rounded-md font-mono text-[11px] tnum text-foreground">
                  {i + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-foreground/[0.06] pt-4 text-xs text-foreground/70">
            The token expires soon. If the extension stops working, reconnect here.
          </p>
        </div>
      )}
    </div>
  );
}
