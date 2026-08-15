"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionRow } from "@/components/action-row";
import { cn } from "@/lib/utils";
import { removeTitle } from "@/lib/actions";
import { APP_ROOT } from "@/lib/public-mode";
import { toast } from "sonner";

export function RemoveButton({
  titleId,
  titleName,
  iconOnly = false,
  variant,
  className,
  redirectOnRemove = true,
  onRemoved,
}: {
  titleId: string;
  titleName: string;
  iconOnly?: boolean;
  /** "row" renders a full-width destructive menu row (mobile More sheet). */
  variant?: "row";
  className?: string;
  /** Keep an in-place inspector open long enough to close cleanly. */
  redirectOnRemove?: boolean;
  onRemoved?: () => void;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function onClick() {
    if (!confirm(`Remove "${titleName}" from your library?`)) return;
    start(async () => {
      try {
        await removeTitle(titleId);
        toast.success("Removed");
        onRemoved?.();
        if (redirectOnRemove) router.push(APP_ROOT);
        else router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  if (variant === "row") {
    return (
      <ActionRow
        icon={<Trash2 className="h-[18px] w-[18px]" />}
        label="Remove from library"
        destructive
        trailing={null}
        onClick={onClick}
        disabled={pending}
      />
    );
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        aria-label="Remove from library"
        onClick={onClick}
        disabled={pending}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50",
          className,
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      loading={pending}
      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
    >
      Remove
    </Button>
  );
}
