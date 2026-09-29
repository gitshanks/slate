"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteList } from "@/lib/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { captureAnalytics } from "@/lib/analytics";

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
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete list "${listName}"? This cannot be undone.`)) return;
    start(async () => {
      try {
        await deleteList(listId);
        captureAnalytics("list_deleted", {
          source: iconOnly ? "list_card" : "list_page",
        });
        router.push("/lists");
        router.refresh();
      } catch (err) {
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
