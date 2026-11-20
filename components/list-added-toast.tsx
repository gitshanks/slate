"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { posterUrl } from "@/lib/tmdb-image";
import { cn } from "@/lib/utils";

// Full width and 44px tall on a phone, their own width from `sm` up.
const button =
  "inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:w-auto";

/**
 * The fan of posters the list brought with it: three cards that spread out
 * from a single stack as the toast arrives, the first on top.
 */
function PosterFan({ posters }: { posters: (string | null)[] }) {
  const reduce = useReducedMotion();
  const cards = posters.slice(0, 3);
  const spread = [
    { x: 0, rotate: -7 },
    { x: 14, rotate: 0 },
    { x: 28, rotate: 7 },
  ];
  return (
    <div aria-hidden className="relative h-[72px] w-[76px] shrink-0">
      {cards
        .map((path, index) => ({ path, index }))
        .reverse()
        .map(({ path, index }) => (
          <motion.span
            key={index}
            initial={reduce ? false : { x: 14, rotate: 0, scale: 0.92, opacity: 0 }}
            animate={{ ...spread[index], scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 26, delay: reduce ? 0 : 0.06 + index * 0.05 }}
            className="absolute left-0 top-0 block h-[72px] w-12 origin-bottom overflow-hidden rounded-lg bg-white/10 shadow-[0_8px_22px_-8px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
          >
            {path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl(path, "w185")!} alt="" data-image-arrival="off" className="h-full w-full object-cover" />
            ) : null}
          </motion.span>
        ))}
      <motion.span
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 18, delay: reduce ? 0 : 0.24 }}
        className="absolute -bottom-1 left-[52px] grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground ring-[3px] ring-[#121413]"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </motion.span>
    </div>
  );
}

function ListAddedCard({
  id,
  name,
  count,
  posters,
  guest,
  signupHref,
}: {
  id: string | number;
  name: string;
  count: number;
  posters: (string | null)[];
  guest: boolean;
  signupHref: string;
}) {
  return (
    <div className="relative w-[calc(100vw-2rem)] max-w-[380px] rounded-2xl border border-white/10 bg-[#121413]/95 p-4 text-white shadow-[0_28px_70px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl">
      <div className="flex items-center gap-3.5 pr-8">
        <PosterFan posters={posters} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug">On your slate</p>
          <p className="mt-0.5 truncate text-[13px] text-white/60">
            {count} {count === 1 ? "title" : "titles"} · {name}
          </p>
          {guest ? (
            <p className="mt-1.5 text-[12px] leading-snug text-white/50">
              Sign up to keep it on your phone, computer and iPad.
            </p>
          ) : null}
        </div>
      </div>
      <div className={cn("mt-4 grid gap-2 sm:flex sm:justify-end", guest ? "grid-cols-2" : "grid-cols-1")}>
        {guest ? (
          <Link
            href={signupHref}
            onClick={() => toast.dismiss(id)}
            className={cn(button, "border border-white/12 bg-white/[0.06] text-white hover:bg-white/[0.1]")}
            data-analytics-action="guest_signup"
            data-analytics-area="list_added_toast"
          >
            Sign up free
          </Link>
        ) : null}
        <Link
          href={guest ? "/app" : "/lists"}
          onClick={() => toast.dismiss(id)}
          className={cn(button, "bg-primary text-primary-foreground")}
        >
          Open my slate
        </Link>
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(id)}
        aria-label="Close"
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Show the "on your slate" card after a list is added. */
export function showListAddedToast(props: {
  name: string;
  count: number;
  posters: (string | null)[];
  guest: boolean;
  signupHref: string;
}) {
  toast.custom((id) => <ListAddedCard id={id} {...props} />, { duration: 8000 });
}
