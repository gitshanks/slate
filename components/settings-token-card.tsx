"use client";

import * as React from "react";
import { Copy, Check, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { rotateImportTokenAction } from "@/lib/settings-actions";

interface SettingsTokenCardProps {
  initialToken: string | null;
}

/**
 * Client card that renders the extension-pairing token with copy +
 * regenerate actions. Token is fetched on the server and handed in as
 * `initialToken`; regenerate calls a server action and swaps in the new
 * value optimistically once it returns.
 *
 * `initialToken === null` means the `app_settings` migration hasn't run
 * yet — we show a one-line setup hint instead of a fake empty card.
 */
export function SettingsTokenCard({ initialToken }: SettingsTokenCardProps) {
  const [token, setToken] = React.useState(initialToken);
  const [pending, startTransition] = React.useTransition();
  const [copied, setCopied] = React.useState(false);

  // Reset "Copied" label ~1.5s after a successful copy. Effect depends only on
  // the boolean — no transient state leaks keep this from being stable.
  React.useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  if (!token) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="text-sm">
            <p className="font-medium">Setup needed</p>
            <p className="mt-1 text-muted-foreground">
              The <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-xs">app_settings</code>{" "}
              table is missing. Apply the migration in{" "}
              <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-xs">
                supabase/schema.sql
              </code>{" "}
              then reload this page to generate an extension token.
            </p>
          </div>
        </div>
      </div>
    );
  }

  function copy() {
    navigator.clipboard
      .writeText(token!)
      .then(() => {
        setCopied(true);
        toast.success("Token copied");
      })
      .catch(() => toast.error("Clipboard unavailable"));
  }

  function rotate() {
    const confirmed = window.confirm(
      "Regenerate the import token? Any paired browser extension will get 401s until you paste the new token."
    );
    if (!confirmed) return;
    startTransition(async () => {
      try {
        const next = await rotateImportTokenAction();
        if (!next) throw new Error("Failed to rotate token");
        setToken(next);
        setCopied(false);
        toast.success("Token regenerated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to rotate");
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
          Import token
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste this into the Slate browser extension popup to pair it with
          this instance. Keep it private — anyone with the token can POST
          titles into your library.
        </p>
      </div>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 truncate rounded-lg border border-border/60 bg-background/60 px-3 py-2 font-mono text-xs">
          {token}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy token"
          className="inline-flex h-auto items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-card/80"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-primary" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={rotate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />
          Regenerate
        </button>
      </div>
    </div>
  );
}
