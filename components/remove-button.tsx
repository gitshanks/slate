"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeTitle } from "@/lib/actions";
import { toast } from "sonner";

export function RemoveButton({
  titleId,
  titleName,
}: {
  titleId: string;
  titleName: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function onClick() {
    if (!confirm(`Remove "${titleName}" from your library?`)) return;
    start(async () => {
      try {
        await removeTitle(titleId);
        toast.success("Removed");
        router.push("/");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
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
      Remove
    </Button>
  );
}
