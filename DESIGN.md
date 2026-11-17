# Slate design rules

Rules learned from corrections on this project. Read this before any UI work. Each rule covers a kind of component, uses the project's own tokens, and carries the reason and the words that prompted it.

## Motion

- **A selector that flows is one thick body in the theme colour.** When an indicator moves like liquid (the dock selector in `components/dock-liquid.tsx`), draw it as a single continuous shape filled with `--primary`, with its label in `--primary-foreground`. No separate beads strung behind it, no connecting thread thinner than about half the selector's height, no metal or other material outside the theme, and edges that stay smooth when captured at 3×.
  Why: the first version, a chrome bead trailing a string of smaller ones, "look[ed] extremely chunky".
  <!-- 2026-11-14: "The work you did on the bar at the bottom look extremely chunky. Make it polished and smooth as fuck... we need it to be blobby, thick liquid which is flowing between them, so it should take color of like the theme. So think of it as like jello, rather than metal" -->

- **Every control that moves a marker between options uses the liquid selector.** Segmented filters, view switches, the dock and any new tab-like control render `LiquidSelector` (`components/liquid-selector.tsx`; `SegmentedFilter` and `ViewSwitcher` already wrap it) instead of a sliding pill, a `layoutId` highlight or a colour swap. It can be dragged as well as tapped, and the chosen label's ink colour is drawn by the selector, not by the button. Use the `LIQUID_CONTROL` springs for small controls and `LIQUID_DOCK` only for the dock.
  Why: not given yet.
  <!-- 2026-11-14: "Can we add the gooey motion and behavior to everywhere on Slate?" -->

- **Nothing arrives in a single frame.** Three parts, all already wired app-wide:
  - Images (posters, backdrops, covers, avatars) fade in once loaded and decoded. `ImageArrival` (`components/image-arrival.tsx`, mounted in the app and public-profile layouts) does this for every `<img>`; never add a per-component image pop or a second fade on top (opt out with `data-image-arrival="off"` only when an image runs its own crossfade).
  - A screen or a whole result set that replaces another fades up over about 220 ms starting from 45% opacity (`.app-tab-arrive`), never from 0: a new screen's first frame is its slowest, and starting from nothing shows an empty page for that long.
  - A control answers the tap before the work it triggers: the selector moves at once and the heavy re-render follows (`SegmentedFilter` hands the change to its owner one frame later).
  Why: "loading of all screens could be better. They just flash right now."
  <!-- 2026-11-14: "Also, loading of all screens could be better. They just flash right now." Measured before the fix: tab switches and filter changes were single-frame cuts, and posters appeared in one frame as each finished downloading. -->

## Interaction

- **A card's actions sit in one row, and it is dismissed from its top-right corner.** On a phone, two or three actions share one row in equal widths (`grid grid-cols-2`), and a single action takes the whole row; from `sm` up they sit at their own width beside the text. Buttons are 44px tall on a phone (`h-11`), 40px from `sm` up (`h-10`). A card that can be dismissed has its close button (a 36px X) pinned to the top-right corner with the text padded clear of it; a card without an X gets a "Not now" text button in the action row instead. Never let buttons wrap onto a second line, centre them in a left-aligned card, or leave a close button floating beside them. `NudgeCard` and `ActionRow` in `components/library-nudges.tsx` follow this.
  Why: "Just basic UX stuff." Wrapped, centred buttons and a stray X made a card read as unfinished.
  The same holds for a page header's action on a phone (`components/public-list-view.tsx`): a single action spans the full width (`w-full sm:w-auto`) and nothing sits beside it, so a count such as "7 titles" shows only from `sm` up.
  <!-- 2026-11-17: "make it add to your slate and span it full width instead of like in the mobile view which we are seeing, instead of like 7 titles being there" (on the list page made by Slate) -->
  <!-- 2026-11-15: "The buttons should be in one row. If there's one button, it can take the full row. The close button should be at top right corner. If we don't want to add a close button, add a not now button. Just basic UX stuff. I think you did a good job, but very mediocre. You can do better." (on the Library prompt cards at phone width) -->
