import { describe, expect, it, vi } from "vitest";

const { generateText } = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

generateText.mockImplementation(async () => ({ text: '{"ok": true}' }));

vi.mock("@openai/agents", () => ({}));
vi.mock("@openai/agents-openai", () => ({}));
vi.mock("@/lib/ai/openaiClient", () => ({ generateText }));

import { runAgentJson } from "@/lib/ai/agents/runtime";

describe("agents runtime", () => {
  it("falls back to generateText when Agents SDK is unavailable", async () => {
    const result = await runAgentJson({
      name: "TestAgent",
      workflow: "test_workflow",
      instructions: "Return JSON only.",
      input: { ok: true },
    });

    expect(generateText).toHaveBeenCalled();
    expect(result.output).toEqual({ ok: true });
  });
});
