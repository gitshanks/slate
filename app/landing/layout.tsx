export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="landing-shell min-h-dvh overflow-clip">{children}</div>;
}
