"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createList } from "@/lib/actions";

export function CreateListForm() {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  if (!open) {
    return (
      <Button
        variant="outline"
        leftIcon={<Plus className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        New list
      </Button>
    );
  }

  return (
    <form
      action={(fd) => start(() => createList(fd))}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:max-w-lg"
    >
      <input
        autoFocus
        name="name"
        required
        placeholder="List name (e.g. Cozy winter)"
        className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
      />
      <input
        name="description"
        placeholder="Optional description"
        className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Create
        </Button>
      </div>
    </form>
  );
}
