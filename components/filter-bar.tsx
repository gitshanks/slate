"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownWideNarrow,
  CalendarRange,
  Check,
  ChevronDown,
  CircleDashed,
  Clapperboard,
  Drama,
  Film,
  Heart,
  Layers,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Tv,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  SegmentedFilter,
  type SegmentedFilterOption,
} from "@/components/segmented-filter";

export interface FilterBarProps {
  /** Distinct genres found in the current result set. */
  genres: { id: number; name: string }[];
  /** Whether to show the "Newest release" sort option (hide if all items lack dates). */
  showYearSort?: boolean;
  /** Whether this surface has a meaningful linear order. */
  showSort?: boolean;
  /** Whether to show the reaction (loved/liked/disliked) filter. */
  showSentiment?: boolean;
  /** Label for the chronological sort on this page. */
  recentSortLabel?: string;
  /** Optional collection scopes, used when one surface combines shelves. */
  statusOptions?: readonly SegmentedFilterOption[];
  /** URL parameter used by the optional collection scope. */
  statusParam?: string;
  /** Selected collection when the URL does not specify one. */
  defaultStatus?: string;
  /** Keeps selector IDs unique when multiple filter bars are mounted. */
  idPrefix?: string;
  /** How many titles the current filters leave, for the phone sheet's button. */
  resultCount?: number;
  /** Keep every filter behind the one button at all widths (tight headers). */
  compact?: boolean;
  /** Extra classes for menus and the sheet, which render outside the page. */
  surfaceClassName?: string;
  className?: string;
}

interface FilterOption {
  value: string;
  label: string;
  /** Shorter wording for a segmented control. */
  short?: string;
  icon?: LucideIcon;
}

const TYPE_OPTIONS: readonly FilterOption[] = [
  { value: "", label: "All formats", short: "All", icon: Layers },
  { value: "movie", label: "Films", icon: Film },
  { value: "tv", label: "Series", icon: Tv },
];

const YEAR_OPTIONS: readonly FilterOption[] = [
  { value: "", label: "Any year", short: "Any" },
  { value: "2020s", label: "2020s" },
  { value: "2010s", label: "2010s" },
  { value: "2000s", label: "2000s" },
  { value: "older", label: "Before 2000", short: "Older" },
];

const SENTIMENT_OPTIONS: readonly FilterOption[] = [
  { value: "", label: "Any reaction", short: "All", icon: CircleDashed },
  { value: "loved", label: "Loved", icon: Heart },
  { value: "liked", label: "Liked", icon: ThumbsUp },
  { value: "disliked", label: "Disliked", icon: ThumbsDown },
];

const ICON = "h-4 w-4 shrink-0";
const RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary/80";
const CHIP_REST =
  "border-border bg-foreground/[0.055] text-muted-foreground hover:bg-foreground/[0.09] hover:text-foreground";
const CHIP_ON = "border-primary/40 bg-primary/[0.12] text-primary";
const SURFACE =
  "z-[90] rounded-2xl border-border bg-popover/95 p-1.5 text-popover-foreground shadow-2xl shadow-black/30 backdrop-blur-2xl";

function toSegments(options: readonly FilterOption[]): SegmentedFilterOption[] {
  return options.map(({ value, label, short, icon }) => ({
    value,
    label: short ?? label,
    icon,
  }));
}

function subscribeToWide(onChange: () => void) {
  const query = window.matchMedia("(min-width: 768px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** A single-choice list: icon, label, and a tick on the current one. */
function OptionList({
  label,
  options,
  value,
  onSelect,
  closeOnSelect = false,
}: {
  label: string;
  options: readonly FilterOption[];
  value: string;
  onSelect: (value: string) => void;
  closeOnSelect?: boolean;
}) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "[role=radio]",
      ),
    ];
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    rows[(at + step + rows.length) % rows.length]?.focus();
    event.preventDefault();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        const row = (
          <button
            key={option.value || "any"}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(option.value)}
            className={cn(
              "filter-menu-option flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:bg-foreground/[0.06] focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70 md:h-9 md:rounded-lg md:px-2.5 md:text-[13px]",
              active ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {Icon ? <Icon className={ICON} strokeWidth={1.75} /> : null}
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {active ? (
              <Check className={cn(ICON, "text-primary")} strokeWidth={2.25} />
            ) : null}
          </button>
        );
        return closeOnSelect ? (
          <PopoverClose asChild key={option.value || "any"}>
            {row}
          </PopoverClose>
        ) : (
          row
        );
      })}
    </div>
  );
}

