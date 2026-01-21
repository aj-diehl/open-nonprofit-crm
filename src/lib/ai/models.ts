export const MODELS = {
  fast: process.env.OPENAI_FAST_MODEL || "gpt-4.1-mini",
  reasoning: process.env.OPENAI_REASONING_MODEL || "gpt-5-mini",
  deep: process.env.OPENAI_DEEP_MODEL || "gpt-5",
  embeddings: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
};

export const EMBEDDING_DIM = Number(process.env.OPENAI_EMBEDDING_DIM || 1536);
