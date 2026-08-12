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
