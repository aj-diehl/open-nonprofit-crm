import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedTable = {
  headers: string[];
  rows: Record<string, any>[];
};

export async function parseSpreadsheet(file: File): Promise<ParsedTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    const headers = (parsed.meta.fields || []).map((h) => String(h));
    const rows = (parsed.data || []).map((r) => normalizeRow(r));
    return { headers, rows };
  }

  // Excel
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[firstSheetName];

  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  const headers = json.length ? Object.keys(json[0]) : [];
  const rows = json.map((r) => normalizeRow(r));
  return { headers, rows };
}

function normalizeRow(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[String(k).trim()] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}
