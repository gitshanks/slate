"use client";

export default function Error({ reset }: { reset: () => void }) {
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
    <h1 className="text-3xl font-semibold tracking-tight">A brief intermission</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">We couldn&apos;t load this recommendation. Give it another try.</p>
    <button type="button" onClick={reset} className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Try again</button>
  </main>;
}
