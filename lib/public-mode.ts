// Hosted account mode powers slate.nishh.dev. The flag is intentionally
// public: it changes routing/UI only and contains no secret. Authentication
// is still verified on the server.
export const SLATE_HOSTED =
  process.env.NEXT_PUBLIC_SLATE_HOSTED === "1";

// Public-portfolio mode is mutually exclusive with hosted accounts. Hosted
// mode deliberately wins if an older Vercel project still has both flags:
// otherwise profile provisioning would select the cookie-backed demo client
// and reject the real `profiles` table during Google sign-in.
export const SLATE_PUBLIC =
  !SLATE_HOSTED && process.env.NEXT_PUBLIC_DEMO_MODE === "1";

// Where internal "go home" links should point. Use this for the logo, the
// "Back to slate" CTA on the share fallback, and post-mutation redirects.
export const APP_ROOT = SLATE_PUBLIC || SLATE_HOSTED ? "/app" : "/";
