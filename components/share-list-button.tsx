"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShareListButtonProps {
  listSlug: string;
  listName: string;
  className?: string;
}

export function ShareListButton({ listSlug, listName, className }: ShareListButtonProps) {
  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/lists/${listSlug}`;
    if (navigator.share) {
      navigator.share({ title: listName, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast.success("Link copied");
      });
    }
  }

  return (
    <button
      type="button"
      aria-label={`Share ${listName}`}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full",
        "bg-background/80 backdrop-blur-sm border border-border",
        "text-muted-foreground transition-colors",
        "hover:text-primary hover:border-primary/40",
        className
      )}
    >
      <Share2 className="h-3.5 w-3.5" />
    </button>
  );
}
