"use client";

import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Check, Grip, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { PosterCard } from "@/components/poster-card";
import { MotionGrid, MotionItem } from "@/components/motion-grid";
import { reorderListTitles, reorderStatusTitles } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { TitleRow } from "@/lib/supabase";

type ReorderableStatus = "want" | "watching" | "watched";

export type MediaGridReorderContext =
  | {
      kind: "status";
      status: ReorderableStatus;
      /** Full collection order, including titles hidden by active filters. */
      allTitleIds: string[];
    }
  | {
      kind: "list";
      listId: string;
    };

interface MediaGridProps {
  titles: TitleRow[];
  reorderContext?: MediaGridReorderContext;
}

function moveTitle(
  titles: TitleRow[],
  titleId: string,
  targetIndex: number
): TitleRow[] {
  const fromIndex = titles.findIndex((title) => title.id === titleId);
  if (fromIndex < 0 || targetIndex < 0 || targetIndex >= titles.length) {
    return titles;
  }
  if (fromIndex === targetIndex) return titles;

  const next = [...titles];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function mergeVisibleOrder(
  allTitleIds: string[],
  visibleTitleIds: string[]
): string[] {
  const visible = new Set(visibleTitleIds);
  let visibleIndex = 0;
  return allTitleIds.map((id) =>
    visible.has(id) ? visibleTitleIds[visibleIndex++] : id
  );
}

export function MediaGrid(props: MediaGridProps) {
  // Reset local ordering only when filtering/add/remove changes membership.
  // A saved reorder keeps the same members, so its optimistic state stays put
  // while the refreshed Server Component payload arrives.
  const collectionKey = props.titles
    .map((title) => title.id)
    .sort()
    .join("|");
  return <MediaGridState key={collectionKey} {...props} />;
}

function MediaGridState({ titles, reorderContext }: MediaGridProps) {
  const [orderedTitles, setOrderedTitles] = useState(titles);
  const [isReordering, setIsReordering] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const orderedRef = useRef(titles);
  const activeIdRef = useRef<string | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveVersionRef = useRef(0);

  const getPersistedOrder = useCallback(
    (visibleTitleIds: string[]) => {
      if (reorderContext?.kind === "status") {
        return mergeVisibleOrder(
          reorderContext.allTitleIds,
          visibleTitleIds
        );
      }
      return visibleTitleIds;
    },
    [reorderContext]
  );

  const persistOrder = useCallback(
    (nextTitles: TitleRow[]) => {
      if (!reorderContext) return;
      const visibleTitleIds = nextTitles.map((title) => title.id);
      const persistedOrder = getPersistedOrder(visibleTitleIds);
      const version = ++saveVersionRef.current;
      setPendingSaves((count) => count + 1);

      const save = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (reorderContext.kind === "status") {
            await reorderStatusTitles(
              reorderContext.status,
              persistedOrder
            );
          } else {
            await reorderListTitles(
              reorderContext.listId,
              persistedOrder
            );
          }
        });
      saveQueueRef.current = save;

      void save
        .catch((error) => {
          if (version === saveVersionRef.current) {
            orderedRef.current = titles;
            setOrderedTitles(titles);
            toast.error(
              error instanceof Error ? error.message : "Couldn’t save order"
            );
          }
        })
        .finally(() => {
          setPendingSaves((count) => Math.max(0, count - 1));
        });
    },
    [getPersistedOrder, reorderContext, titles]
  );

  const updatePosition = useCallback(
    (titleId: string, targetIndex: number, save = false) => {
      const next = moveTitle(orderedRef.current, titleId, targetIndex);
      if (next === orderedRef.current) return;

      orderedRef.current = next;
      setOrderedTitles(next);
      const moved = next[targetIndex];
      setAnnouncement(
        `${moved.title} moved to position ${targetIndex + 1} of ${next.length}.`
      );
      if (save) persistOrder(next);
    },
    [persistOrder]
  );

  function handlePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    titleId: string
  ) {
    event.preventDefault();
    event.stopPropagation();
    pointerIdRef.current = event.pointerId;
    activeIdRef.current = titleId;
    setActiveId(titleId);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const draggedId = activeIdRef.current;
    if (
      !draggedId ||
      pointerIdRef.current !== event.pointerId ||
      typeof document === "undefined"
    ) {
      return;
    }

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-reorder-id]");
    const targetId = target?.dataset.reorderId;
    if (!targetId || targetId === draggedId) return;

    const targetIndex = orderedRef.current.findIndex(
      (title) => title.id === targetId
    );
    updatePosition(draggedId, targetIndex);
  }

  function finishPointerReorder(event: PointerEvent<HTMLButtonElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    pointerIdRef.current = null;
    activeIdRef.current = null;
    setActiveId(null);
    persistOrder(orderedRef.current);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    titleId: string
  ) {
    const currentIndex = orderedRef.current.findIndex(
      (title) => title.id === titleId
    );
    let targetIndex = currentIndex;

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        targetIndex = Math.max(0, currentIndex - 1);
        break;
      case "ArrowRight":
      case "ArrowDown":
        targetIndex = Math.min(orderedRef.current.length - 1, currentIndex + 1);
        break;
      case "Home":
        targetIndex = 0;
        break;
      case "End":
        targetIndex = orderedRef.current.length - 1;
        break;
      case "Escape":
        setIsReordering(false);
        return;
      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    updatePosition(titleId, targetIndex, true);
  }

  const canReorder = Boolean(reorderContext && titles.length > 1);
  const isSaving = pendingSaves > 0;

  return (
    <div>
      {canReorder && (
        <div className="mb-4 flex min-h-9 items-center justify-between gap-4">
          <p
            aria-hidden={!isReordering}
            className={cn(
              "text-xs text-muted-foreground transition-opacity",
              !isReordering && "pointer-events-none opacity-0"
            )}
          >
            {isSaving ? "Saving your order…" : "Drag titles into place"}
          </p>
          <button
            type="button"
            aria-pressed={isReordering}
            onClick={() => {
              activeIdRef.current = null;
              pointerIdRef.current = null;
              setActiveId(null);
              setIsReordering((active) => !active);
            }}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
              isReordering
                ? "border-primary/50 bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {isSaving ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : isReordering ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Grip className="h-3.5 w-3.5" aria-hidden />
            )}
            {isReordering ? "Done" : "Reorder"}
          </button>
        </div>
      )}

      <MotionGrid className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10">
        {orderedTitles.map((title, index) => (
          <MotionItem
            key={title.id}
            layout={isReordering}
            pressable={!isReordering}
            className={cn(
              "relative",
              activeId === title.id && "z-30 scale-[1.02]"
            )}
          >
            <div
              data-reorder-id={title.id}
              className="relative rounded-xl"
            >
              <div inert={isReordering}>
                <PosterCard title={title} priority={index < 8} />
              </div>

              {isReordering && (
                <button
                  type="button"
                  aria-label={`Move ${title.title}. Position ${index + 1} of ${orderedTitles.length}. Use arrow keys or drag.`}
                  title="Drag to reorder"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onPointerDown={(event) =>
                    handlePointerDown(event, title.id)
                  }
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishPointerReorder}
                  onPointerCancel={finishPointerReorder}
                  onKeyDown={(event) => handleKeyDown(event, title.id)}
                  className={cn(
                    "absolute inset-0 z-30 cursor-grab touch-none rounded-xl border-2 border-primary/65 bg-black/10 outline-none backdrop-blur-[1px]",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "active:cursor-grabbing",
                    activeId === title.id &&
                      "border-primary bg-primary/10 shadow-[0_20px_60px_-18px_hsl(var(--primary)/0.7)]"
                  )}
                >
                  <span className="absolute left-1/2 top-2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur">
                    <Grip className="h-3.5 w-3.5" aria-hidden />
                    {index + 1}
                  </span>
                </button>
              )}
            </div>
          </MotionItem>
        ))}
      </MotionGrid>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