/**
 * One filter as a chip. At rest it names the filter; once set it turns to the
 * theme colour, shows the chosen value, and swaps its chevron for a clear
 * button, so each filter is undone where it was set.
 */
function FilterMenu({
  name,
  icon,
  options,
  value,
  onChange,
  clearable = true,
  idleLabel,
  surfaceClassName,
  widthClassName = "w-52",
}: {
  name: string;
  icon: LucideIcon;
  options: readonly FilterOption[];
  value: string;
  onChange: (value: string) => void;
  /** A sort always has a value, so it is never tinted or cleared. */
  clearable?: boolean;
  idleLabel?: string;
  surfaceClassName?: string;
  widthClassName?: string;
}) {
  const current = options.find((option) => option.value === value);
  const set = Boolean(value) && Boolean(current);
  const tinted = set && clearable;
  const glyph = React.createElement(
    tinted && current?.icon ? current.icon : icon,
    { className: ICON, strokeWidth: 1.75 },
  );
  const text = set && current ? current.label : (idleLabel ?? name);

  return (
    <Popover>
      <div
        data-active={tinted}
        className={cn(
          "inline-flex h-10 shrink-0 items-center rounded-full border transition-[background-color,border-color,color] duration-150",
          tinted
            ? CHIP_ON
            : cn(CHIP_REST, "has-[[data-state=open]]:bg-foreground/[0.09] has-[[data-state=open]]:text-foreground"),
          set && !clearable && "text-foreground",
        )}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            data-filter={name.toLowerCase()}
            aria-label={`${name}: ${current?.label ?? "any"}`}
            className={cn(
              "filter-chip group inline-flex h-full items-center gap-2 rounded-full pl-3.5 text-xs font-medium",
              tinted ? "pr-1.5" : "pr-3",
              RING,
            )}
          >
            {glyph}
            <span className="max-w-[9rem] truncate">{text}</span>
            {tinted ? null : (
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                strokeWidth={2}
              />
            )}
          </button>
        </PopoverTrigger>
        {tinted ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Clear ${name.toLowerCase()}`}
            className={cn(
              "filter-chip mr-1 grid h-8 w-8 place-items-center rounded-full hover:bg-primary/15",
              RING,
            )}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>
      <PopoverContent
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(event) => {
          const checked = (
            event.currentTarget as HTMLElement | null
          )?.querySelector<HTMLElement>('[aria-checked="true"]');
          if (!checked) return;
          event.preventDefault();
          checked.focus();
        }}
        className={cn(
          SURFACE,
          widthClassName,
          "max-h-[min(22rem,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain",
          surfaceClassName,
        )}
      >
        <OptionList
          label={name}
          options={options}
          value={current ? value : ""}
          onSelect={onChange}
          closeOnSelect
        />
      </PopoverContent>
    </Popover>
  );
}

function PanelSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-1 text-xs font-medium text-muted-foreground">{label}</h3>
      {children}
    </section>
  );
}

const PANEL_SEGMENTED =
  "flex h-11 w-full bg-foreground/[0.055] shadow-none md:h-10 [&_.filter-segment]:flex-auto [&_.filter-segment]:px-1";

export function FilterBar({
  genres,
  showYearSort = true,
  showSort = true,
  showSentiment = false,
  recentSortLabel = "Recently added",
  statusOptions,
  statusParam = "status",
  defaultStatus = "",
  idPrefix = "library",
  resultCount,
  compact = false,
  surfaceClassName,
  className,
}: FilterBarProps) {
  const searchParams = useSearchParams();
  const [panelOpen, setPanelOpen] = React.useState(false);
  const wide = React.useSyncExternalStore(
    subscribeToWide,
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );

  const currentType = searchParams.get("type") ?? "";
  const currentGenre = searchParams.get("genre") ?? "";
  const currentYear = searchParams.get("year") ?? "";
  const currentSort = showSort ? (searchParams.get("sort") ?? "") : "";
  const currentSentiment = showSentiment
    ? (searchParams.get("sentiment") ?? "")
    : "";
  const explicitStatus = statusOptions ? searchParams.get(statusParam) : null;
  const currentStatus = statusOptions ? (explicitStatus ?? defaultStatus) : "";

  const writeParams = React.useCallback(
    (change: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      change(params);
      const qs = params.toString();
      // Use the visible browser pathname. Hosted Slate serves /app through a
      // rewrite, so usePathname can describe the internal destination instead.
      const browserPathname = window.location.pathname;
      window.history.replaceState(
        null,
        "",
        qs ? `${browserPathname}?${qs}` : browserPathname,
      );
    },
    [searchParams],
  );

  const setParam = React.useCallback(
    (key: string, value: string) =>
      writeParams((params) => {
        if (value) params.set(key, value);
        else params.delete(key);
      }),
    [writeParams],
  );

  // The shelf and the order are not filters, so clearing leaves them alone.
  const clearFilters = React.useCallback(
    () =>
      writeParams((params) => {
        for (const key of ["type", "genre", "year", "sentiment"]) {
          params.delete(key);
        }
      }),
    [writeParams],
  );

  const genreOptions = React.useMemo<FilterOption[]>(
    () => [
      { value: "", label: "All genres", short: "All" },
      ...genres.map((genre) => ({
        value: String(genre.id),
        label: genre.name,
      })),
    ],
    [genres],
  );

  const sortOptions = React.useMemo<FilterOption[]>(() => {
    const options = [
      { value: "", label: "Your order" },
      { value: "recent", label: recentSortLabel },
      { value: "rating", label: "Highest rated" },
      { value: "year", label: "Newest release" },
    ];
    return showYearSort
      ? options
      : options.filter((option) => option.value !== "year");
  }, [recentSortLabel, showYearSort]);

  const activeCount = [
    currentType,
    genreOptions.some((option) => option.value === currentGenre)
      ? currentGenre
      : "",
    currentYear,
    currentSentiment,
  ].filter(Boolean).length;

  const clearAll = (
    <button
      type="button"
      onClick={clearFilters}
      data-filter-clear
      className={cn(
        "filter-chip inline-flex h-10 shrink-0 items-center rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground",
        RING,
      )}
    >
      Clear all
    </button>
  );

  const panel = (
    <div className="flex flex-col gap-5">
      <PanelSection label="Format">
        <SegmentedFilter
          id={`${idPrefix}-panel-type`}
          options={toSegments(TYPE_OPTIONS)}
          value={currentType}
          onValueChange={(value) => setParam("type", value)}
          fullHeight
          className={PANEL_SEGMENTED}
        />
      </PanelSection>

      {genres.length > 0 ? (
        <PanelSection label="Genre">
          <div
            role="radiogroup"
            aria-label="Genre"
            className="flex flex-wrap gap-1.5"
          >
            {genreOptions.map((option) => {
              const active = option.value === currentGenre;
              return (
                <button
                  key={option.value || "all"}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setParam("genre", option.value)}
                  className={cn(
                    "filter-chip inline-flex h-10 items-center rounded-full border px-3.5 text-xs font-medium md:h-9",
                    active ? CHIP_ON : CHIP_REST,
                    RING,
                  )}
                >
                  {option.short ?? option.label}
                </button>
              );
            })}
          </div>
        </PanelSection>
      ) : null}

      <PanelSection label="Year">
        <SegmentedFilter
          id={`${idPrefix}-panel-year`}
          options={toSegments(YEAR_OPTIONS)}
          value={currentYear}
          onValueChange={(value) => setParam("year", value)}
          fullHeight
          className={PANEL_SEGMENTED}
        />
      </PanelSection>

      {showSentiment ? (
        <PanelSection label="Reaction">
          <SegmentedFilter
            id={`${idPrefix}-panel-sentiment`}
            options={toSegments(SENTIMENT_OPTIONS)}
            value={currentSentiment}
            onValueChange={(value) => setParam("sentiment", value)}
            fullHeight
            className={PANEL_SEGMENTED}
          />
        </PanelSection>
      ) : null}

      {showSort ? (
        <PanelSection label="Sort by">
          <OptionList
            label="Sort by"
            options={sortOptions}
            value={currentSort}
            onSelect={(value) => setParam("sort", value)}
          />
        </PanelSection>
      ) : null}
    </div>
  );

  const panelTrigger = (
    <button
      type="button"
      data-filter-open
      aria-label={
        activeCount ? `Filters, ${activeCount} applied` : "Filters"
      }
      className={cn(
        "filter-chip inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-xs font-medium md:px-3.5",
        activeCount ? CHIP_ON : CHIP_REST,
        RING,
      )}
    >
      <SlidersHorizontal className={ICON} strokeWidth={1.75} />
      <span className="hidden md:inline">Filters</span>
      {activeCount ? (
        <span className="tabular-nums">{activeCount}</span>
      ) : null}
    </button>
  );

  const panelHeader = (Title: React.ElementType) => (
    <div className="flex h-10 items-center justify-between pl-1">
      <Title className="text-base font-semibold text-foreground">Filters</Title>
      {activeCount ? (
        <button
          type="button"
          onClick={clearFilters}
          className={cn(
            "filter-chip -mr-1 inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground md:text-xs",
            RING,
          )}
        >
          Clear all
        </button>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        "mb-8 flex items-center gap-2",
        !compact && "xl:flex-wrap xl:gap-1.5",
        className,
      )}
    >
      {statusOptions ? (
        <SegmentedFilter
          id={`${idPrefix}-status-filter`}
          options={statusOptions}
          value={currentStatus}
          onValueChange={(value) => setParam(statusParam, value)}
          fullHeight
          className="flex h-10 min-w-0 flex-1 bg-foreground/[0.055] shadow-none md:inline-flex md:flex-none [&_.filter-segment]:flex-auto [&_.filter-segment]:whitespace-nowrap [&_.filter-segment]:px-1.5 md:[&_.filter-segment]:px-3.5"
        />
      ) : null}

      {/* Phones and tablets: every filter behind one button. A phone gets a
          sheet it can reach with a thumb; a tablet gets the same panel as a
          menu under the button. */}
      <div className={cn("shrink-0", !compact && "xl:hidden")}>
        {wide ? (
          <Popover open={panelOpen} onOpenChange={setPanelOpen}>
            <PopoverTrigger asChild>{panelTrigger}</PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              collisionPadding={12}
              className={cn(
                SURFACE,
                "max-h-[var(--radix-popover-content-available-height)] w-[22rem] overflow-y-auto overscroll-contain p-4 pt-3",
                surfaceClassName,
              )}
            >
              {panelHeader("h2")}
              <div className="mt-2">{panel}</div>
            </PopoverContent>
          </Popover>
        ) : (
          <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
            <SheetTrigger asChild>{panelTrigger}</SheetTrigger>
            <SheetContent
              side="bottom"
              aria-describedby={undefined}
              className={cn(
                "flex max-h-[88dvh] flex-col gap-0 rounded-t-3xl border-t-0 bg-popover px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 text-popover-foreground ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:duration-200 data-[state=open]:duration-300 motion-reduce:data-[state=closed]:duration-0 motion-reduce:data-[state=open]:duration-0 [&>button]:hidden",
                surfaceClassName,
              )}
            >
              <div
                aria-hidden
                className="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25"
              />
              {panelHeader(SheetTitle)}
              <div className="scrollbar-hide -mx-4 mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
                {panel}
              </div>
              <div className="shrink-0 pt-3">
                <SheetClose asChild>
                  <button
                    type="button"
                    className={cn(
                      "filter-chip h-11 w-full shrink-0 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
                      RING,
                    )}
                  >
                    {resultCount === undefined
                      ? "Done"
                      : resultCount === 0
                        ? "No titles match"
                        : `Show ${resultCount} ${resultCount === 1 ? "title" : "titles"}`}
                  </button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Desktop: each filter is its own chip. */}
      <div className={compact ? "hidden" : "hidden xl:contents"}>
        <FilterMenu
          name="Format"
          icon={Clapperboard}
          options={TYPE_OPTIONS}
          value={currentType}
          onChange={(value) => setParam("type", value)}
          surfaceClassName={surfaceClassName}
          widthClassName="w-48"
        />
        {genres.length > 0 ? (
          <FilterMenu
            name="Genre"
            icon={Drama}
            options={genreOptions}
            value={currentGenre}
            onChange={(value) => setParam("genre", value)}
            surfaceClassName={surfaceClassName}
            widthClassName="w-56"
          />
        ) : null}
        <FilterMenu
          name="Year"
          icon={CalendarRange}
          options={YEAR_OPTIONS}
          value={currentYear}
          onChange={(value) => setParam("year", value)}
          surfaceClassName={surfaceClassName}
          widthClassName="w-48"
        />
        {showSentiment ? (
          <FilterMenu
            name="Reaction"
            icon={Heart}
            options={SENTIMENT_OPTIONS}
            value={currentSentiment}
            onChange={(value) => setParam("sentiment", value)}
            surfaceClassName={surfaceClassName}
            widthClassName="w-48"
          />
        ) : null}
        {showSort ? (
          <FilterMenu
            name="Sort"
            icon={ArrowDownWideNarrow}
            options={sortOptions}
            value={currentSort}
            onChange={(value) => setParam("sort", value)}
            clearable={false}
            surfaceClassName={surfaceClassName}
          />
        ) : null}
        {activeCount > 1 ? clearAll : null}
      </div>
    </div>
  );
}
