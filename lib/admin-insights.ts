import "server-only";

import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-access";
import { runNeonQuery } from "@/lib/neon-client";
import { SLATE_HOSTED } from "@/lib/public-mode";

const DAY = 86_400_000;

/**
 * Hosted: only emails listed in SLATE_ADMIN_EMAILS (comma separated) can open
 * the insights page; everyone else gets a 404, so the route is not advertised.
 * Self-hosted: the single owner is the admin.
 */
export async function requireAdmin(): Promise<{ viewerId: string | null }> {
  if (!SLATE_HOSTED) return { viewerId: null };
  const session = await getAppSession();
  const email = session?.user?.email?.trim().toLowerCase();
  const admins = (process.env.SLATE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!session?.user?.id || !email || !admins.includes(email)) notFound();
  return { viewerId: session.user.id };
}

export function isAdminEmail(email: string | null | undefined) {
  if (!SLATE_HOSTED || !email) return false;
  const admins = (process.env.SLATE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase());
  return admins.includes(email.trim().toLowerCase());
}

// Everything a person does that leaves a timestamp. titles.updated_at is left
// out on purpose: background rating refreshes bump it without the person
// doing anything.
const ACTIVITY_CTE = `
  people as (
    select id, created_at, onboarding_completed_at, is_public, display_name, username
    from profiles
    where id <> $1
  ),
  activity as (
    select owner_id, added_at as at from titles
    union all select owner_id, watched_at from titles where watched_at is not null
    union all select owner_id, added_at from list_titles
    union all select owner_id, watched_at from watched_episodes
    union all select owner_id, created_at from lists
    union all select owner_id, last_used_at from device_sessions
    union all select owner_id, updated_at from preview_feedback
  )
`;

interface PersonRow extends Record<string, unknown> {
  id: string;
  created_at: Date;
  onboarding_completed_at: Date | null;
  is_public: boolean;
  display_name: string;
  username: string;
  titles: number;
  watched: number;
  watching: number;
  lists: number;
  shared_lists: number;
  episodes: number;
  previews: boolean;
  platforms: string[] | null;
  first_device_at: Date | null;
  last_at: Date | null;
  returned: boolean;
  source: string | null;
  campaign: string | null;
}

export interface Person {
  id: string;
  name: string;
  username: string;
  joinedAt: string;
  onboarded: boolean;
  isPublic: boolean;
  titles: number;
  watched: number;
  watching: number;
  lists: number;
  sharedLists: number;
  episodes: number;
  previews: boolean;
  platforms: string[];
  lastActiveAt: string | null;
  returned: boolean;
  source: string;
  campaign: string | null;
}

export interface TitleStat {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  people: number;
  value: number;
}

export interface Insight {
  tone: "fix" | "grow" | "keep";
  title: string;
  body: string;
}

