import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/documents/chunk";
import { extractTextFromFile } from "@/lib/documents/extract";

describe("documents helpers", () => {
  it("chunks text with overlap", () => {
    const text = "a".repeat(4000);
    const chunks = chunkText(text, { maxChars: 1000, overlapChars: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBe(1000);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it("extracts text from CSV files", async () => {
    const csv = "Name,Amount\nAlice,10\nBob,20";
    const file = new File([csv], "donations.csv", { type: "text/csv" });
    const text = await extractTextFromFile(file);
    expect(text).toContain("Name,Amount");
    expect(text).toContain("Alice,10");
  });
});
