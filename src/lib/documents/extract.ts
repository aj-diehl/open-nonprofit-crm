import * as mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { parseSpreadsheet } from "@/lib/import/parseSpreadsheet";

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const buf = Buffer.from(await file.arrayBuffer());
    const data = await pdfParse(buf);
    return (data.text || "").trim();
  }

  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const buf = Buffer.from(await file.arrayBuffer());
    const res = await mammoth.extractRawText({ buffer: buf });
    return (res.value || "").trim();
  }

  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    return (await file.text()).trim();
  }

  if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const table = await parseSpreadsheet(file);
    // Convert table to text (bounded size)
    const lines: string[] = [];
    const maxRows = Math.min(200, table.rows.length);
    lines.push(`Headers: ${table.headers.join(", ")}`);
    for (let i = 0; i < maxRows; i++) {
      const row = table.rows[i];
      const parts = Object.entries(row)
        .slice(0, 50)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 200)}`);
      lines.push(parts.join(" | "));
    }
    return lines.join("\n");
  }

  // Fallback: attempt to read as text
  try {
    return (await file.text()).trim();
  } catch {
    return "";
  }
}