export interface Insights {
  generatedAt: string;
  sourcesTracked: boolean;
  people: Person[];
  totals: {
    users: number;
    new7: number;
    newPrev7: number;
    new30: number;
    active7: number;
    activePrev7: number;
    active30: number;
    titles: number;
    medianTitles: number;
  };
  signupsByDay: { day: string; count: number }[];
  activeByWeek: { week: string; count: number }[];
  funnel: { label: string; count: number }[];
  cohorts: { week: string; size: number; weeks: (number | null)[] }[];
  sources: {
    source: string;
    signups: number;
    activated: number;
    returned: number;
  }[];
  campaigns: { source: string; campaign: string; signups: number; activated: number }[];
  features: { label: string; count: number }[];
  mostSaved: TitleStat[];
  watchingNow: TitleStat[];
  trending: TitleStat[];
  genres: { name: string; count: number; people: number }[];
  mediaSplit: { movie: number; tv: number };
  statusSplit: { want: number; watching: number; watched: number; dropped: number };
  insights: Insight[];
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekStart(date: Date) {
  // Monday, UTC, matching Postgres date_trunc('week').
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - offset * DAY);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function tableExists(name: string) {
  const rows = await runNeonQuery<{ exists: boolean }>(
    "select to_regclass($1) is not null as exists",
    [name],
  );
  return Boolean(rows[0]?.exists);
}

const titleStatSql = (valueExpr: string, where = "true") => `
  select tmdb_id, media_type, max(title) as title, max(poster_path) as poster_path,
         count(distinct owner_id)::int as people, (${valueExpr})::int as value
  from titles
  where owner_id in (select id from profiles where id <> $1) and ${where}
  group by tmdb_id, media_type
  having (${valueExpr}) > 0
  order by value desc, people desc, max(added_at) desc
  limit 8
`;

function toTitleStats(rows: Record<string, unknown>[]): TitleStat[] {
  return rows.map((row) => ({
    tmdbId: Number(row.tmdb_id),
    mediaType: row.media_type === "tv" ? "tv" : "movie",
    title: String(row.title),
    posterPath: (row.poster_path as string | null) ?? null,
    people: Number(row.people),
    value: Number(row.value),
  }));
}

export async function getInsights(viewerId: string | null): Promise<Insights> {
  const exclude = viewerId ?? "";
  const sourcesTracked = await tableExists("signup_sources");
  const sourceJoin = sourcesTracked
    ? "left join signup_sources src on src.owner_id = p.id"
    : "left join (select null::text as owner_id, null::text as source, null::text as campaign) src on false";

  const [peopleRows, weeklyRows, mostSaved, watchingNow, trending, genreRows, splitRows] =
    await Promise.all([
      runNeonQuery<PersonRow>(
        `with ${ACTIVITY_CTE},
        lib as (
          select owner_id, count(*)::int as titles,
                 count(*) filter (where status = 'watched')::int as watched,
                 count(*) filter (where status = 'watching')::int as watching
          from titles group by owner_id
        ),
        owned_lists as (select owner_id, count(*)::int as lists from lists group by owner_id),
        shared as (
          select l.owner_id, count(distinct l.id)::int as shared_lists
          from lists l join list_members m on m.list_id = l.id group by l.owner_id
        ),
        eps as (select owner_id, count(*)::int as episodes from watched_episodes group by owner_id),
        devices as (
          select owner_id, array_agg(distinct platform) as platforms, min(created_at) as first_device_at
          from device_sessions group by owner_id
        ),
        last_seen as (select owner_id, max(at) as last_at from activity group by owner_id),
        came_back as (
          select distinct a.owner_id
          from activity a join people p on p.id = a.owner_id
          where a.at >= p.created_at + interval '1 day'
        )
        select p.id, p.created_at, p.onboarding_completed_at, p.is_public, p.display_name, p.username,
               coalesce(lib.titles, 0) as titles, coalesce(lib.watched, 0) as watched,
               coalesce(lib.watching, 0) as watching, coalesce(ol.lists, 0) as lists,
               coalesce(sh.shared_lists, 0) as shared_lists, coalesce(eps.episodes, 0) as episodes,
               exists (select 1 from preview_feedback pf where pf.owner_id = p.id) as previews,
               d.platforms, d.first_device_at, ls.last_at, (cb.owner_id is not null) as returned,
               src.source, src.campaign
        from people p
        left join lib on lib.owner_id = p.id
        left join owned_lists ol on ol.owner_id = p.id
        left join shared sh on sh.owner_id = p.id
        left join eps on eps.owner_id = p.id
        left join devices d on d.owner_id = p.id
        left join last_seen ls on ls.owner_id = p.id
        left join came_back cb on cb.owner_id = p.id
        ${sourceJoin}
        order by p.created_at desc`,
        [exclude],
      ),
      runNeonQuery<{ owner_id: string; week: Date }>(
        `with ${ACTIVITY_CTE}
        select a.owner_id, date_trunc('week', a.at) as week
        from activity a
        where a.owner_id in (select id from people) and a.at > now() - interval '30 weeks'
        group by 1, 2`,
        [exclude],
      ),
      runNeonQuery(titleStatSql("count(distinct owner_id)"), [exclude]),
      runNeonQuery(titleStatSql("count(*) filter (where status = 'watching')"), [exclude]),
      runNeonQuery(
        titleStatSql("count(*) filter (where added_at > now() - interval '30 days')"),
        [exclude],
      ),
      runNeonQuery<{ name: string; count: number; people: number }>(
        `select g->>'name' as name, count(*)::int as count, count(distinct t.owner_id)::int as people
         from titles t
         cross join lateral jsonb_array_elements(
           case when jsonb_typeof(t.genres) = 'array' then t.genres else '[]'::jsonb end
         ) g
         where t.owner_id in (select id from profiles where id <> $1) and g->>'name' is not null
         group by 1 order by count desc limit 10`,
        [exclude],
      ),
      runNeonQuery<{ media_type: string; status: string; count: number }>(
        `select media_type, status, count(*)::int as count from titles
         where owner_id in (select id from profiles where id <> $1)
         group by 1, 2`,
        [exclude],
      ),
    ]);

  const now = Date.now();
  const people: Person[] = peopleRows.map((row) => {
    const created = new Date(row.created_at);
    const firstDevice = row.first_device_at ? new Date(row.first_device_at) : null;
    // Accounts made in the iPhone or Android app never pass through the web
    // landing page, so their first device session stands in for a source.
    const viaApp =
      !row.source && firstDevice && Math.abs(firstDevice.getTime() - created.getTime()) < 60 * 60_000;
    return {
      id: row.id,
      name: row.display_name,
      username: row.username,
      joinedAt: created.toISOString(),
      onboarded: Boolean(row.onboarding_completed_at),
      isPublic: Boolean(row.is_public),
      titles: Number(row.titles),
      watched: Number(row.watched),
      watching: Number(row.watching),
      lists: Number(row.lists),
      sharedLists: Number(row.shared_lists),
      episodes: Number(row.episodes),
      previews: Boolean(row.previews),
      platforms: row.platforms ?? [],
      lastActiveAt: row.last_at ? new Date(row.last_at).toISOString() : null,
      returned: Boolean(row.returned),
      source: row.source ?? (viaApp ? `${row.platforms?.[0] ?? "mobile"} app` : "not recorded"),
      campaign: row.campaign ?? null,
    };
  });

  const joinedWithin = (p: Person, from: number, to = 0) => {
    const age = now - new Date(p.joinedAt).getTime();
    return age < from * DAY && age >= to * DAY;
  };
  // Weekly activity per person drives active counts, the weekly chart and
  // the cohort table.
  const weeksByPerson = new Map<string, Set<string>>();
  const activeWeekCounts = new Map<string, number>();
  for (const row of weeklyRows) {
    const week = isoDay(new Date(row.week));
    if (!weeksByPerson.has(row.owner_id)) weeksByPerson.set(row.owner_id, new Set());
    weeksByPerson.get(row.owner_id)!.add(week);
    activeWeekCounts.set(week, (activeWeekCounts.get(week) ?? 0) + 1);
  }

  const thisWeek = weekStart(new Date(now));
  const activeByWeek = Array.from({ length: 12 }, (_, i) => {
    const week = isoDay(new Date(thisWeek.getTime() - (11 - i) * 7 * DAY));
    return { week, count: activeWeekCounts.get(week) ?? 0 };
  });

  const signupsByDay = Array.from({ length: 90 }, (_, i) => {
    const day = isoDay(new Date(now - (89 - i) * DAY));
    return { day, count: 0 };
  });
  const dayIndex = new Map(signupsByDay.map((d, i) => [d.day, i]));
  for (const p of people) {
    const i = dayIndex.get(p.joinedAt.slice(0, 10));
    if (i !== undefined) signupsByDay[i].count += 1;
  }

  const cohorts = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(thisWeek.getTime() - (7 - i) * 7 * DAY);
    const key = isoDay(start);
    const members = people.filter((p) => isoDay(weekStart(new Date(p.joinedAt))) === key);
    const weeks = [1, 2, 3, 4].map((offset) => {
      const target = new Date(start.getTime() + offset * 7 * DAY);
      if (target.getTime() > thisWeek.getTime()) return null;
      const targetKey = isoDay(target);
      return members.filter((m) => weeksByPerson.get(m.id)?.has(targetKey)).length;
    });
    return { week: key, size: members.length, weeks };
  });

  const activeSince = (days: number) =>
    people.filter((p) => p.lastActiveAt && now - new Date(p.lastActiveAt).getTime() < days * DAY)
      .length;
  const prevWeekKey = isoDay(new Date(thisWeek.getTime() - 7 * DAY));

  const totals = {
    users: people.length,
    new7: people.filter((p) => joinedWithin(p, 7)).length,
    newPrev7: people.filter((p) => joinedWithin(p, 14, 7)).length,
    new30: people.filter((p) => joinedWithin(p, 30)).length,
    active7: activeWeekCounts.get(isoDay(thisWeek)) ?? 0,
    activePrev7: activeWeekCounts.get(prevWeekKey) ?? 0,
    active30: activeSince(30),
    titles: people.reduce((sum, p) => sum + p.titles, 0),
    medianTitles: median(people.map((p) => p.titles)),
  };

  const funnel = [
    { label: "Signed up", count: people.length },
    { label: "Finished onboarding", count: people.filter((p) => p.onboarded).length },
    { label: "Saved a title", count: people.filter((p) => p.titles > 0).length },
    { label: "Saved 5 or more", count: people.filter((p) => p.titles >= 5).length },
    { label: "Marked one watched", count: people.filter((p) => p.watched > 0).length },
    { label: "Came back after day one", count: people.filter((p) => p.returned).length },
  ];

  const sourceMap = new Map<string, { signups: number; activated: number; returned: number }>();
  const campaignMap = new Map<string, { source: string; campaign: string; signups: number; activated: number }>();
  for (const p of people) {
    const entry = sourceMap.get(p.source) ?? { signups: 0, activated: 0, returned: 0 };
    entry.signups += 1;
    if (p.titles > 0) entry.activated += 1;
    if (p.returned) entry.returned += 1;
    sourceMap.set(p.source, entry);
    if (p.campaign) {
      const key = `${p.source}\u0000${p.campaign}`;
      const c = campaignMap.get(key) ?? { source: p.source, campaign: p.campaign, signups: 0, activated: 0 };
      c.signups += 1;
      if (p.titles > 0) c.activated += 1;
      campaignMap.set(key, c);
    }
  }
  const sources = [...sourceMap.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => (a.source === "not recorded" ? 1 : b.source === "not recorded" ? -1 : b.signups - a.signups));
  const campaigns = [...campaignMap.values()].sort((a, b) => b.signups - a.signups);

  const features = [
    { label: "Made a list", count: people.filter((p) => p.lists > 0).length },
    { label: "Shared a list with someone", count: people.filter((p) => p.sharedLists > 0).length },
    { label: "Made their profile public", count: people.filter((p) => p.isPublic).length },
    { label: "Tracks TV episodes", count: people.filter((p) => p.episodes > 0).length },
    { label: "Used Previews", count: people.filter((p) => p.previews).length },
    { label: "Uses the iPhone app", count: people.filter((p) => p.platforms.includes("ios")).length },
    { label: "Uses the Android app", count: people.filter((p) => p.platforms.includes("android")).length },
  ];

  const mediaSplit = { movie: 0, tv: 0 };
  const statusSplit = { want: 0, watching: 0, watched: 0, dropped: 0 };
  for (const row of splitRows) {
    if (row.media_type === "movie" || row.media_type === "tv") mediaSplit[row.media_type] += Number(row.count);
    if (row.status in statusSplit) statusSplit[row.status as keyof typeof statusSplit] += Number(row.count);
  }

  const data: Omit<Insights, "insights"> = {
    generatedAt: new Date(now).toISOString(),
    sourcesTracked,
    people,
    totals,
    signupsByDay,
    activeByWeek,
    funnel,
    cohorts,
    sources,
    campaigns,
    features,
    mostSaved: toTitleStats(mostSaved),
    watchingNow: toTitleStats(watchingNow),
    trending: toTitleStats(trending),
    genres: genreRows.map((g) => ({ name: g.name, count: Number(g.count), people: Number(g.people) })),
    mediaSplit,
    statusSplit,
  };

  return { ...data, insights: deriveInsights(data) };
}

