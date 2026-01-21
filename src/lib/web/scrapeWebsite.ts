import * as cheerio from "cheerio";

export type ScrapedPage = { url: string; text: string };
export type ScrapeResult = { baseUrl: string; pages: ScrapedPage[] };

const DEFAULT_PATHS = [
  "",
  "/about",
  "/about-us",
  "/who-we-are",
  "/mission",
  "/programs",
  "/impact",
  "/what-we-do",
  "/services",
  "/news",
  "/blog",
];

export async function scrapeWebsite(baseUrl: string, opts?: { maxPages?: number; timeoutMs?: number }): Promise<ScrapeResult> {
  const maxPages = opts?.maxPages ?? 6;
  const timeoutMs = opts?.timeoutMs ?? 8000;

  const normalized = normalizeUrl(baseUrl);
  const candidates = DEFAULT_PATHS.map((p) => normalized.replace(/\/$/, "") + p);

  const pages: ScrapedPage[] = [];
  for (const url of candidates) {
    if (pages.length >= maxPages) break;
    try {
      const html = await fetchWithTimeout(url, timeoutMs);
      const text = extractText(html);
      if (text && text.length > 200) pages.push({ url, text: text.slice(0, 15000) });
    } catch {
      // ignore
    }
  }

  return { baseUrl: normalized, pages };
}

function normalizeUrl(url: string) {
  let u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) u = `https://${u}`;
  return u.replace(/\s+/g, "");
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(id);
  }
}

function extractText(html: string): string {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg,iframe").remove();
  const text = $("body").text();
  return text.replace(/\s+/g, " ").trim();
}
