import OpenAI from "openai";
import { MODELS } from "./models";

let _client: OpenAI | null = null;

export function getOpenAIClient() {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  _client = new OpenAI({ apiKey });
  return _client;
}

export type GenerateTextOptions = {
  model?: string;
  instructions?: string;
  input: string;
  temperature?: number;
};

export async function generateText(opts: GenerateTextOptions): Promise<{ text: string; usage?: any; raw?: any }> {
  const client = getOpenAIClient();
  const model = opts.model || MODELS.fast;
  const allowTemperature = typeof opts.temperature === "number" && !isFixedTemperatureModel(model);
  const responsePayload: Record<string, any> = {
    model,
    instructions: opts.instructions,
    input: opts.input,
  };
  if (allowTemperature) responsePayload.temperature = opts.temperature;

  // Prefer Responses API (new), fallback to Chat Completions for compatibility.
  try {
    // @ts-ignore - keep tolerant across SDK versions
    const resp = await client.responses.create(responsePayload);

    const text =
      // @ts-ignore
      resp.output_text ??
      // @ts-ignore
      (Array.isArray(resp.output) ? resp.output.map((o: any) => (o.content?.[0]?.text ? o.content[0].text : "")).join("\n") : "");

    return { text: String(text || "").trim(), usage: (resp as any).usage, raw: resp };
  } catch (e) {
    if (allowTemperature && isTemperatureUnsupportedError(e)) {
      // Retry without temperature for models that only allow the default.
      // @ts-ignore - keep tolerant across SDK versions
      const resp = await client.responses.create({
        model,
        instructions: opts.instructions,
        input: opts.input,
      });
      const text =
        // @ts-ignore
        resp.output_text ??
        // @ts-ignore
        (Array.isArray(resp.output) ? resp.output.map((o: any) => (o.content?.[0]?.text ? o.content[0].text : "")).join("\n") : "");
      return { text: String(text || "").trim(), usage: (resp as any).usage, raw: resp };
    }
    // Fallback to Chat Completions
    const ccPayload: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: [
        ...(opts.instructions ? [{ role: "system" as const, content: opts.instructions }] : []),
        { role: "user" as const, content: opts.input },
      ],
    };
    if (allowTemperature) ccPayload.temperature = opts.temperature;
    const cc = await client.chat.completions.create(ccPayload);
    const text = cc.choices?.[0]?.message?.content || "";
    return { text: String(text).trim(), usage: (cc as any).usage, raw: cc };
  }
}

function isFixedTemperatureModel(model: string) {
  return /^gpt-5/i.test(model) || /^o1/i.test(model) || /^o3/i.test(model);
}

function isTemperatureUnsupportedError(err: unknown) {
  const message =
    String((err as any)?.message || "") +
    " " +
    String((err as any)?.error?.message || "") +
    " " +
    String((err as any)?.response?.data?.error?.message || "");
  return /temperature/i.test(message) && /(unsupported|does not support|only the default)/i.test(message);
}
