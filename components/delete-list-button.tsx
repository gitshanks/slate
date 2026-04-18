"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteList } from "@/lib/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DeleteListButtonProps {
  listId: string;
  listName: string;
  /** Render as a small icon-only button (for list cards) */
  iconOnly?: boolean;
  className?: string;
}

export function DeleteListButton({
  listId,
  listName,
  iconOnly = false,
  className,
}: DeleteListButtonProps) {
  const [pending, start] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete list "${listName}"? This cannot be undone.`)) return;
    start(async () => {
      try {
        await deleteList(listId);
        // deleteList() redirects to /lists on success
      } catch (err) {
        // Re-throw the Next.js redirect signal so it completes normally
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          typeof (err as { digest: unknown }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        toast.error(err instanceof Error ? err.message : "Failed to delete list");
      }
    });
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        aria-label={`Delete ${listName}`}
        onClick={onClick}
        disabled={pending}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full",
          "bg-background/80 backdrop-blur-sm border border-border",
          "text-muted-foreground transition-colors",
          "hover:text-destructive hover:border-destructive/40",
          "disabled:opacity-50 disabled:pointer-events-none",
          className
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Delete list
    </button>
  );
}
