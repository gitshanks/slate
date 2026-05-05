"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeTitle } from "@/lib/actions";
import { APP_ROOT } from "@/lib/public-mode";
import { toast } from "sonner";

export function RemoveButton({
  titleId,
  titleName,
  iconOnly = false,
}: {
  titleId: string;
  titleName: string;
  iconOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function onClick() {
    if (!confirm(`Remove "${titleName}" from your library?`)) return;
    start(async () => {
      try {
        await removeTitle(titleId);
        toast.success("Removed");
        router.push(APP_ROOT);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        aria-label="Remove from library"
        onClick={onClick}
        disabled={pending}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
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
