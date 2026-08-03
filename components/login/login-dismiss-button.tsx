"use client";

import { useRouter } from "next/navigation";

export function LoginDismissButton({ className }: { className: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      aria-label="Back to slate"
      tabIndex={-1}
      onClick={() =>
        router.replace("/", {
          scroll: false,
          transitionTypes: ["slate-auth-back"],
        })
      }
    />
  );
}
