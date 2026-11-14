"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useAccent } from "@/components/accent-provider";
import { SegmentedFilter } from "@/components/segmented-filter";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { ACCENTS } from "@/lib/accent-theme";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function ProfileAppearance({ index }: { index: number }) {
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  // The stored theme is only known in the browser; until then no segment is
  // marked, so the control never flashes the wrong choice.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <SettingsGroup label="Appearance" index={index}>
      <SettingsRow
        title="Theme"
      >
        <SegmentedFilter
          id="profile-theme"
          options={MODES}
          value={mounted ? (theme ?? "system") : ""}
          onValueChange={setTheme}
          className="shadow-none"
        />
      </SettingsRow>
      <SettingsRow
        title="Accent"
        description={
          ACCENTS.find((item) => item.id === accent)?.label ?? "Slate mint"
        }
        className="flex-wrap"
      >
        <div role="radiogroup" aria-label="Accent colour" className="flex gap-2">
          {ACCENTS.map((item) => {
            const active = item.id === accent;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={item.label}
                title={item.label}
                onClick={() => setAccent(item.id)}
                style={{ backgroundColor: item.swatch }}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full outline-none ring-offset-2 ring-offset-card transition-[transform,box-shadow] duration-150 ease-[var(--ease-ui-out)] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.92]",
                  active && "ring-2 ring-foreground/70",
                )}
              >
                <Check
                  aria-hidden
                  strokeWidth={3}
                  className={cn(
                    "h-3.5 w-3.5 text-black/75 transition-[opacity,transform] duration-150 ease-[var(--ease-ui-out)]",
                    active ? "opacity-100" : "scale-75 opacity-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </SettingsRow>
    </SettingsGroup>
  );
}
