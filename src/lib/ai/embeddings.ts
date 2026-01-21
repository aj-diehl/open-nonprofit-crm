import { getOpenAIClient } from "./openaiClient";
import { MODELS, EMBEDDING_DIM } from "./models";

export async function embedText(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  // @ts-ignore
  const resp = await client.embeddings.create({
    model: MODELS.embeddings,
    input: text,
    dimensions: EMBEDDING_DIM,
  });

  const embedding = resp.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) throw new Error("Embedding failed");
  return embedding as number[];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getOpenAIClient();
  // @ts-ignore
  const resp = await client.embeddings.create({
    model: MODELS.embeddings,
    input: texts,
    dimensions: EMBEDDING_DIM,
  });

  return resp.data.map((d: any) => d.embedding as number[]);
}
