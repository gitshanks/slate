import { formatPlotText } from "@/lib/plot-format";

export function TitleDescription({ text }: { text: string | null | undefined }) {
  const formatted = formatPlotText(text);
  if (!formatted) return null;

  return (
    <div className="mt-6 w-full space-y-4 text-pretty text-base leading-relaxed text-foreground/85">
      {formatted.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
