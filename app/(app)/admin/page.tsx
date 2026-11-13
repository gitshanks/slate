import type { Metadata } from "next";
import Image from "next/image";
import { ColumnChart } from "@/components/admin/column-chart";
import { EmptyState } from "@/components/empty-state";
import { BarChart3 } from "lucide-react";
import { getInsights, requireAdmin, type Insight, type TitleStat } from "@/lib/admin-insights";
import { posterUrl } from "@/lib/tmdb-image";

export const metadata: Metadata = {
  title: "slate · Insights",
  robots: { index: false, follow: false },
};

const POSTHOG_UI = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST?.trim() || "https://us.posthog.com";
const POSTHOG_ON = Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const weekdayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function pct(part: number, whole: number) {
  return whole ? `${Math.round((part / whole) * 100)}%` : "0%";
}

function ago(iso: string | null) {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return dayFmt.format(new Date(iso));
}

function delta(now: number, before: number) {
  if (now === before) return "same as last week";
  return `${now > before ? "up" : "down"} from ${before} last week`;
}

export default async function AdminInsightsPage() {
  const { viewerId } = await requireAdmin();

  if (!process.env.DATABASE_URL) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-6 w-6" />}
        title="Insights need the Postgres backend"
        description="Set DATABASE_URL to read usage straight from the database."
      />
    );
  }

  const d = await getInsights(viewerId);
  const t = d.totals;
  const first = d.signupsByDay[0]?.day;
  const totalTitles = d.mediaSplit.movie + d.mediaSplit.tv;

  return (
    <div className="space-y-12 pb-16">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Insights</h1>
        <p className="mt-2 text-muted-foreground">
          Who uses Slate, what they watch and where they came from.
          {viewerId ? " Your own account is left out." : ""} Updated{" "}
          {weekdayFmt.format(new Date(d.generatedAt))}, {new Date(d.generatedAt).toISOString().slice(11, 16)} UTC.
        </p>
      </header>

      <section aria-label="Headline numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="People" value={t.users} note={`${t.new7} joined in the last 7 days`} />
        <Stat label="Active this week" value={t.active7} note={delta(t.active7, t.activePrev7)} />
        <Stat label="Active in 30 days" value={t.active30} note={`${pct(t.active30, t.users)} of everyone`} />
        <Stat label="Titles saved" value={t.titles} note={`median library: ${t.medianTitles}`} />
      </section>

      <Section title="What to do next" note="Rules over the numbers below, most limiting first.">
        <ol className="grid gap-3 md:grid-cols-2">
          {d.insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </ol>
      </Section>

      <Section title="Signups" note="New accounts per day, last 90 days (UTC).">
        <Panel>
          <ColumnChart
            data={d.signupsByDay.map((s) => ({
              key: s.day,
              label: weekdayFmt.format(new Date(s.day)),
              value: s.count,
            }))}
            unit={["signup", "signups"]}
            caption="Signups per day over the last 90 days"
            startLabel={first ? dayFmt.format(new Date(first)) : ""}
            endLabel="today"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {t.new30} in the last 30 days. {t.new7} this week against {t.newPrev7} the week before.
          </p>
        </Panel>
      </Section>

      <Section
        title="Where they came from"
        note="First visit before signing up. Saved a title and came back show which sources bring people who stay."
      >
        <Panel flush>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-normal">Source</th>
                <th className="px-4 py-2.5 text-right font-normal">Signups</th>
                <th className="px-4 py-2.5 text-right font-normal">Saved a title</th>
                <th className="hidden px-4 py-2.5 text-right font-normal sm:table-cell">Came back</th>
              </tr>
            </thead>
            <tbody>
              {d.sources.map((s) => (
                <tr key={s.source} className="border-b border-border last:border-0">
                  <td className={`px-4 py-2.5 ${s.source === "not recorded" ? "text-muted-foreground" : ""}`}>
                    {s.source}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{s.signups}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{pct(s.activated, s.signups)}</td>
                  <td className="hidden px-4 py-2.5 text-right font-mono tabular-nums sm:table-cell">
                    {pct(s.returned, s.signups)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        {d.campaigns.length > 0 ? (
          <Panel flush className="mt-3">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 font-normal">Campaign</th>
                  <th className="px-4 py-2.5 text-right font-normal">Signups</th>
                  <th className="px-4 py-2.5 text-right font-normal">Saved a title</th>
                </tr>
              </thead>
              <tbody>
                {d.campaigns.map((c) => (
                  <tr key={`${c.source}-${c.campaign}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      {c.campaign} <span className="text-muted-foreground">on {c.source}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{c.signups}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{pct(c.activated, c.signups)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ) : null}
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Tag each link you post so every video gets its own row:{" "}
          <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            s1ate.space/?utm_source=instagram&amp;utm_campaign=film-115
          </code>
          . Taps inside Instagram, TikTok and Threads are recognised even without tags.
        </p>
      </Section>

      <div className="grid gap-12 lg:grid-cols-2">
        <Section title="From signup to habit" note="How far everyone has got.">
          <Panel>
            <ol className="space-y-3">
              {d.funnel.map((step) => (
                <li key={step.label}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{step.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {step.count}{" "}
                      <span className="text-foreground">{pct(step.count, d.funnel[0].count)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: pct(step.count, d.funnel[0].count) }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </Section>

        <Section title="Weekly active people" note="Anyone who saved, watched, listed or opened the app that week.">
          <Panel>
            <ColumnChart
              data={d.activeByWeek.map((w) => ({
                key: w.week,
                label: `Week of ${dayFmt.format(new Date(w.week))}`,
                value: w.count,
              }))}
              unit={["person", "people"]}
              caption="Weekly active people over the last 12 weeks"
              startLabel={dayFmt.format(new Date(d.activeByWeek[0].week))}
              endLabel="this week"
            />
          </Panel>
        </Section>
      </div>

      <Section
        title="Do they stick?"
        note="People who joined in each week, and how many were active one to four weeks later."
      >
        <Panel flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 font-normal">Joined week of</th>
                  <th className="px-4 py-2.5 text-right font-normal">People</th>
                  {[1, 2, 3, 4].map((w) => (
                    <th key={w} className="px-4 py-2.5 text-right font-normal">
                      Week {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.cohorts.map((c) => (
                  <tr key={c.week} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{dayFmt.format(new Date(c.week))}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{c.size}</td>
                    {c.weeks.map((value, i) => (
                      <td
                        key={i}
                        className="px-4 py-2.5 text-right font-mono tabular-nums"
                        style={
                          value !== null && c.size
                            ? { backgroundColor: `hsl(var(--primary) / ${(value / c.size) * 0.35})` }
                            : undefined
                        }
                      >
                        {value === null || !c.size ? null : pct(value, c.size)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      <Section title="What they're watching" note="Across every library except yours.">
        <div className="grid gap-3 md:grid-cols-3">
          <TitleList heading="Most saved" items={d.mostSaved} unit={["person", "people"]} />
          <TitleList heading="Watching right now" items={d.watchingNow} unit={["person", "people"]} />
          <TitleList heading="Added in the last 30 days" items={d.trending} unit={["save", "saves"]} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Panel>
            <h3 className="text-sm text-muted-foreground">Top genres</h3>
            <ol className="mt-3 space-y-2.5">
              {d.genres.map((g) => (
                <li key={g.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{g.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {g.count} saves, {g.people} {g.people === 1 ? "person" : "people"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${(g.count / (d.genres[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel>
            <h3 className="text-sm text-muted-foreground">Library shape</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Fact label="Movies" value={d.mediaSplit.movie} whole={totalTitles} />
              <Fact label="TV shows" value={d.mediaSplit.tv} whole={totalTitles} />
              <Fact label="Want to watch" value={d.statusSplit.want} whole={totalTitles} />
              <Fact label="Watching" value={d.statusSplit.watching} whole={totalTitles} />
              <Fact label="Watched" value={d.statusSplit.watched} whole={totalTitles} />
              <Fact label="Dropped" value={d.statusSplit.dropped} whole={totalTitles} />
            </dl>
          </Panel>
        </div>
      </Section>

      <Section title="Features people use" note={`Out of ${t.users} ${t.users === 1 ? "person" : "people"}.`}>
        <Panel>
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {d.features.map((f) => (
              <li key={f.label} className="flex items-baseline justify-between gap-3 border-b border-border pb-2.5 text-sm">
                <span>{f.label}</span>
                <span className="font-mono tabular-nums">
                  {f.count} <span className="text-muted-foreground">{pct(f.count, t.users)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </Section>

      <Section title="People" note="Newest first. Names and usernames only.">
        <Panel flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 font-normal">Name</th>
                  <th className="px-4 py-2.5 font-normal">Joined</th>
                  <th className="px-4 py-2.5 font-normal">Source</th>
                  <th className="px-4 py-2.5 text-right font-normal">Titles</th>
                  <th className="px-4 py-2.5 text-right font-normal">Watched</th>
                  <th className="px-4 py-2.5 text-right font-normal">Last active</th>
                </tr>
              </thead>
              <tbody>
                {d.people.slice(0, 50).map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      {p.name} <span className="text-muted-foreground">@{p.username}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{dayFmt.format(new Date(p.joinedAt))}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.source}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{p.titles}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{p.watched}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{ago(p.lastActiveAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      {POSTHOG_ON ? (
        <p className="text-sm text-muted-foreground">
          For clicks, page views and session replays of people who accepted analytics, open{" "}
          <a
            href={POSTHOG_UI}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4 hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            PostHog
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {note ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Panel({
  children,
  flush,
  className = "",
}: {
  children: React.ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card/60 ${flush ? "overflow-hidden" : "p-4 sm:p-5"} ${className}`}>
      {children}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-4 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

const TONE: Record<Insight["tone"], { label: string; className: string }> = {
  fix: { label: "Fix", className: "bg-destructive/10 text-destructive" },
  grow: { label: "Grow", className: "bg-primary/15 text-foreground" },
  keep: { label: "Good to know", className: "bg-muted text-muted-foreground" },
};

function InsightCard({ insight }: { insight: Insight }) {
  const tone = TONE[insight.tone];
  return (
    <li className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${tone.className}`}>{tone.label}</span>
      <h3 className="mt-2 font-medium">{insight.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{insight.body}</p>
    </li>
  );
}

function TitleList({
  heading,
  items,
  unit,
}: {
  heading: string;
  items: TitleStat[];
  unit: [string, string];
}) {
  return (
    <Panel>
      <h3 className="text-sm text-muted-foreground">{heading}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ol className="mt-3 space-y-2.5">
          {items.map((item) => (
            <li key={`${item.mediaType}-${item.tmdbId}`} className="flex items-center gap-3">
              <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-muted">
                {item.posterPath ? (
                  <Image src={posterUrl(item.posterPath, "w92")!} alt="" fill sizes="32px" className="object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.mediaType === "tv" ? "TV" : "Movie"}, {item.value} {item.value === 1 ? unit[0] : unit[1]}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Fact({ label, value, whole }: { label: string; value: number; whole: number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-lg tabular-nums">
        {value} <span className="text-sm text-muted-foreground">{pct(value, whole)}</span>
      </dd>
    </div>
  );
}
