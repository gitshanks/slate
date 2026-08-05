/**
 * Repair common formatting defects in third-party plot text without
 * paraphrasing or changing its meaning. Long plots are grouped into short,
 * editorial paragraphs so `plot=full` remains readable on phones.
 */
export function formatPlotText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const text = value
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    // OMDb occasionally contains a double quote where an apostrophe belongs:
    // `Adhoora"s`, `don"t`, `they"re`, etc.
    .replace(/([\p{L}])["”](s|t|re|ve|ll|d|m)\b/giu, "$1'$2")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/\s*[\r\n]+\s*/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    // Restore missing spaces after commas and sentence punctuation while
    // leaving decimal numbers and abbreviations such as U.S. untouched.
    .replace(/([,;:])(?=(?:["'“‘])?[\p{L}])/gu, "$1 ")
    .replace(/([.!?])(?=(?:["'”’])?[\p{Lu}][\p{Ll}])/gu, "$1 ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/ {2,}/g, " ")
    .trim();

  if (!text) return null;
  const wordCount = countWords(text);
  if (wordCount < 100) return text.slice(0, 8_000);

  const sentences = text.split(
    /(?<=[.!?])\s+(?=(?:["'“‘])?[\p{Lu}\d])/u,
  );
  if (sentences.length < 4) return text.slice(0, 8_000);

  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);
    if (
      current.length >= 2 &&
      (current.length >= 3 || currentWords + sentenceWords > 95)
    ) {
      paragraphs.push(current.join(" "));
      current = [];
      currentWords = 0;
    }
    current.push(sentence);
    currentWords += sentenceWords;
  }
  if (current.length) paragraphs.push(current.join(" "));

  return paragraphs.join("\n\n").slice(0, 8_000);
}

function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}
