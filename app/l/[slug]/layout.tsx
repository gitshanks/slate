import { ImageArrival } from "@/components/image-arrival";

export default function PublicListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ImageArrival />
      {children}
    </>
  );
}
