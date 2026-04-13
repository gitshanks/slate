"use client";

import * as React from "react";

type Direction = "left" | "right";

const NavDirectionContext = React.createContext<{
  direction: Direction;
  setDirection: (d: Direction) => void;
}>({
  direction: "left",
  setDirection: () => {},
});

export function NavDirectionProvider({ children }: { children: React.ReactNode }) {
  const [direction, setDirection] = React.useState<Direction>("left");
  return (
    <NavDirectionContext.Provider value={{ direction, setDirection }}>
      {children}
    </NavDirectionContext.Provider>
  );
}

export function useNavDirection() {
  return React.useContext(NavDirectionContext);
}
