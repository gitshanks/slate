import Image from "next/image";
import Link from "next/link";
import { SlateGoLink } from "@/components/slate-go-link";
import { SlateListCard } from "@/components/slate-list-card";
import { getSlateListExtras } from "@/lib/slate-list-content";
import { getSlateList, getSlateLists, WEEKLY_SLUG } from "@/lib/slate-lists";
import { posterUrl } from "@/lib/tmdb-image";

const STEPS = [
  {
    image: "/landing/how-link.jpg",
    title: "Paste a link",
    line: "Slate finds the film in any trailer, Reel or review.",
  },
  {
    image: "/landing/how-library.jpg",
    title: "Keep one library",
    line: "Up next, watching and watched, in one place.",
  },
  {
    image: "/landing/how-lists.jpg",
    title: "Make lists together",
    line: "Share a list with whoever you watch with.",
  },
];

const SECTION = "mx-auto w-full max-w-[1264px] px-5 pt-24 sm:px-8 lg:pt-40";
const H2 = "text-balance text-[34px] font-bold leading-[38px] tracking-[-0.03em] text-white lg:text-[56px] lg:leading-[60px]";
const LEDE = "mt-2.5 text-balance text-base leading-6 text-white/60 lg:mt-4 lg:text-lg lg:leading-7 lg:[text-wrap:nowrap]";

/**
 * Everything under the hero on the signed-out home: this week's list, how
 * Slate works in three real screens, and the lists made by Slate. Each part is
 * left out if its data is missing, so the page never shows an empty section.
 */
export async function HomeSections() {
  const [weekly, lists] = await Promise.all([
    getSlateList(WEEKLY_SLUG).catch(() => null),
    getSlateLists().catch(() => []),
  ]);
  const extras = getSlateListExtras(WEEKLY_SLUG);
  const top = weekly?.titles.slice(0, 5) ?? [];

  // The landing page is dark whatever the visitor's system theme, so these
  // sections read the dark tokens.
  return (
    <div className="dark">
      {weekly && top.length ? (
        <section
          id="features"
          aria-labelledby="home-week-title"
          className={`${SECTION} grid scroll-mt-12 lg:grid-cols-2 lg:items-center lg:gap-24`}
        >
          <div>
            <h2 id="home-week-title" className={H2}>
              {weekly.list.name}
            </h2>
            <p className={LEDE}>{extras.description ?? weekly.list.description}</p>
            <SlateGoLink href={`/l/${WEEKLY_SLUG}`} className="mt-6 lg:mt-8">
              See all
            </SlateGoLink>
          </div>
          <ol className="mt-6 grid gap-y-1 lg:mt-0 lg:gap-y-0">
            {top.map((title, index) => {
              const value = extras.items[`${title.media_type}:${title.tmdb_id}`]?.value;
              const poster = posterUrl(title.poster_path, "w185");
              return (
                <li key={title.id}>
                  <Link
                    href={`/l/${WEEKLY_SLUG}`}
                    aria-label={`${index + 1}. ${title.title}${value ? `, ${value}` : ""}`}
                    className="group grid h-[92px] grid-cols-[14px_50px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:h-[100px] lg:grid-cols-[22px_56px_minmax(0,1fr)_auto] lg:gap-5"
                  >
                    <span
                      aria-hidden
                      className="-mr-[30px] justify-self-end whitespace-nowrap text-right text-[76px] font-extrabold leading-[76px] tracking-[-0.06em] text-white/[0.13] tabular-nums lg:-mr-[38px] lg:text-[104px] lg:leading-[100px]"
                    >
                      {index + 1}
                    </span>
                    <span className="relative block h-[75px] w-[50px] overflow-hidden rounded-lg bg-card transition-transform duration-200 ease-out motion-reduce:transition-none hoverable:group-hover:scale-[1.04] lg:h-[84px] lg:w-14">
                      {poster ? <Image src={poster} alt="" fill sizes="56px" className="object-cover" /> : null}
                    </span>
                    <span className="truncate text-base font-semibold tracking-[-0.01em] text-white lg:text-xl">
                      {title.title}
                    </span>
                    {value ? (
                      <span className="text-[46px] font-light leading-[46px] tracking-[-0.05em] text-primary tabular-nums lg:pl-5 lg:text-[60px] lg:leading-[60px]">
                        {value}
                      </span>
                    ) : (
                      <span />
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="home-how-title" className={SECTION}>
        <h2 id="home-how-title" className={H2}>
          Save it the moment you hear about it
        </h2>
        <ul className="mt-8 grid gap-14 lg:mt-16 lg:grid-cols-3 lg:gap-12">
          {STEPS.map((step) => (
            <li key={step.title} className="text-center">
              <div className="relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[32px] bg-black ring-[5px] ring-card lg:max-w-none">
                <Image src={step.image} alt="" fill sizes="(min-width: 1024px) 380px, 300px" className="object-cover object-top" />
              </div>
              <h3 className="mt-6 text-[22px] font-bold leading-7 tracking-[-0.02em] text-white lg:mt-8 lg:text-[26px] lg:leading-8">
                {step.title}
              </h3>
              <p className="mt-1.5 whitespace-nowrap text-[15px] leading-[22px] text-white/60 lg:text-base lg:leading-6">
                {step.line}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {lists.length ? (
        <section aria-labelledby="home-lists-title" className={SECTION}>
          <h2 id="home-lists-title" className={H2}>
            Lists by Slate
          </h2>
          <p className={LEDE}>Films worth your time, picked and ranked.</p>
          <div className="mt-7 grid gap-4 lg:mt-12 lg:grid-cols-2 lg:gap-6">
            {lists.slice(0, 3).map((list, index) => (
              <SlateListCard key={list.slug} list={list} featured={index === 0} />
            ))}
          </div>
          <SlateGoLink href="/l" className="mt-7 lg:mt-8">
            Explore more lists
          </SlateGoLink>
        </section>
      ) : null}
    </div>
  );
}
