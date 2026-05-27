// Standalone layout for the public marketing page. Skips the app shell
// (TopNav, CommandPalette, etc.) so the landing renders against pure
// design-token surfaces.
//
// The .dark class forces the dark CSS variables for the whole landing
// subtree regardless of the user's chosen theme — the marketing page
// is always presented in the cinematic dark variant.
export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark bg-background text-foreground relative isolate min-h-dvh overflow-clip">
      {children}
    </div>
  );
}
