export type Chunk = { content: string; tokenCount: number };

// Simple chunker with overlap; tokenCount is an estimate (chars/4)
export function chunkText(text: string, opts?: { maxChars?: number; overlapChars?: number }): Chunk[] {
  const maxChars = opts?.maxChars ?? 1800;
  const overlap = opts?.overlapChars ?? 200;

  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(cleaned.length, start + maxChars);
    const slice = cleaned.slice(start, end);
    chunks.push({ content: slice, tokenCount: Math.max(1, Math.round(slice.length / 4)) });
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}
