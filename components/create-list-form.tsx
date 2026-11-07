"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createList } from "@/lib/actions";
import { toast } from "sonner";
import { captureAnalytics } from "@/lib/analytics";

/**
 * "New list" trigger + popover form. The trigger is the only piece visible
 * in the page header; click it and a small form pops out anchored to the
 * button (align=end so it grows leftward, max-w-[calc(100vw-2rem)] so it
 * never overflows on narrow phones). Closes itself on a successful submit.
 */
export function CreateListForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [name, setName] = React.useState("");

  function handleSubmit(fd: FormData) {
    start(async () => {
      try {
        const hasDescription = Boolean(String(fd.get("description") ?? "").trim());
        const { slug } = await createList(fd);
        captureAnalytics("list_created", {
          source: "lists_page",
          has_description: hasDescription,
        });
        setOpen(false);
        setName("");
        // Straight into adding titles, with the search open.
        router.push(`/lists/${slug}?add=1`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The list couldn't be made.");
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" leftIcon={<Plus className="h-4 w-4" />}>
          New list
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-w-[calc(100vw-2rem)] p-4"
      >
        <form action={handleSubmit} className="flex flex-col gap-3" data-analytics-form="create_list" data-analytics-private>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            New list
          </p>
          <input
            autoFocus
            name="name"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="List name (e.g. Cozy winter)"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
          />
          <input
            name="description"
            placeholder="Optional description"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={pending} disabled={!name.trim()}>
              Create and add titles
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
