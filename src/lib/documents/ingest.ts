import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractTextFromFile } from "./extract";
import { chunkText } from "./chunk";
import { embedTexts } from "@/lib/ai/embeddings";
import { MODELS } from "@/lib/ai/models";
import { generateText } from "@/lib/ai/openaiClient";

export async function createDocumentRecord({
  admin,
  orgId,
  userId,
  file,
  tags,
}: {
  admin?: ReturnType<typeof createSupabaseAdminClient>;
  orgId: string;
  userId: string;
  file: File;
  tags?: Record<string, any>;
}): Promise<{ id: string }> {
  const client = admin ?? createSupabaseAdminClient();

  const { data: doc, error: docErr } = await client
    .from("documents")
    .insert({
      org_id: orgId,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      status: "processing",
      tags: tags || null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (docErr || !doc?.id) throw new Error("Unable to create document record");
  return { id: doc.id as string };
}

export async function uploadDocumentFile({
  admin,
  orgId,
  documentId,
  file,
}: {
  admin?: ReturnType<typeof createSupabaseAdminClient>;
  orgId: string;
  documentId: string;
  file: File;
}): Promise<{ path: string }> {
  const client = admin ?? createSupabaseAdminClient();
  const bucket = process.env.SUPABASE_DOCS_BUCKET || "documents";
  const path = `${orgId}/${documentId}/${sanitizeFileName(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await client.storage.from(bucket).upload(path, buf, {
    contentType: file.type || undefined,
    upsert: true,
  });

  if (uploadErr) {
    await client
      .from("documents")
      .update({
        status: "failed",
        metadata: { error: uploadErr.message || String(uploadErr) },
      })
      .eq("id", documentId);
    throw uploadErr;
  }

  await client.from("documents").update({ storage_path: path }).eq("id", documentId);
  return { path };
}

export async function processDocumentContent({
  admin,
  orgId,
  documentId,
  file,
}: {
  admin?: ReturnType<typeof createSupabaseAdminClient>;
  orgId: string;
  documentId: string;
  file: File;
}): Promise<void> {
  const client = admin ?? createSupabaseAdminClient();

  try {
    // Extract text
    const text = await extractTextFromFile(file);
    if (!text) throw new Error("No text extracted from file");

    // Optional: short summary (helps context selection)
    const summary = await summarizeText(text);

    // Chunk + embed
    const chunks = chunkText(text);
    const batchSize = 64;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await embedTexts(batch.map((c) => c.content));

      const rows = batch.map((c, idx) => ({
        org_id: orgId,
        document_id: documentId,
        chunk_index: i + idx,
        content: c.content,
        token_count: c.tokenCount,
        embedding: embeddings[idx],
      }));

      const { error: insErr } = await client.from("document_chunks").insert(rows);
      if (insErr) throw insErr;
    }

    await client
      .from("documents")
      .update({
        status: "indexed",
        summary,
        indexed_at: new Date().toISOString(),
      })
      .eq("id", documentId);
  } catch (e: any) {
    await client
      .from("documents")
      .update({
        status: "failed",
        metadata: { error: e?.message || String(e) },
      })
      .eq("id", documentId);

    throw e;
  }
}

export async function ingestOrgDocument({
  supabase: _supabase,
  orgId,
  userId,
  file,
  tags,
}: {
  supabase: any; // server client (for auth context + audit)
  orgId: string;
  userId: string;
  file: File;
  tags?: Record<string, any>;
}): Promise<{ id: string }> {
  const admin = createSupabaseAdminClient();

  const doc = await createDocumentRecord({ admin, orgId, userId, file, tags });
  await uploadDocumentFile({ admin, orgId, documentId: doc.id, file });
  await processDocumentContent({ admin, orgId, documentId: doc.id, file });

  return { id: doc.id };
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

async function summarizeText(text: string): Promise<string | null> {
  const max = 6000;
  const excerpt = text.slice(0, max);
  try {
    const res = await generateText({
      model: MODELS.fast,
      instructions: "You summarize documents for retrieval. Be concise and factual. 3-6 bullet points max.",
      input: `Summarize the following document for an internal knowledge base.\n\n${excerpt}`,
      temperature: 0.2,
    });
    return res.text || null;
  } catch {
    return null;
  }
}
