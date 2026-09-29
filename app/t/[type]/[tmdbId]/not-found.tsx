import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
    <h1 className="text-3xl font-semibold tracking-tight">This title is unavailable</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">The recommendation may have moved or the link may be incomplete.</p>
    <Link href="/" className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Explore slate</Link>
  </main>;
}
