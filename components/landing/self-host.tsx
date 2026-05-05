import { Server, Database, Lock, Zap } from "lucide-react";

export function SelfHost() {
  return (
    <section className="relative border-t border-border/60 bg-background">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
              Self-host in five minutes
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Your library, your machine, your rules.
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">
              Slate is built to be self-hosted. One docker-compose file spins up
              the whole stack on your box (Postgres, PostgREST, the app) and
              keeps every byte of your library under your roof.
            </p>

            <ul className="mt-8 space-y-4">
              {POINTS.map((p) => (
                <li key={p.title} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
                    <p.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {p.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <TerminalMock />
        </div>
      </div>
    </section>
  );
}

const POINTS = [
  {
    icon: Server,
    title: "One docker-compose, three services.",
    body: "Postgres, PostgREST, and the Next.js app, wired through Caddy so the Supabase client works unchanged.",
  },
  {
    icon: Database,
    title: "Your data lives in a named volume.",
    body: "pg_dump for backups. docker compose down -v to wipe. No vendor lock-in, no cloud egress bills.",
  },
  {
    icon: Lock,
    title: "Passcode-gated by default.",
    body: "Set APP_PASSCODE in .env to lock the app behind a shared cookie. Multi-user? Swap in Supabase Auth + RLS.",
  },
  {
    icon: Zap,
    title: "Or one-click on Vercel.",
    body: "Same repo. Vercel + Supabase deployment in five minutes. The schema is a single SQL file.",
  },
];

function TerminalMock() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-border bg-[#0a0a0b] text-[#e5e5e7] shadow-2xl shadow-primary/10 ring-1 ring-foreground/5">
        <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/[0.02] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="ml-3 font-mono text-[11px] text-white/40">
            ~/slate · zsh
          </span>
        </div>
        <pre className="overflow-x-auto px-5 py-5 font-mono text-[12px] leading-relaxed sm:text-[13px]">
          <code>
            <span className="text-emerald-400">$</span>{" "}
            <span className="text-white">git clone github.com/gitshanks/slate.git</span>
            {"\n"}
            <span className="text-emerald-400">$</span>{" "}
            <span className="text-white">cd slate</span>
            {"\n"}
            <span className="text-emerald-400">$</span>{" "}
            <span className="text-white">cp .env.example .env</span>
            <span className="text-white/40">  # add TMDB + OMDB keys</span>
            {"\n"}
            <span className="text-emerald-400">$</span>{" "}
            <span className="text-white">docker compose up -d</span>
            {"\n\n"}
            <span className="text-white/60">[+] Running 4/4</span>
            {"\n"}
            <span className="text-emerald-400"> ✔</span>{" "}
            <span className="text-white/80">postgres   Started</span>
            {"\n"}
            <span className="text-emerald-400"> ✔</span>{" "}
            <span className="text-white/80">postgrest  Started</span>
            {"\n"}
            <span className="text-emerald-400"> ✔</span>{" "}
            <span className="text-white/80">caddy      Started</span>
            {"\n"}
            <span className="text-emerald-400"> ✔</span>{" "}
            <span className="text-white/80">slate      Started</span>
            {"\n\n"}
            <span className="text-white/40"># http://localhost:3000, done.</span>
          </code>
        </pre>
      </div>
      <div
        aria-hidden
        className="absolute -bottom-8 left-12 right-12 -z-10 h-24 rounded-full bg-primary/25 blur-3xl"
      />
    </div>
  );
}
