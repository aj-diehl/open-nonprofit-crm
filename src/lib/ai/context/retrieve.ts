import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { embedText } from "@/lib/ai/embeddings";

export type RetrievedChunk = {
  chunk_id: string;
  document_id: string;
  similarity: number;
  content: string;
};

export async function retrieveContext({
  orgId,
  query,
  limit = 8,
}: {
  orgId: string;
  query: string;
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const admin = createSupabaseAdminClient();
  const embedding = await embedText(query);

  const { data, error } = await admin.rpc("match_document_chunks", {
    p_org_id: orgId,
    p_query_embedding: embedding,
    p_match_count: limit,
  });

  if (error) return [];
  return (data || []) as RetrievedChunk[];
}
