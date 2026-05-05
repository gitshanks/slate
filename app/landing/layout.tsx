// Standalone layout for the public marketing page. Skips the app shell
// (TopNav, CommandPalette, etc.) so the landing renders against pure
// design-token surfaces.
export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="relative isolate min-h-dvh overflow-clip">{children}</div>;
}
