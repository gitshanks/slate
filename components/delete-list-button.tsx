"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteList } from "@/lib/actions";
import { toast } from "sonner";

export function DeleteListButton({
  listId,
  listName,
}: {
  listId: string;
  listName: string;
}) {
  const [pending, start] = useTransition();

  function onClick() {
    if (!confirm(`Delete list "${listName}"? This cannot be undone.`)) return;
    start(async () => {
      try {
        await deleteList(listId);
        // deleteList() redirects to /lists on success
      } catch (e) {
        // Re-throw the Next.js redirect signal so it completes normally
        if (
          e &&
          typeof e === "object" &&
          "digest" in e &&
          typeof (e as { digest: unknown }).digest === "string" &&
          (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw e;
        }
        toast.error(e instanceof Error ? e.message : "Failed to delete list");
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      loading={pending}
      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
    >
      Delete list
    </Button>
  );
}
