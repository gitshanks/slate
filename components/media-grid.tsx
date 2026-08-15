"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  DragDropProvider,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  useDragDropManager,
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
import { RailScroller } from "@/components/rail-scroller";
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
  readOnly?: boolean;
  titleHrefBase?: string;
  /** Optional query string preserved when opening a title from this grid. */
  titleHrefSearch?: string;
  /** Opens a title in-place instead of navigating to its page. */
  onTitleSelect?: (title: TitleRow) => void;
  /** Keeps the source card visible while its in-place detail view is open. */
  activeTitleId?: string | null;
  /** Applies the Space card treatment to a public Shelf grid. */
  presentation?: "default" | "profile";
  /** Keeps mutation controls in the inspector while retaining sortable cards. */
  showCardActions?: boolean;
  /** Keep the collection to one horizontally scrollable poster row. */
  horizontal?: boolean;
  /** Fit four smaller cards across narrow shared-profile screens. */
  compactMobile?: boolean;
  /** Disable per-card entrance staggering when a parent owns result motion. */
  animateEntrance?: boolean;
}

const mediaGridClassName =
  "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10";

const mediaRailClassName =
  "grid min-w-full grid-flow-col auto-cols-[calc((100%_-_0.75rem)/2)] gap-x-3 sm:auto-cols-[calc((100%_-_2.5rem)/3)] sm:gap-x-5 md:auto-cols-[calc((100%_-_3.75rem)/4)] lg:auto-cols-[calc((100%_-_5rem)/5)] 2xl:auto-cols-[calc((100%_-_6.25rem)/6)] 3xl:auto-cols-[calc((100%_-_7.5rem)/7)] 4xl:auto-cols-[calc((100%_-_8.75rem)/8)] 5xl:auto-cols-[calc((100%_-_10rem)/9)] 6xl:auto-cols-[calc((100%_-_11.25rem)/10)]";

const compactMobileGridClassName =
  "grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10";

function MediaLayout({
  children,
  horizontal = false,
  compactMobile = false,
  animateEntrance = true,
}: {
  children: React.ReactNode;
  horizontal?: boolean;
  compactMobile?: boolean;
  animateEntrance?: boolean;
}) {
  const gridClassName =
    horizontal
      ? mediaRailClassName
      : compactMobile
        ? compactMobileGridClassName
        : mediaGridClassName;
  const grid = animateEntrance ? (
    <MotionGrid
      className={gridClassName}
    >
      {children}
    </MotionGrid>
  ) : (
    <div className={gridClassName}>{children}</div>
  );

  return <RailScroller enabled={horizontal}>{grid}</RailScroller>;
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
      if (target.closest("[data-drag-card]")) return false;
      return Boolean(
        target.closest(
          "button, input, textarea, select, [contenteditable='true'], [data-no-drag]"
        )
      );
    },
  }),
  KeyboardSensor,
];

const STALLED_DRAG_TIMEOUT = 250;

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
  const titleIds = props.titles.map((title) => title.id);

  if (!props.reorderContext) {
    return <OrderedMediaGrid key={titleIds.join("|")} {...props} />;
  }

  // Sortable grids own an optimistic order, so keep their state through the
  // Server Component refresh that follows a saved drag. Membership changes
  // still remount the grid when a filter is applied or a title is added.
  const collectionKey = [...titleIds].sort().join("|");
  return <MediaGridState key={collectionKey} {...props} />;
}

/**
 * Keep sorted/read-only rendering in a separate component tree from the
 * optimistic drag-order tree. It renders directly from the incoming order so
 * sort changes are reflected immediately, while returning to "Your order"
 * mounts a fresh sortable grid from the canonical order supplied by the server.
 */
