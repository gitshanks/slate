import { HomeSections } from "@/components/landing/home-sections";
import { IndexLanding } from "@/components/landing/index-landing";
import { PosterCarousel } from "@/components/landing/poster-carousel";
import styles from "@/components/landing/index-landing.module.css";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="landing-shell min-h-dvh overflow-clip">
      <IndexLanding
        sections={<HomeSections />}
        backdrop={
          <PosterCarousel className={styles.backdrop} />
        }
      >
        {children}
      </IndexLanding>
    </div>
  );
}
