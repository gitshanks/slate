"use client";

import { useActionState, useEffect, useState } from "react";
import { deleteAccount } from "@/lib/account-actions";
import { resetAnalyticsIdentity } from "@/lib/analytics";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

export function DeleteAccountSettings() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState(deleteAccount, { ok: false, message: "" });

  useEffect(() => {
    if (!state.ok) return;
    try {
      resetAnalyticsIdentity();
      // Clear only Slate's per-account browser data, preserving consent/settings.
      for (const storage of [window.localStorage, window.sessionStorage]) {
        for (const key of Object.keys(storage)) {
          if (key.startsWith("slate:preview") || key.startsWith("slate:analytics-session:")) {
            storage.removeItem(key);
          }
        }
      }
      document.cookie = "slate_preview_recent_v1=; Max-Age=0; Path=/; SameSite=Lax";
    } finally {
      // Restricted browser storage must not leave a deleted account on screen.
      window.location.replace("/");
    }
  }, [state.ok]);

  return (
    <section className="mt-5 flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-card/45 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h2 className="text-sm font-medium">Delete account</h2>
        <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
          Permanently remove your profile, library, and lists you own.
        </p>
      </div>
      <Dialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); setConfirmation(""); } }}>
        <DialogTrigger asChild>
          <button type="button" className="shrink-0 rounded-full border border-destructive/30 px-4 py-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10">
            Delete account
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-md" onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }} onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}>
          <DialogTitle className="pr-5 leading-snug">Delete your Slate account?</DialogTitle>
          <DialogDescription className="leading-6">
            This permanently deletes your profile, saved titles, ratings, notes, and preview preferences.
            Lists you own will be deleted for everyone. You will leave lists owned by others.
            You will be signed out on every device.
          </DialogDescription>
          <p className="text-xs leading-5 text-muted-foreground">This cannot be undone. You can sign up again with the same email or Google account and start fresh.</p>
          <form action={action} className="space-y-4" data-analytics-private>
            <label className="block text-sm">
              Type <strong className="font-mono">DELETE</strong> to confirm
              <input name="confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
                disabled={pending} autoComplete="off" spellCheck={false} autoCapitalize="characters"
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            {state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setOpen(false)} className="rounded-full border border-border px-4 py-2.5 text-xs font-medium">Keep my account</button>
              <button type="submit" disabled={pending || confirmation !== "DELETE"}
                className="rounded-full bg-destructive px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                {pending ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
