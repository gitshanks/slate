import Image from "next/image";
import Link from "next/link";
import { Users } from "lucide-react";
import { acceptSharedListInvite } from "@/lib/shared-list-actions";
import { getAppSession } from "@/lib/app-access";
import { resolveListInvite } from "@/lib/shared-lists";

export const dynamic = "force-dynamic";

export default async function JoinListPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const [session, invitation] = await Promise.all([
    getAppSession(),
    resolveListInvite(token),
  ]);

  if (!invitation) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
        <div className="w-full max-w-sm text-center">
          <Image src="/brand/logo-light.svg" alt="slate" width={76} height={22} className="mx-auto" />
          <h1 className="mt-10 text-2xl font-semibold tracking-tight">This invite has expired</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Ask the list owner for a new link.</p>
          <Link href={session?.user?.id ? "/lists" : "/"} className="mt-8 inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent">
            Back to slate
          </Link>
        </div>
      </main>
    );
  }

  async function join() {
    "use server";
    await acceptSharedListInvite(token);
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-5 text-foreground">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,hsl(var(--primary)/0.13),transparent_38%)]" />
      <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
        <Image src="/brand/logo-light.svg" alt="slate" width={76} height={22} />
        <div className="mt-12 grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
          <Users className="h-5 w-5" />
        </div>
        <p className="mt-6 text-xs text-muted-foreground">{invitation.owner?.displayName ?? "Someone"} invited you to</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">{invitation.list.name}</h1>
        {invitation.list.description ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{invitation.list.description}</p> : null}
        <p className="mt-8 text-sm leading-relaxed text-muted-foreground">You’ll be able to add, remove, and arrange titles together.</p>
        {session?.user?.id ? (
          <form action={join} className="mt-6">
            <button className="h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[filter,transform] hover:brightness-105 active:scale-[0.99]">Join list</button>
          </form>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(`/join/${token}`)}`} className="mt-6 flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[filter,transform] hover:brightness-105 active:scale-[0.99]">Continue to sign in</Link>
        )}
        <p className="mt-3 text-center text-[11px] text-muted-foreground">Private to the people invited.</p>
      </section>
    </main>
  );
}
