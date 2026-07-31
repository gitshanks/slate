import { Instrument_Serif } from "next/font/google";

const instrumentSerif = Instrument_Serif({
  variable: "--font-landing-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

// Standalone layout for the public marketing page. Skips the app shell
// (TopNav, CommandPalette, etc.) so the landing renders against pure
// design-token surfaces.
//
// The .dark class forces the dark CSS variables for the whole landing
// subtree regardless of the user's chosen theme. The marketing page
// is always presented in the cinematic dark variant.
export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${instrumentSerif.variable} landing-shell dark relative isolate min-h-dvh overflow-clip bg-[#0c0a08] text-[#f3eadc]`}
    >
      {children}
    </div>
  );
}
