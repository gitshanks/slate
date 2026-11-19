"use client";

import { useAccent } from "@/components/accent-provider";
import { AccentSlider } from "@/components/accent-slider";
import { ThemeSlider } from "@/components/appearance-controls";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { ACCENTS } from "@/lib/accent-theme";

export function ProfileAppearance({ index }: { index: number }) {
  const { accent } = useAccent();

  return (
    <SettingsGroup label="Appearance" index={index}>
      <SettingsRow title="Theme" className="flex-wrap gap-y-3">
        <ThemeSlider className="w-[17rem]" />
      </SettingsRow>
      <SettingsRow
        title="Accent"
        description={
          ACCENTS.find((item) => item.id === accent)?.label ?? "Slate mint"
        }
        className="flex-wrap gap-y-3"
      >
        <AccentSlider className="w-[17rem]" />
      </SettingsRow>
    </SettingsGroup>
  );
}
