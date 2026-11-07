"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateListDetails } from "@/lib/actions";
import { cn } from "@/lib/utils";

const NAME_MAX = 80;
const DESCRIPTION_MAX = 280;

/**
 * The top of a list: its name and description, who it's shared with, and what you can do
 * with it. On a phone the actions sit in a row under the title so the name keeps the full
 * width; from `sm` up they move to the right. The owner can edit the name and description
 * in place.
 */
export function ListHeader({
  listId,
  name,
  description,
  canEdit,
  people,
  actions,
  trailing,
}: {
  listId: string;
  name: string;
  description: string | null;
  canEdit: boolean;
  people?: React.ReactNode;
  actions: React.ReactNode;
  /** Goes after Edit, so the destructive action sits last. */
  trailing?: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draftName, setDraftName] = React.useState(name);
  const [draftDescription, setDraftDescription] = React.useState(description ?? "");
  // What's on screen while a save is in flight, so the page doesn't flash back.
  const [shown, setShown] = React.useState({ name, description: description ?? "" });
  const [pending, start] = React.useTransition();
  const nameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setShown({ name, description: description ?? "" }), [name, description]);
  React.useEffect(() => {
    if (editing) nameRef.current?.select();
  }, [editing]);

  function open() {
    setDraftName(shown.name);
    setDraftDescription(shown.description);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function save(event?: React.FormEvent) {
    event?.preventDefault();
    const nextName = draftName.trim();
    const nextDescription = draftDescription.trim();
    if (!nextName) {
      toast.error("A list needs a name.");
      nameRef.current?.focus();
      return;
    }
    if (nextName === shown.name && nextDescription === shown.description) {
      setEditing(false);
      return;
    }
    const before = shown;
    setShown({ name: nextName, description: nextDescription });
    setEditing(false);
    start(async () => {
      try {
        await updateListDetails(listId, nextName, nextDescription);
        router.refresh();
      } catch (error) {
        setShown(before);
        toast.error(error instanceof Error ? error.message : "That didn't save. Try again.");
      }
    });
  }

  return (
    <header className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={save} className="space-y-3" onKeyDown={(event) => event.key === "Escape" && cancel()}>
            <label className="block">
              <span className="sr-only">List name</span>
              <input
                ref={nameRef}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={NAME_MAX}
                required
                className="w-full min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-3xl font-semibold tracking-tight outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 sm:text-4xl"
              />
            </label>
            <label className="block">
              <span className="sr-only">Description</span>
              <textarea
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                maxLength={DESCRIPTION_MAX}
                rows={2}
                placeholder="Add a description (optional)"
                className="w-full min-w-0 resize-none rounded-xl border border-border bg-card px-3 py-2 text-base text-muted-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/60 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!draftName.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-[opacity,transform] duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Save
              </button>
              <button
                type="button"
                onClick={cancel}
                className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Cancel
              </button>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums" aria-live="polite">
                {draftDescription.length > DESCRIPTION_MAX - 40 ? `${DESCRIPTION_MAX - draftDescription.length} left` : null}
              </span>
            </div>
          </form>
        ) : (
          <>
            <h1
              className={cn(
                "min-w-0 text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl",
                pending && "opacity-70",
              )}
            >
              {shown.name}
            </h1>
            {shown.description ? (
              <p className="mt-2 max-w-2xl text-muted-foreground [overflow-wrap:anywhere]">{shown.description}</p>
            ) : canEdit ? (
              <button
                type="button"
                onClick={open}
                className="mt-2 rounded text-sm text-muted-foreground/70 transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Add a description
              </button>
            ) : null}
            {people}
          </>
        )}
      </div>

      {/* Out of the way while editing, so Save and Cancel are the only choices. */}
      <div className={cn("flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end", editing && "hidden")}>
        {actions}
        {canEdit ? (
          <button
            type="button"
            onClick={open}
            aria-label={`Edit ${shown.name}`}
            title="Edit name and description"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/85 text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {trailing}
      </div>
    </header>
  );
}
