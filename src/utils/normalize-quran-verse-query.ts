export function normalizeQuranVerseQuery(input: string): string {
  return input
    .trim()
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*,\s*/g, ",")
    .replace(/(^|,)(\d{1,3})\s+(\d{1,3})(?=$|[-,])/g, "$1$2:$3");
}
