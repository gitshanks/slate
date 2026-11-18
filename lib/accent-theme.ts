export const ACCENTS = [
  { id: "mint",    label: "Slate mint", swatch: "#ADEBB3" },
  { id: "indigo",  label: "Indigo",  swatch: "hsl(231 48% 52%)" },
  { id: "sky",     label: "Sky",     swatch: "hsl(199 89% 42%)" },
  { id: "emerald", label: "Emerald", swatch: "hsl(160 84% 34%)" },
  { id: "rose",    label: "Rose",    swatch: "hsl(347 77% 52%)" },
  { id: "amber",   label: "Amber",   swatch: "hsl(38 96% 50%)"  },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];
export const DEFAULT_ACCENT: AccentId = "mint";
export const ACCENT_STORAGE_KEY = "slate-accent";

type Hsl = readonly [number, number, number];

/**
 * Each accent's `--primary` and `--primary-foreground`, as set in
 * app/globals.css (`html.accent-*`), so a slider can blend between them live
 * and land exactly on the stylesheet's colour. Keep the two in step.
 */
export const ACCENT_PRIMARY: Record<
  AccentId,
  { light: Hsl; dark: Hsl; inkLight: Hsl; inkDark: Hsl }
> = {
  mint:    { light: [126, 38, 37], dark: [126, 61, 80], inkLight: [0, 0, 100], inkDark: [132, 36, 9] },
  indigo:  { light: [231, 48, 52], dark: [231, 70, 70], inkLight: [0, 0, 100], inkDark: [132, 36, 9] },
  sky:     { light: [199, 89, 42], dark: [199, 89, 62], inkLight: [0, 0, 100], inkDark: [132, 36, 9] },
  emerald: { light: [160, 84, 34], dark: [160, 84, 50], inkLight: [0, 0, 100], inkDark: [132, 36, 9] },
  rose:    { light: [347, 77, 52], dark: [347, 77, 65], inkLight: [0, 0, 100], inkDark: [132, 36, 9] },
  amber:   { light: [38, 96, 50],  dark: [38, 96, 58],  inkLight: [30, 15, 10], inkDark: [30, 15, 8] },
};

/**
 * Accents in hue order, so a track through them blends: Slate mint first,
 * through the greens and blues to the warm end.
 */
export const ACCENT_ORDER: readonly AccentId[] = [
  "mint",
  "emerald",
  "sky",
  "indigo",
  "rose",
  "amber",
];
