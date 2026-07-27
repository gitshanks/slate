// Public-portfolio mode flag. When NEXT_PUBLIC_DEMO_MODE=1 a marketing
// landing page is mounted at / via rewrites in next.config.ts and the app
// itself is reachable at /app.
export const SLATE_PUBLIC = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

// Hosted account mode powers slate.nishh.dev. The flag is intentionally
// public: it changes routing/UI only and contains no secret. Authentication
// is still verified on the server.
export const SLATE_HOSTED =
  process.env.NEXT_PUBLIC_SLATE_HOSTED === "1";

// Where internal "go home" links should point. Use this for the logo, the
// "Back to slate" CTA on the share fallback, and post-mutation redirects.
export const APP_ROOT = SLATE_PUBLIC || SLATE_HOSTED ? "/app" : "/";
