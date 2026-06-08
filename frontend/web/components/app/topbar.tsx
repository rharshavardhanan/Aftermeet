"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Search, Mic, Chrome, LogOut, Settings, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogoMark } from "@/components/brand/logo";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";

export function Topbar({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const connected = useExtensionStatus();

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/history?q=${encodeURIComponent(q)}` : "/history");
  }

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        {/* Mobile brand mark — no sidebar on mobile, so identity lives here. */}
        <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
          <LogoMark className="size-7" />
          <span className="text-[15px] font-semibold tracking-tight">
            After<span className="text-muted-foreground">meet</span>
          </span>
        </Link>

        <form onSubmit={onSearch} className="relative hidden max-w-sm flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search meetings…"
            className="h-9 pl-9"
            aria-label="Search meetings"
            type="search"
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant="muted"
            className={cn(
              "hidden gap-1.5 py-1 sm:inline-flex",
              connected && "border-success/30 bg-success/10 text-success",
            )}
          >
            <Chrome className="size-3.5" /> Extension: {connected ? "connected" : "not connected"}
          </Badge>
          <Button asChild size="sm" variant="outline" className="hidden gap-1.5 sm:inline-flex">
            <Link href="/workspace?record=1">
              <Mic className="size-4" /> Record
            </Link>
          </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring/40">
              <Avatar className="size-8 border border-border">
                {user.image && <AvatarImage src={user.image} alt={user.name ?? "User"} />}
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{user.name ?? "Account"}</span>
              <span className="truncate text-xs">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings"><UserIcon /> Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings"><Settings /> Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

/** Polls the backend so the badge reflects a live extension capture session. */
function useExtensionStatus() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/extension/session", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { connected?: boolean };
        if (alive) setConnected(!!json.connected);
      } catch {
        /* offline / not signed in — leave as not connected */
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return connected;
}
