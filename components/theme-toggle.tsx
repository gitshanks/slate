"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccent } from "@/components/accent-provider";
import { ACCENTS } from "@/lib/accent-theme";

const MODES = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light",  label: "Light",  icon: Sun },
  { value: "dark",   label: "Dark",   icon: Moon },
] as const;

function modeIcon(theme: string | undefined) {
  if (theme === "light") return Sun;
  if (theme === "dark") return Moon;
  return Monitor;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const Icon = mounted ? modeIcon(theme) : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Customize appearance"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-accent",
            className
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Appearance
        </DropdownMenuLabel>

        {MODES.map(({ value, label, icon: ItemIcon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="flex items-center gap-2"
          >
            <ItemIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{label}</span>
            {mounted && theme === value && (
              <Check className="ml-auto h-3.5 w-3.5 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Color
        </DropdownMenuLabel>

        {/* Color swatches — plain buttons so clicking doesn't close the menu */}
        <div className="flex gap-1.5 px-2 pb-2 pt-0.5">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              title={a.label}
              aria-label={a.label}
              onClick={() => mounted && setAccent(a.id)}
              className={cn(
                "h-5 w-5 rounded-full ring-offset-2 ring-offset-popover transition-all",
                mounted && accent === a.id
                  ? "ring-2 ring-foreground scale-110"
                  : "hover:scale-110 hover:ring-2 hover:ring-foreground/30"
              )}
              style={{ background: a.swatch }}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
