// Canonical public origin used for share links and social preview metadata.
// Single source of truth so every surface falls back to the same host.
export function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://s1ate.space"
  );
}
