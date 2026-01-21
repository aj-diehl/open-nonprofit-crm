import { describe, expect, it } from "vitest";
import { slugify, generateInviteCode } from "@/lib/shared/strings";
import { formatCurrency } from "@/lib/shared/money";
import { cn } from "@/lib/shared/cn";

describe("shared utilities", () => {
  it("slugify normalizes and trims input", () => {
    expect(slugify(" Hello, World! ")).toBe("hello-world");
    expect(slugify("A".repeat(100)).length).toBe(64);
  });

  it("generateInviteCode uses NP- prefix and 6 chars", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^NP-[A-Z0-9]{6}$/);
  });

  it("formatCurrency falls back on invalid currency codes", () => {
    expect(formatCurrency(12.34, "INVALID")).toBe("INVALID 12.34");
  });

  it("cn merges tailwind classes", () => {
    expect(cn("p-2", "p-4", false && "hidden")).toBe("p-4");
  });
});
