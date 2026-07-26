"use client";

import { useCallback, useRef, useState, type MutableRefObject } from "react";
import {
  DragDropProvider,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/react";
import {
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
} from "@dnd-kit/dom";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { PosterCard } from "@/components/poster-card";
import { MotionGrid } from "@/components/motion-grid";
import { reorderListTitles, reorderStatusTitles } from "@/lib/actions";
import { DUR, EASE, staggerChild } from "@/lib/motion";
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

const titleSensors = [
  PointerSensor.configure({
    // A deliberate hold starts the drag. Small movement before activation
    // still counts as a normal tap or page scroll.
    activationConstraints(event) {
      return [
        new PointerActivationConstraints.Delay({
          value: event.pointerType === "touch" ? 280 : 200,
          tolerance: event.pointerType === "touch" ? 9 : 5,
        }),
      ];
    },
    preventActivation(event) {
      const target = event.target;
      if (!(target instanceof Element)) return false;

      // Quick actions remain immediately clickable. The poster link itself is
      // intentionally allowed so a hold anywhere on the card can pick it up.
      return Boolean(
        target.closest(
          "button, input, textarea, select, [contenteditable='true'], [data-no-drag]"
        )
      );
    },
  }),
  KeyboardSensor,
];

function moveTitle(
  titles: TitleRow[],
  fromIndex: number,
  targetIndex: number
): TitleRow[] {
  if (
    fromIndex < 0 ||
    targetIndex < 0 ||
    fromIndex >= titles.length ||
    targetIndex >= titles.length ||
    fromIndex === targetIndex
  ) {
    return titles;
  }

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
  const [announcement, setAnnouncement] = useState("");
  const orderedRef = useRef(titles);
  const suppressClicksUntilRef = useRef(0);
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

      // Serialize saves so a rapid series of drops can never land out of order.
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

      void save.catch((error) => {
        if (version === saveVersionRef.current) {
          orderedRef.current = titles;
          setOrderedTitles(titles);
          toast.error(
            error instanceof Error ? error.message : "Couldn’t save order"
          );
        }
      });
    },
    [getPersistedOrder, reorderContext, titles]
  );

  const canReorder = Boolean(reorderContext && orderedTitles.length > 1);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    suppressClicksUntilRef.current = Date.now() + 1_000;

    if (
      event.operation.activatorEvent instanceof PointerEvent &&
      event.operation.activatorEvent.pointerType === "touch" &&
      "vibrate" in navigator
    ) {
      navigator.vibrate(8);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      suppressClicksUntilRef.current = Date.now() + 350;

      const { source } = event.operation;
      if (event.canceled || !isSortable(source)) return;

      const next = moveTitle(
        orderedRef.current,
        source.initialIndex,
        source.index
      );
      if (next === orderedRef.current) return;

      orderedRef.current = next;
      setOrderedTitles(next);
      const moved = next[source.index];
      setAnnouncement(
        `${moved.title} moved to position ${source.index + 1} of ${next.length}.`
      );
      persistOrder(next);
    },
    [persistOrder]
  );

  return (
    <DragDropProvider
      sensors={titleSensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <MotionGrid className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10">
        {orderedTitles.map((title, index) => (
          <SortablePoster
            key={title.id}
            title={title}
            index={index}
            count={orderedTitles.length}
            disabled={!canReorder}
            priority={index < 8}
            suppressClicksUntilRef={suppressClicksUntilRef}
          />
        ))}
      </MotionGrid>

      <DragOverlay
        className="pointer-events-none z-[100]"
        dropAnimation={{
          duration: 180,
          easing: "cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {(source) => {
          const title = orderedRef.current.find(
            (candidate) => candidate.id === source.id
          );
          return title ? <FloatingPoster title={title} /> : null;
        }}
      </DragOverlay>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </DragDropProvider>
  );
}

interface SortablePosterProps {
  title: TitleRow;
  index: number;
  count: number;
  disabled: boolean;
  priority: boolean;
  suppressClicksUntilRef: MutableRefObject<number>;
}

function SortablePoster({
  title,
  index,
  count,
  disabled,
  priority,
  suppressClicksUntilRef,
}: SortablePosterProps) {
  const { ref, isDragging, isDropping } = useSortable({
    id: title.id,
    index,
    disabled,
    type: "title",
    accept: "title",
    transition: {
      duration: 220,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
    },
  });

  return (
    <motion.div
      ref={ref}
      variants={staggerChild}
      tabIndex={disabled ? undefined : 0}
      role={disabled ? undefined : "group"}
      aria-roledescription={disabled ? undefined : "sortable title"}
      aria-label={
        disabled
          ? undefined
          : `${title.title}, position ${index + 1} of ${count}. Press and hold to drag, or press Space to move with the keyboard.`
      }
      onClickCapture={(event) => {
        if (Date.now() < suppressClicksUntilRef.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onContextMenuCapture={(event) => {
        if (!disabled) {
          event.preventDefault();
        }
      }}
      className={cn(
        "relative touch-manipulation rounded-xl outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        !disabled &&
          "suppress-touch-callout cursor-grab active:cursor-grabbing",
        (isDragging || isDropping) && "z-30"
      )}
      whileTap={disabled || isDragging ? undefined : { scale: 0.985 }}
      transition={{ duration: DUR.fast, ease: EASE }}
    >
      <div className={cn((isDragging || isDropping) && "opacity-0")}>
        <PosterCard
          title={title}
          priority={priority}
          suppressLongPressMenu={!disabled}
        />
      </div>
    </motion.div>
  );
}

function FloatingPoster({ title }: { title: TitleRow }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      inert
      initial={reduceMotion ? false : { scale: 0.985, rotate: 0 }}
      animate={
        reduceMotion
          ? { scale: 1, rotate: 0 }
          : { scale: 1.035, rotate: 0.35 }
      }
      transition={{
        type: "spring",
        duration: 0.22,
        bounce: 0.12,
      }}
      className="cursor-grabbing rounded-xl ring-1 ring-white/20 shadow-[0_26px_70px_-18px_rgba(0,0,0,0.7)]"
    >
      <PosterCard title={title} dragPreview />
    </motion.div>
  );
}
