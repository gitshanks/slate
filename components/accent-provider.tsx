"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ACCENTS,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  type AccentId,
} from "@/lib/accent-theme";

interface AccentContextValue {
  accent: AccentId;
  setAccent: (id: AccentId) => void;
}

const AccentContext = createContext<AccentContextValue>({
  accent: DEFAULT_ACCENT,
  setAccent: () => {},
});

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>(DEFAULT_ACCENT);

  // Hydrate from localStorage on mount (the inline script in layout already
  // applied the class to avoid FOUC; we just sync React state here).
  useEffect(() => {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentId | null;
    if (saved && ACCENTS.some((a) => a.id === saved)) {
      setAccentState(saved);
    }
  }, []);

  // Keep html class in sync with React state on every change.
  useEffect(() => {
    const html = document.documentElement;
    [...html.classList].forEach((cls) => {
      if (cls.startsWith("accent-")) html.classList.remove(cls);
    });
    if (accent !== DEFAULT_ACCENT) html.classList.add(`accent-${accent}`);
  }, [accent]);

  function setAccent(id: AccentId) {
    setAccentState(id);
    localStorage.setItem(ACCENT_STORAGE_KEY, id);
  }

  return (
    <AccentContext.Provider value={{ accent, setAccent }}>
      {children}
    </AccentContext.Provider>
  );
}

export function useAccent() {
  return useContext(AccentContext);
}
