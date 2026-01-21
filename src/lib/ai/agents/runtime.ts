import { MODELS } from "../models";
import { generateText } from "../openaiClient";

let _initialized = false;
let _loggedAgentsRun = false;
let _loggedFallback = false;

async function initAgentsSdk() {
  if (_initialized) return;
  _initialized = true;

  // Attempt to initialize Agents SDK defaults.
  // This is intentionally defensive: if the SDK API changes, we fall back to standard OpenAI calls.
  try {
    const Agents: any = await import("@openai/agents");
    const OpenAI: any = await import("@openai/agents-openai");

    if (typeof Agents.setDefaultOpenAIKey === "function") {
      Agents.setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
    }

    // Tracing exporter (optional)
    const tracingKey = process.env.OPENAI_TRACING_EXPORT_API_KEY || process.env.OPENAI_API_KEY;
    if (tracingKey && typeof OpenAI.openaiTracingExporter === "function" && typeof Agents.setDefaultTraceExporter === "function") {
      const exporter = OpenAI.openaiTracingExporter({ apiKey: tracingKey });
      Agents.setDefaultTraceExporter(exporter);
    }

    // Optional: disable sensitive data export by default
    if (typeof Agents.setTracingExportSensitiveData === "function") {
      Agents.setTracingExportSensitiveData(false);
    }
  } catch {
    // Ignore; we'll use fallback LLM calls.
  }
}

export type RunAgentJsonOptions = {
  name: string;
  workflow: string;
  model?: string;
  instructions: string;
  input: any;
  traceGroupId?: string;
  traceMetadata?: Record<string, any>;
};

export async function runAgentJson<T = any>(opts: RunAgentJsonOptions): Promise<{ output: T; traceId?: string; rawText: string }> {
  await initAgentsSdk();

  // 1) Try Agents SDK
  try {
    const Agents: any = await import("@openai/agents");

    const model = opts.model || MODELS.fast;
    const agentInput = normalizeAgentInput(opts.input);

    const agent = new Agents.Agent({
      name: opts.name,
      instructions: opts.instructions,
      model,
    });

    const runOpts: any = {
      // Many versions support these
      groupId: opts.traceGroupId,
      metadata: opts.traceMetadata,
    };

    let result: any;
    if (typeof Agents.run === "function") {
      result = await Agents.run(agent, agentInput, runOpts);
    } else if (typeof agent.run === "function") {
      result = await agent.run(agentInput, runOpts);
    } else {
      throw new Error("Agents SDK: no run() function found");
    }

    const traceId = result?.traceId || result?.trace_id || runOpts?.traceId;

    const rawText = extractFinalText(result);
    const output = safeJsonParse<T>(rawText);
    if (!_loggedAgentsRun) {
      console.info("[ai] Agents SDK active; traces should be exported if configured.");
      _loggedAgentsRun = true;
    }
    return { output, traceId, rawText };
  } catch (err) {
    // 2) Fallback: standard OpenAI call (no trace)
    if (!_loggedFallback) {
      console.warn("[ai] Agents SDK unavailable; falling back to standard OpenAI calls (no traces).", err);
      _loggedFallback = true;
    }
    const raw = await generateText({
      model: opts.model || MODELS.fast,
      instructions: opts.instructions,
      input: typeof opts.input === "string" ? opts.input : JSON.stringify(opts.input, null, 2),
      temperature: 0.2,
    });
    const rawText = raw.text;
    const output = safeJsonParse<T>(rawText);
    return { output, rawText };
  }
}

export async function runAgentText(opts: Omit<RunAgentJsonOptions, "input"> & { input: string }): Promise<{ text: string; traceId?: string }> {
  await initAgentsSdk();
  try {
    const Agents: any = await import("@openai/agents");
    const model = opts.model || MODELS.fast;
    const agentInput = normalizeAgentInput(opts.input);

    const agent = new Agents.Agent({
      name: opts.name,
      instructions: opts.instructions,
      model,
    });

    const runOpts: any = { groupId: opts.traceGroupId, metadata: opts.traceMetadata };
    let result: any;
    if (typeof Agents.run === "function") result = await Agents.run(agent, agentInput, runOpts);
    else if (typeof agent.run === "function") result = await agent.run(agentInput, runOpts);
    else throw new Error("Agents SDK: no run() function found");

    const traceId = result?.traceId || result?.trace_id || runOpts?.traceId;
    const text = extractFinalText(result);
    if (!_loggedAgentsRun) {
      console.info("[ai] Agents SDK active; traces should be exported if configured.");
      _loggedAgentsRun = true;
    }
    return { text, traceId };
  } catch (err) {
    if (!_loggedFallback) {
      console.warn("[ai] Agents SDK unavailable; falling back to standard OpenAI calls (no traces).", err);
      _loggedFallback = true;
    }
    const resp = await generateText({
      model: opts.model || MODELS.fast,
      instructions: opts.instructions,
      input: opts.input,
      temperature: 0.4,
    });
    return { text: resp.text };
  }
}

function extractFinalText(result: any): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result.finalOutput === "string") return result.finalOutput;
  if (typeof result.output_text === "string") return result.output_text;
  if (typeof result.output === "string") return result.output;
  if (typeof result.text === "string") return result.text;

  // Many agent results include an array of messages
  const messages = result.messages || result.outputMessages || result.history;
  if (Array.isArray(messages)) {
    const last = messages[messages.length - 1];
    const content = last?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      const texts = content.map((c: any) => c?.text || c?.content || "").filter(Boolean);
      return texts.join("\n");
    }
    if (typeof last?.text === "string") return last.text;
  }

  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function safeJsonParse<T>(text: string): T {
  // Extract JSON object from text, tolerating triple backticks.
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const candidate = firstBrace >= 0 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Last resort: try to repair common issues
    const repaired = candidate
      .replace(/\u0000/g, "")
      .replace(/\n\s*,/g, ",")
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");
    return JSON.parse(repaired) as T;
  }
}

function normalizeAgentInput(input: unknown): string | any[] {
  if (typeof input === "string") return input;
  if (Array.isArray(input)) return input;
  return JSON.stringify(input ?? {}, null, 2);
}