function share(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

/**
 * Plain rules over the numbers above, ordered by what most limits growth:
 * people who never start, people who never return, then reach. Each one names
 * the evidence so it can be checked against the tables on the page.
 */
export function deriveInsights(d: Omit<Insights, "insights">): Insight[] {
  const out: Insight[] = [];
  const n = d.totals.users;
  if (!n) {
    return [{ tone: "grow", title: "No accounts yet", body: "Once people sign up, this page fills in." }];
  }

  const saved = d.funnel.find((f) => f.label === "Saved a title")!.count;
  const five = d.funnel.find((f) => f.label === "Saved 5 or more")!.count;
  const returned = d.funnel.find((f) => f.label === "Came back after day one")!.count;
  const neverSaved = n - saved;

  if (neverSaved / n >= 0.15) {
    out.push({
      tone: "fix",
      title: `${neverSaved} of ${n} people never saved a single title`,
      body:
        "They signed up and left before Slate did anything for them. Watch a few PostHog replays of new accounts, then make the first screen after onboarding hand them something to save in one tap.",
    });
  }

  if (saved && five / saved < 0.6) {
    out.push({
      tone: "fix",
      title: `Only ${five} of ${saved} who started got to 5 titles`,
      body:
        "A library under five titles is too thin to be useful. Import from Letterboxd or IMDb and the onboarding picks are the fastest ways in, so put them in front of anyone with a small library.",
    });
  }

  if (share(returned, n) < 50) {
    out.push({
      tone: "fix",
      title: `${share(returned, n)}% came back after their first day`,
      body:
        "Retention is the number to move before spending more effort on reach. Give people a reason to return: a new episode of a show they are watching, or a friend adding to a shared list.",
    });
  } else {
    out.push({
      tone: "keep",
      title: `${share(returned, n)}% came back after their first day`,
      body: "People who start tend to return. Growth is now about getting more people in.",
    });
  }

  const recorded = d.sources.filter((s) => s.source !== "not recorded");
  const recordedCount = recorded.reduce((sum, s) => sum + s.signups, 0);
  if (!d.sourcesTracked || recordedCount === 0) {
    out.push({
      tone: "grow",
      title: "Signup sources start recording now",
      body:
        "Existing accounts show as not recorded. Tag every link you post, for example s1ate.space/?utm_source=instagram&utm_campaign=film-115, so each video shows up here with its own signups.",
    });
  } else {
    const best = [...recorded]
      .filter((s) => s.signups >= 2)
      .sort((a, b) => b.activated / b.signups - a.activated / a.signups)[0];
    const top = [...recorded].sort((a, b) => b.signups - a.signups)[0];
    out.push({
      tone: "grow",
      title: `${top.source} brought the most signups (${top.signups})`,
      body: best && best.source !== top.source
        ? `${best.source} sends fewer people, but ${share(best.activated, best.signups)}% of them save a title, against ${share(top.activated, top.signups)}% from ${top.source}. Quality beats volume; test more posts there.`
        : `${share(top.activated, top.signups)}% of them went on to save a title. Keep tagging links per post so you can see which videos convert.`,
    });
  }

  if (d.totals.new7 > d.totals.newPrev7) {
    out.push({
      tone: "keep",
      title: `${d.totals.new7} signups this week, up from ${d.totals.newPrev7}`,
      body: "Whatever you posted this week worked better than last. Check the sources table to see which link it was.",
    });
  } else if (d.totals.newPrev7 > 0 && d.totals.new7 < d.totals.newPrev7) {
    out.push({
      tone: "grow",
      title: `${d.totals.new7} signups this week, down from ${d.totals.newPrev7}`,
      body: "Compare what you posted in each week. A tagged link per post makes the difference visible here.",
    });
  }

  const topGenre = d.genres[0];
  const topTitle = d.mostSaved[0];
  if (topGenre && topTitle) {
    out.push({
      tone: "grow",
      title: `Your users save ${topGenre.name.toLowerCase()} more than anything else`,
      body: `${topTitle.title} is the most saved title (${topTitle.people} ${topTitle.people === 1 ? "person" : "people"}). Content about what your users already love is the easiest post to make land.`,
    });
  }

  const lists = d.features.find((f) => f.label === "Made a list")!.count;
  const shared = d.features.find((f) => f.label === "Shared a list with someone")!.count;
  if (share(lists, n) < 30) {
    out.push({
      tone: "grow",
      title: `${lists} of ${n} people have made a list`,
      body: `Shared lists are the one feature that brings new people in by itself, and ${shared} ${shared === 1 ? "person has" : "people have"} shared one. Suggest a list from their library, such as a date-night list, after their tenth title.`,
    });
  }

  if (n < 30) {
    out.push({
      tone: "keep",
      title: `${n} accounts is a small sample`,
      body: "Read percentages here as direction, not fact. Talking to five of these people will tell you more than any chart until you have a few hundred.",
    });
  }

  return out;
}
