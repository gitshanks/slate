import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The quiet way onward ("See all", "Explore more lists"): mint label, a thin
 * mint ring and an arrow that leans forward on hover. The same style as the
 * top-bar action on list pages, so a page carries one secondary button style
 * beside its one solid mint call to action (DESIGN.md, Interaction).
 */
export function SlateGoLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/go inline-flex h-11 items-center gap-2 rounded-full px-[18px] text-[15px] font-semibold text-primary ring-1 ring-inset ring-primary/35",
        "transition-[background-color,box-shadow,transform] duration-200 ease-out hover:bg-primary/[0.08] hover:ring-primary/60 active:scale-[0.97] motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary lg:h-12 lg:px-[22px] lg:text-base",
        className,
      )}
    >
      {children}
      <ArrowRight
        aria-hidden
        className="size-4 transition-transform duration-200 ease-out motion-reduce:transition-none group-hover/go:translate-x-0.5"
      />
    </Link>
  );
}
