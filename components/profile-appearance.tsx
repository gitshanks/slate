"use client";

import * as React from "react";
import { useAccent } from "@/components/accent-provider";
import {
  AccentSwatches,
  THEME_MODES,
  useThemeSwitch,
} from "@/components/appearance-controls";
import { SegmentedFilter } from "@/components/segmented-filter";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { ACCENTS } from "@/lib/accent-theme";

export function ProfileAppearance({ index }: { index: number }) {
  const { theme, switchTheme } = useThemeSwitch();
  const { accent } = useAccent();
  // The stored theme is only known in the browser; until then no segment is
  // marked, so the control never flashes the wrong choice.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <SettingsGroup label="Appearance" index={index}>
      <SettingsRow title="Theme">
        <SegmentedFilter
          id="profile-theme"
          options={THEME_MODES}
          value={mounted ? (theme ?? "system") : ""}
          onValueChange={switchTheme}
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
        <AccentSwatches />
      </SettingsRow>
    </SettingsGroup>
  );
}
