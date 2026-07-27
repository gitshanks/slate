import Link from "next/link";
import {
  ArrowRight,
  Check,
  Cloud,
  Code2,
  Database,
  Server,
} from "lucide-react";
import { GithubMark } from "@/components/landing/icons";

export function SelfHost() {
  return (
    <section
      id="self-host"
      className="relative overflow-hidden bg-[#080809] text-white"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(167,139,250,0.12),transparent_28%)]" />
      <div className="landing-grain pointer-events-none absolute inset-0 opacity-10" />

      <div className="relative mx-auto max-w-[1440px] px-5 py-28 sm:px-8 sm:py-40 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:gap-20">
          <div>
            <p className="landing-kicker">No false choice</p>
            <h2 className="mt-5 max-w-[980px] text-balance text-[clamp(3rem,7vw,7.1rem)] font-semibold leading-[0.91] tracking-[-0.065em]">
              Use ours.
              <br />
              <span className="text-white/32">Or own every byte.</span>
            </h2>
          </div>
          <p className="max-w-md text-pretty text-base leading-relaxed text-white/52 sm:text-lg lg:pb-2">
            Sign in and start in seconds, or run the exact same app on your own
            infrastructure. Slate stays open source either way.
          </p>
        </div>

        <div className="mt-14 overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d0f] shadow-[0_40px_110px_rgba(0,0,0,0.4)] sm:mt-20 sm:rounded-[38px] lg:grid lg:grid-cols-[0.82fr_1.18fr]">
          <div className="flex flex-col border-b border-white/10 p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#bba6ff]">
              <Cloud className="h-5 w-5" />
            </div>
            <p className="mt-10 font-mono text-[9px] uppercase tracking-[0.24em] text-white/35">
              The easy path
            </p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              Hosted Slate
            </h3>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/48 sm:text-base">
              Google sign-in, a synced Neon library, and a shareable profile.
              No setup, maintenance, or server-shaped decisions.
            </p>

            <ul className="mt-7 space-y-3 text-sm text-white/58">
              {["Google account", "Private by default", "Public link on demand"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <Check className="h-3.5 w-3.5 text-[#a78bfa]" />
                    {item}
                  </li>
                ),
              )}
            </ul>

            <Link
              href="/login"
              className="group mt-10 inline-flex w-fit items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-[#c4b5fd]"
            >
              Start your slate
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="relative p-4 sm:p-6 lg:p-8">
            <div className="h-full overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#070708] sm:rounded-[26px]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                <div className="flex items-center gap-2 font-mono text-[10px] text-white/32">
                  <Server className="h-3.5 w-3.5" />
                  ~/slate
                </div>
                <a
                  href="https://github.com/gitshanks/slate"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[10px] text-white/42 transition-colors hover:text-white"
                >
                  <GithubMark className="h-3.5 w-3.5" />
                  View source
                </a>
              </div>

              <pre className="overflow-x-auto px-5 py-7 font-mono text-[11px] leading-[1.85] text-white/72 sm:px-8 sm:py-9 sm:text-[13px]">
                <code>
                  <span className="text-[#a78bfa]">$</span>{" "}
                  <span>git clone github.com/gitshanks/slate.git</span>
                  {"\n"}
                  <span className="text-[#a78bfa]">$</span>{" "}
                  <span>cd slate</span>
                  {"\n"}
                  <span className="text-[#a78bfa]">$</span>{" "}
                  <span>cp .env.example .env</span>
                  {"\n"}
                  <span className="text-[#a78bfa]">$</span>{" "}
                  <span>docker compose up -d</span>
                  {"\n\n"}
                  <span className="text-white/30"># Four services. One command.</span>
                  {"\n"}
                  <span className="text-emerald-400">✓</span>{" "}
                  <span className="text-white/50">postgres</span>
                  <span className="text-white/22">  your library</span>
                  {"\n"}
                  <span className="text-emerald-400">✓</span>{" "}
                  <span className="text-white/50">postgrest</span>
                  <span className="text-white/22">  your API</span>
                  {"\n"}
                  <span className="text-emerald-400">✓</span>{" "}
                  <span className="text-white/50">caddy</span>
                  <span className="text-white/22">     your door</span>
                  {"\n"}
                  <span className="text-emerald-400">✓</span>{" "}
                  <span className="text-white/50">slate</span>
                  <span className="text-white/22">     ready on :3000</span>
                </code>
              </pre>

              <div className="grid grid-cols-2 border-t border-white/[0.07] sm:grid-cols-3">
                <TechStat icon={Database} label="Database" value="Postgres" />
                <TechStat icon={Server} label="Deploy" value="Docker" />
                <div className="hidden sm:block">
                  <TechStat icon={Code2} label="License" value="MIT" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TechStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="border-r border-white/[0.07] px-5 py-4 last:border-r-0 sm:px-6">
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/27">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1.5 text-xs font-medium text-white/65">{value}</p>
    </div>
  );
}
