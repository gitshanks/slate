import { PublicProfileHeader } from "@/components/public-profile-header";

export default function PublicProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicProfileHeader />
      {children}
    </>
  );
}
