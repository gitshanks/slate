import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { PrivacyPreferencesButton } from "@/components/analytics/privacy-preferences-button";

export const metadata: Metadata = {
  title: "Privacy and analytics · slate",
  description:
    "How slate uses account data, optional product analytics, and masked session replay.",
};

const contactEmail =
  process.env.PRIVACY_CONTACT_EMAIL?.trim() || "nishankatwork@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#0c0b0a] text-[#f4eee4] selection:bg-[#adebb3]/25">
      <div className="mx-auto w-full max-w-[1120px] px-5 pb-24 pt-6 sm:px-8 sm:pt-8 lg:px-12">
        <nav className="flex items-center justify-between" aria-label="Privacy page navigation">
          <Link href="/" aria-label="slate home">
            <Image src="/brand/logo-light.svg" alt="slate" width={74} height={21} priority />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to slate
          </Link>
        </nav>

        <header className="grid gap-8 border-b border-white/10 pb-14 pt-20 sm:pt-28 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#adebb3]/72">
              Plain-language privacy
            </p>
            <h1 className="mt-5 max-w-4xl text-balance text-[clamp(3.25rem,8vw,7.25rem)] font-medium leading-[0.84] tracking-[-0.07em]">
              Useful signals.
              <br />
              <span className="font-serif font-normal italic text-[#de7548]">Clear boundaries.</span>
            </h1>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5">
            <ShieldCheck className="h-5 w-5 text-[#adebb3]" aria-hidden />
            <p className="mt-4 text-sm leading-6 text-white/66">
              Optional analytics stays off until you accept. You can change your choice at any time.
            </p>
            <PrivacyPreferencesButton className="mt-4 text-xs text-[#adebb3]/80 hover:text-[#adebb3]" />
          </div>
        </header>

        <div className="grid gap-16 py-16 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-20 lg:py-24">
          <aside className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/32 lg:sticky lg:top-10 lg:self-start">
            <p>Effective September 28, 2026</p>
            <p className="mt-2">Applies to the hosted slate service</p>
          </aside>

          <article className="max-w-3xl space-y-16 text-[15px] leading-7 text-white/64">
            <PolicySection title="The short version">
              <p>
                Your library, ratings, notes, lists, profile, and account details make slate work. Product analytics is optional and runs only after consent. Slate uses those analytics to understand feature adoption, find broken or confusing flows, measure performance, and improve the product. It is not used for advertising and is not sold.
              </p>
            </PolicySection>

            <PolicySection title="What the app needs">
              <p>
                When you create an account, slate stores your account identifier, verified email address, profile details, authentication records, library, lists, shared-list membership, ratings, notes, preview preferences, and the actions needed to keep those features in sync. Authentication, security, and the library cannot operate without this data.
              </p>
            </PolicySection>

            <PolicySection title="Optional analytics">
              <div className="overflow-hidden rounded-[1.4rem] border border-white/10">
                <DataRow label="Identity" value="A stable account ID, email, display name, account age, locale, time zone, and web platform after you accept analytics." />
                <DataRow label="Product use" value="Page types, navigation, feature actions and outcomes, preview behavior, library changes, list collaboration, imports, and conversion steps." />
                <DataRow label="Quality" value="Web performance measurements, device and browser category, failed playback, and anonymous error fingerprints." />
                <DataRow label="Replay" value="A visual playback of consenting sessions with every text value and form field masked. Headers, request bodies, canvas content, hidden fields, and file inputs are excluded." last />
              </div>
            </PolicySection>

            <PolicySection title="What stays out">
              <p>
                Slate’s analytics implementation does not intentionally send search phrases, private notes, list names, invite tokens, one-time sign-in codes, uploaded file names or contents, raw error messages, or full title and profile URLs. Sensitive route segments are replaced with generic placeholders before analytics events are sent. IP enrichment and exact device-model collection are disabled.
              </p>
            </PolicySection>

            <PolicySection title="Cookies and local storage">
              <p>
                Essential browser storage keeps you signed in and remembers app settings. If you accept analytics, PostHog uses first-party identifiers in cookies and local storage to connect events into sessions and recognize returning browsers. The browser identifier expires after 180 days. Slate also stores your analytics choice locally so it can be respected on later visits.
              </p>
            </PolicySection>

            <PolicySection title="Processor and purpose">
              <p>
                Slate uses PostHog as a data processor for product analytics and masked session replay. The legal basis for optional analytics is your consent. PostHog receives data only after consent and processes it according to the project’s configured hosting region and retention settings. You can read the vendor’s own privacy information on the PostHog website.
              </p>
              <a
                href="https://posthog.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#adebb3]/78 underline decoration-[#adebb3]/25 underline-offset-4 hover:text-[#adebb3]"
              >
                PostHog privacy policy
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </PolicySection>

            <PolicySection title="Your choices and rights">
              <p>
                Choose “Necessary only” to use slate without optional analytics. Choosing it later stops new analytics and recording on that browser. A Global Privacy Control or Do Not Track signal also keeps analytics off. Depending on where you live, you may ask to access, correct, export, restrict, object to, or delete personal data.
              </p>
              <p className="mt-5">
                Send privacy requests to{" "}
                <a className="text-white underline decoration-white/25 underline-offset-4 hover:decoration-white/60" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>
                . Include the account email and the request you want completed. Do not include a sign-in code or private note.
              </p>
            </PolicySection>

            <PolicySection title="Retention and changes">
              <p>
                Account and library data remains while the account is active or as needed to provide and secure the service. Analytics retention follows the configured PostHog project policy and should be reviewed regularly. Data may be kept longer when required to resolve fraud, security, legal, or accounting obligations. Material changes to this notice will be reflected here with a new effective date.
              </p>
            </PolicySection>
          </article>
        </div>
      </div>
    </main>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-5 text-2xl font-semibold tracking-[-0.035em] text-[#f4eee4] sm:text-3xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DataRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`grid gap-2 p-5 sm:grid-cols-[8rem_1fr] sm:gap-6 ${last ? "" : "border-b border-white/10"}`}>
      <strong className="text-sm font-semibold text-[#f4eee4]">{label}</strong>
      <span>{value}</span>
    </div>
  );
}
