import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "@/components/theme-provider";
import { AccentProvider } from "@/components/accent-provider";
import { SonnerToaster } from "@/components/ui/sonner";
import { UpdateBanner } from "@/components/update-banner";
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT } from "@/lib/accent-theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "slate · your watchlist",
  description: "A private Letterboxd for the things you want to watch.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">
        {/* Apply saved accent class before React hydrates to avoid FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var a=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});if(a&&a!==${JSON.stringify(DEFAULT_ACCENT)})document.documentElement.classList.add("accent-"+a);}catch(e){}})()`,
          }}
        />
        <MotionConfig reducedMotion="user">
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <AccentProvider>
              {children}
              <SonnerToaster />
              <UpdateBanner />
            </AccentProvider>
          </ThemeProvider>
        </MotionConfig>
        <Script src="https://mcp.figma.com/mcp/html-to-design/capture.js" strategy="lazyOnload" />
      </body>
    </html>

  );
}
