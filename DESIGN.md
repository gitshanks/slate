# Slate design rules

Rules learned from corrections on this project. Read this before any UI work. Each rule covers a kind of component, uses the project's own tokens, and carries the reason and the words that prompted it.

## Motion

- **A selector that flows is one thick body in the theme colour.** When an indicator moves like liquid (the dock selector in `components/dock-liquid.tsx`), draw it as a single continuous shape filled with `--primary`, with its label in `--primary-foreground`. No separate beads strung behind it, no connecting thread thinner than about half the selector's height, no metal or other material outside the theme, and edges that stay smooth when captured at 3×.
  Why: the first version, a chrome bead trailing a string of smaller ones, "look[ed] extremely chunky".
  <!-- 2026-11-14: "The work you did on the bar at the bottom look extremely chunky. Make it polished and smooth as fuck... we need it to be blobby, thick liquid which is flowing between them, so it should take color of like the theme. So think of it as like jello, rather than metal" -->