function OrderedMediaGrid(props: MediaGridProps) {
  return (
    <MediaLayout
      horizontal={props.horizontal}
      compactMobile={props.compactMobile}
      animateEntrance={props.animateEntrance}
    >
      {props.titles.map((title, index) => (
        <motion.article
          key={title.id}
          variants={staggerChild}
          id={`shelf-title-${title.id}`}
          data-shelf-title-id={title.id}
          animate={
            props.activeTitleId === title.id
              ? { scale: [1, 1.018, 1] }
              : { scale: 1 }
          }
          transition={
            props.activeTitleId === title.id
              ? {
                  duration: 1.65,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
              : { duration: 0.18, ease: "easeOut" }
          }
          className={cn(
            "relative rounded-xl",
            props.activeTitleId === title.id && "z-10",
            props.horizontal && "snap-start",
          )}
        >
          <PosterCard
            title={title}
            priority={index < 8}
            readOnly={props.readOnly}
            compactMobile={props.compactMobile}
            highlighted={props.activeTitleId === title.id}
            presentation={props.presentation}
            showActions={props.showCardActions}
            onOpen={
              props.onTitleSelect
                ? () => props.onTitleSelect?.(title)
                : undefined
            }
            href={
              props.titleHrefBase
                ? `${props.titleHrefBase}/${title.id}${props.titleHrefSearch ?? ""}`
                : undefined
            }
          />
        </motion.article>
      ))}
    </MediaLayout>
  );
}

function MediaGridState({
  titles,
  reorderContext,
  readOnly = false,
  titleHrefBase,
  titleHrefSearch,
  onTitleSelect,
  activeTitleId,
  presentation = "default",
  showCardActions = true,
  horizontal = false,
  compactMobile = false,
  animateEntrance = true,
}: MediaGridProps) {
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
      const { abort: skipPostDropPhase } = event.suspend();

      try {
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
      } finally {
        // We render the reordered grid during this drag-end callback, so there
        // is no post-drop work for dnd-kit to animate. Abort only its finishing
        // phase to release the overlay and pointer state immediately.
        skipPostDropPhase();
      }
    },
    [persistOrder]
  );

  if (readOnly) {
    return (
      <MediaLayout
        horizontal={horizontal}
        compactMobile={compactMobile}
        animateEntrance={animateEntrance}
      >
        {orderedTitles.map((title, index) => (
          <motion.article
            key={title.id}
            variants={staggerChild}
            id={`shelf-title-${title.id}`}
            data-shelf-title-id={title.id}
            animate={
              activeTitleId === title.id
                ? { scale: [1, 1.018, 1] }
                : { scale: 1 }
            }
            transition={
              activeTitleId === title.id
                ? {
                    duration: 1.65,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
                : { duration: 0.18, ease: "easeOut" }
            }
            className={cn(
              activeTitleId === title.id && "relative z-10",
              horizontal && "snap-start",
            )}
          >
            <PosterCard
              title={title}
              priority={index < 8}
              readOnly
              compactMobile={compactMobile}
              highlighted={activeTitleId === title.id}
              presentation={presentation}
              showActions={showCardActions}
              onOpen={onTitleSelect ? () => onTitleSelect(title) : undefined}
              href={
                titleHrefBase
                  ? `${titleHrefBase}/${title.id}${titleHrefSearch ?? ""}`
                  : undefined
              }
            />
          </motion.article>
        ))}
      </MediaLayout>
    );
  }

  return (
    <DragDropProvider
      sensors={titleSensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <DragSessionRecovery />

      <MediaLayout
        horizontal={horizontal}
        compactMobile={compactMobile}
        animateEntrance={animateEntrance}
      >
        {orderedTitles.map((title, index) => (
          <SortablePoster
            key={title.id}
            title={title}
            index={index}
            count={orderedTitles.length}
            disabled={!canReorder}
            priority={index < 8}
            horizontal={horizontal}
            suppressClicksUntilRef={suppressClicksUntilRef}
            compactMobile={compactMobile}
            presentation={presentation}
            active={activeTitleId === title.id}
            onTitleSelect={onTitleSelect}
            readOnly={readOnly}
            titleHrefBase={titleHrefBase}
            titleHrefSearch={titleHrefSearch}
            showCardActions={showCardActions}
          />
        ))}
      </MediaLayout>

      <DragOverlay
        className="pointer-events-none z-[100]"
        // The sortable grid has already moved the destination tile beneath
        // the pointer. Hand off to it immediately on release instead of
        // adding a second "fly home" phase that makes the drop feel delayed.
        dropAnimation={null}
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

/**
 * Pointer capture can be lost without a final pointerup when iOS changes
 * browser chrome, backgrounds the PWA, or interrupts a touch gesture. End the
 * operation from the corresponding fallback events, and keep a final watchdog
 * in case a browser/library animation still fails to release its state.
 */
function DragSessionRecovery() {
  const manager = useDragDropManager();

  useEffect(() => {
    if (!manager) return;

    let recoveryTimer = 0;

    const clearRecoveryTimer = () => {
      window.clearTimeout(recoveryTimer);
      recoveryTimer = 0;
    };

    const forceIdle = () => {
      const { dragOperation } = manager;
      if (dragOperation.status.idle) return;

      const source = dragOperation.source;
      if (source) source.status = "idle";
      dragOperation.reset();
    };

    const scheduleRecovery = () => {
      clearRecoveryTimer();
      recoveryTimer = window.setTimeout(forceIdle, STALLED_DRAG_TIMEOUT);
    };

    const cancelActiveDrag = (event: Event) => {
      const { dragOperation } = manager;
      if (dragOperation.status.idle) return;

      manager.actions.stop({ event, canceled: true });
      scheduleRecovery();
    };

    const finishLastTouch = (event: TouchEvent) => {
      if (event.touches.length > 0) return;
      if (!manager.dragOperation.status.dragging) return;

      manager.actions.stop({ event });
      scheduleRecovery();
    };

    const handleVisibilityChange = (event: Event) => {
      if (document.visibilityState === "hidden") {
        cancelActiveDrag(event);
      }
    };

    const removeDragStartMonitor = manager.monitor.addEventListener(
      "dragstart",
      clearRecoveryTimer,
    );
    const removeDragEndMonitor = manager.monitor.addEventListener(
      "dragend",
      scheduleRecovery,
    );

    document.addEventListener("touchend", finishLastTouch, true);
    document.addEventListener("touchcancel", cancelActiveDrag, true);
    document.addEventListener("lostpointercapture", cancelActiveDrag, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", cancelActiveDrag);
    window.addEventListener("pagehide", cancelActiveDrag);

    return () => {
      clearRecoveryTimer();
      removeDragStartMonitor();
      removeDragEndMonitor();
      document.removeEventListener("touchend", finishLastTouch, true);
      document.removeEventListener("touchcancel", cancelActiveDrag, true);
      document.removeEventListener(
        "lostpointercapture",
        cancelActiveDrag,
        true,
      );
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      window.removeEventListener("blur", cancelActiveDrag);
      window.removeEventListener("pagehide", cancelActiveDrag);
    };
  }, [manager]);

  return null;
}

interface SortablePosterProps {
  title: TitleRow;
  index: number;
  count: number;
  disabled: boolean;
  priority: boolean;
  horizontal: boolean;
  suppressClicksUntilRef: MutableRefObject<number>;
  compactMobile: boolean;
  presentation: "default" | "profile";
  active: boolean;
  onTitleSelect?: (title: TitleRow) => void;
  readOnly: boolean;
  titleHrefBase?: string;
  titleHrefSearch?: string;
  showCardActions: boolean;
}

function SortablePoster({
  title,
  index,
  count,
  disabled,
  priority,
  horizontal,
  suppressClicksUntilRef,
  compactMobile,
  presentation,
  active,
  onTitleSelect,
  readOnly,
  titleHrefBase,
  titleHrefSearch,
  showCardActions,
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
        active && "z-10",
        horizontal && "snap-start",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        !disabled &&
          "suppress-touch-callout cursor-grab active:cursor-grabbing",
        (isDragging || isDropping) && "sortable-title-dragging z-30"
      )}
      whileTap={disabled || isDragging ? undefined : { scale: 0.985 }}
      animate={active ? { scale: [1, 1.018, 1] } : { scale: 1 }}
      transition={
        active
          ? { duration: 1.65, repeat: Infinity, ease: "easeInOut" }
          : { duration: DUR.fast, ease: EASE }
      }
    >
      <div className={cn((isDragging || isDropping) && "opacity-0")}>
        <PosterCard
          title={title}
          priority={priority}
          suppressLongPressMenu={!disabled}
          compactMobile={compactMobile}
          highlighted={active}
          presentation={presentation}
          readOnly={readOnly}
          onOpen={onTitleSelect ? () => onTitleSelect(title) : undefined}
          href={
            titleHrefBase
              ? `${titleHrefBase}/${title.id}${titleHrefSearch ?? ""}`
              : undefined
          }
          showActions={showCardActions}
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
      initial={reduceMotion ? false : { scale: 0.985 }}
      animate={
        reduceMotion
          ? { scale: 1 }
          : { scale: 1.02 }
      }
      transition={{
        type: "spring",
        duration: 0.18,
        bounce: 0.06,
      }}
      className="cursor-grabbing rounded-xl"
    >
      <PosterCard title={title} dragPreview />
    </motion.div>
  );
}
