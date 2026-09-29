import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrivacyPreferencesButton } from "@/components/analytics/privacy-preferences-button";

export const metadata: Metadata = {
  title: "Privacy · slate",
  description: "How Slate handles your information and the choices you have.",
};

const contactEmail = process.env.PRIVACY_CONTACT_EMAIL?.trim() || "nishankatwork@gmail.com";
const textLink = "text-[#f6f3ed] underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#adebb3]";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[#080808] text-[#f6f3ed] selection:bg-[#adebb3]/25">
      <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-7 sm:px-10 sm:pt-9">
        <nav className="flex items-center justify-between" aria-label="Privacy page navigation">
          <Link href="/" aria-label="slate home">
            <Image src="/brand/logo-light.svg" alt="slate" width={78} height={22} className="h-auto" priority />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 py-2 text-xs text-white/60 transition-colors hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Slate
          </Link>
        </nav>

        <article className="mx-auto max-w-[640px] pt-16 sm:pt-24">
          <header className="border-b border-white/10 pb-9">
            <h1 className="text-5xl font-semibold leading-none tracking-[-0.055em] sm:text-6xl">Privacy</h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-white/65">
              How Slate handles your information and the choices you have.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-white/45">
              <span>Updated September 28, 2026</span>
              <PrivacyPreferencesButton className="text-xs text-[#adebb3] underline underline-offset-4 hover:text-white" />
            </div>
          </header>

          <div className="space-y-9 py-10 text-sm leading-7 text-white/65 sm:space-y-11 sm:text-[15px]">
            <PolicySection title="Your account and library">
              <p>
                Slate uses your sign-in details, profile, saved titles, ratings, notes, lists, and viewing preferences to run your account, sync your library, and personalize recommendations. We also keep the records needed to secure sign-ins and shared lists.
              </p>
              <p>
                A public profile can be seen by others. People in a shared list can see its contents. You control your profile visibility and who you invite.
              </p>
            </PolicySection>

            <PolicySection title="Optional analytics">
              <p>
                With your permission, we use PostHog to understand how Slate is used and where it needs improvement. This includes feature activity, device and browser information, performance, and errors. When signed in, activity can be linked to your account ID, email, name, account age, language, and time zone.
              </p>
              <p>
                Analytics also includes session replays: a playback of interactions with text and form entries hidden. Private notes, search text, list names, sign-in codes, and uploaded file contents are excluded from analytics.
              </p>
              <p>
                These features stay off until you accept. Choose <span className="text-white/85">Necessary only</span> to use Slate without them. We do not sell this data or use it for advertising.
              </p>
            </PolicySection>

            <PolicySection title="Cookies and browser storage">
              <p>
                Essential storage keeps you signed in and remembers your settings and privacy choice. If you accept analytics, additional identifiers connect visits and activity; the analytics cookie lasts up to 180 days.
              </p>
              <p>
                You can change your choice through Privacy choices in the footer or Profile settings. Turning analytics off stops new collection on that browser. We also respect Global Privacy Control and Do Not Track signals.
              </p>
            </PolicySection>

            <PolicySection title="Services that help Slate work">
              <p>
                Service providers handle hosting, data storage, sign-in, email delivery, and optional analytics on our behalf. When you use AI features, your request and relevant library context are sent to the AI provider to generate a response.
              </p>
              <p>
                Embedded trailers use YouTube. Google sign-in and YouTube are also covered by <a href="https://policies.google.com/privacy" className={textLink}>Google’s privacy policy</a>. You can read <a href="https://posthog.com/privacy" className={textLink}>PostHog’s privacy policy</a> for its handling of analytics data. Providers may process information in countries other than your own.
              </p>
            </PolicySection>

            <PolicySection title="Keeping and deleting information">
              <p>
                Account data is kept while you use Slate. You can <Link href="/profile" className={textLink}>delete your account in Profile settings</Link>. This removes your profile, library, notes, ratings, preferences, and lists you own, and signs you out on every device. Owned shared lists are removed for their members too.
              </p>
              <p>
                Previously collected analytics follows our analytics provider’s retention settings. Contact us to request its deletion. Some records may need to be retained for security or legal obligations.
              </p>
            </PolicySection>

            <PolicySection title="Questions or requests">
              <p>
                For questions about this hosted Slate service, or to request access, correction, export, or deletion of your information, email <a href={`mailto:${contactEmail}`} className={`${textLink} break-words`}>{contactEmail}</a> with your account email and request.
              </p>
              <p>
                Depending on where you live, you may also have rights to restrict or object to processing and to complain to your local data protection authority. If our practices change, we’ll update this page and its date.
              </p>
            </PolicySection>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/45">
            <span>Slate</span>
            <a href={`mailto:${contactEmail}`} className="py-2 transition-colors hover:text-white">Contact about privacy</a>
          </footer>
        </article>
      </div>
    </main>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-[-0.025em] text-[#f6f3ed]">{title}</h2>
      {children}
    </section>
  );
}
