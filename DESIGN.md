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
