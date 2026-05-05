// Public-portfolio mode flag. When NEXT_PUBLIC_DEMO_MODE=1 a marketing
// landing page is mounted at / via rewrites in next.config.ts and the app
// itself is reachable at /app. Same flag also opens the passcode gate and
// flips Supabase to the live read-only path — one var configures the whole
// public deploy. Self-host default leaves the watchlist at /.
export const SLATE_PUBLIC = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

// Where internal "go home" links should point. Use this for the logo, the
// "Back to slate" CTA on the share fallback, and post-mutation redirects.
export const APP_ROOT = SLATE_PUBLIC ? "/app" : "/";
