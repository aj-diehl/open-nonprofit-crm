import { beforeEach, describe, expect, it, vi } from "vitest";

const responsesCreate = vi.fn();
const chatCreate = vi.fn();

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = { create: responsesCreate };
    chat = { completions: { create: chatCreate } };
  },
}));

describe("openai client", () => {
  beforeEach(() => {
    responsesCreate.mockReset();
    chatCreate.mockReset();
  });

  it("uses responses API when available", async () => {
    responsesCreate.mockResolvedValue({ output_text: "hello world", usage: { total_tokens: 1 } });
    const { generateText } = await import("@/lib/ai/openaiClient");
    const res = await generateText({ input: "hi" });
    expect(res.text).toBe("hello world");
  });

  it("falls back to chat completions on errors", async () => {
    responsesCreate.mockRejectedValue(new Error("failed"));
    chatCreate.mockResolvedValue({ choices: [{ message: { content: "chat response" } }] });
    const { generateText } = await import("@/lib/ai/openaiClient");
    const res = await generateText({ input: "hi" });
    expect(res.text).toBe("chat response");
  });
});
