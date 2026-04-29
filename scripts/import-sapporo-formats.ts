import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PAGE_URL = "https://www.city.sapporo.jp/shogaifukushi/zigyoshasitei/bessi3-76excel.html";
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT_DIR, "source-docs", "2026", "sapporo-bessi3-76");
const META_DIR = path.join(ROOT_DIR, "source-docs", "meta");
const SUPPORTED_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xls", ".docx", ".doc", ".pdf"]);

type FormatLink = {
  title: string;
  href: string;
  url: string;
  extension: string;
  formatNo: string | null;
  oldFormatRefs: string[];
  note: string | null;
};

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const skipDownload = args.has("--meta-only");
  const refreshMeta = args.has("--refresh-meta");
  const html = await fetchText(PAGE_URL);
  const links = parseFormatLinks(html);

  if (dryRun) {
    console.log(`${links.length} files found on ${PAGE_URL}`);
    for (const link of links) {
      console.log(
        [
          link.formatNo ?? "(no no.)",
          link.title,
          link.extension,
          link.oldFormatRefs.length ? `old=${link.oldFormatRefs.join(",")}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      );
    }
    return;
  }

  await fs.mkdir(SOURCE_DIR, { recursive: true });
  await fs.mkdir(META_DIR, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  let metaWritten = 0;

  for (const link of links) {
    const fileName = makeFileName(link);
    const filePath = path.join(SOURCE_DIR, fileName);

    if (!skipDownload) {
      const exists = await fileExists(filePath);
      if (exists) {
        skipped += 1;
      } else {
        const bytes = await fetchBytes(link.url);
        await fs.writeFile(filePath, bytes);
        downloaded += 1;
      }
    }

    const metaPath = path.join(META_DIR, `${path.basename(fileName, path.extname(fileName))}.md`);
    const metaExists = await fileExists(metaPath);
    if (!metaExists || refreshMeta) {
      await fs.writeFile(metaPath, buildMetaMarkdown(link, fileName), "utf8");
      metaWritten += 1;
    }
  }

  console.log(
    `Imported ${links.length} files. downloaded=${downloaded} skipped=${skipped} meta=${metaWritten}`,
  );
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function parseFormatLinks(html: string): FormatLink[] {
  const body = html.slice(html.indexOf("ここから本文です。"), html.indexOf("このページについてのお問い合わせ"));
  const tokens = tokenize(body.length > 0 ? body : html);
  const grouped = new Map<string, FormatLink>();
  let currentFormatNo: string | null = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === "text") {
      const formatNo = findLast(findFormatNos(token.text));
      if (formatNo) {
        currentFormatNo = formatNo;
      }
      continue;
    }

    const urlExtension = path.extname(new URL(token.url).pathname).toLowerCase();
    if (!urlExtension && !/(エクセル|ワード|PDF)/iu.test(token.text)) {
      continue;
    }

    const extension = urlExtension || inferExtension(token.text);
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      continue;
    }

    const title = cleanTitle(token.text);
    const oldFormatRefs = collectOldFormatRefs(tokens, index);
    const note = collectNote(tokens, index);
    const existing = grouped.get(token.url);

    if (existing) {
      if (title && !existing.title.includes(title)) {
        existing.title = `${existing.title}／${title}`;
      }
      if (!existing.formatNo && currentFormatNo) {
        existing.formatNo = currentFormatNo;
      }
      existing.oldFormatRefs = Array.from(new Set([...existing.oldFormatRefs, ...oldFormatRefs]));
      existing.note = existing.note ?? note;
      continue;
    }

    if (!title) {
      continue;
    }

    grouped.set(token.url, {
      title,
      href: token.href,
      url: token.url,
      extension,
      formatNo: currentFormatNo,
      oldFormatRefs,
      note,
    });
  }

  return [...grouped.values()];
}

function makeFileName(link: FormatLink) {
  const prefix = link.formatNo ? `${normalizeFormatNo(link.formatNo)}_` : "";
  const baseName = sanitizeFileName(`${prefix}${link.title}`).slice(0, 130).replace(/[. ]+$/u, "");
  return `${baseName || "sapporo-format"}${link.extension}`;
}

function buildMetaMarkdown(link: FormatLink, fileName: string) {
  const keywords = Array.from(
    new Set(
      [
        link.formatNo,
        ...link.oldFormatRefs,
        ...splitTitleKeywords(link.title),
        "札幌市",
        "障害福祉サービス",
        "加算の届出",
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  return [
    "---",
    "category: disability",
    `title: ${quoteYaml(`${link.formatNo ? `${link.formatNo} ` : ""}${link.title}`)}`,
    "source: 札幌市",
    `source_page: ${PAGE_URL}`,
    `source_url: ${link.url}`,
    `retrieved_at: ${new Date().toISOString()}`,
    link.formatNo ? `format_no: ${link.formatNo}` : null,
    link.oldFormatRefs.length ? "old_format_refs:" : null,
    ...link.oldFormatRefs.map((ref) => `  - ${ref}`),
    "keywords:",
    ...keywords.map((keyword) => `  - ${keyword}`),
    "---",
    "",
    `# ${link.formatNo ? `${link.formatNo} ` : ""}${link.title}`,
    "",
    `- 原本ファイル: [[2026/sapporo-bessi3-76/${fileName}]]`,
    `- 掲載元: [札幌市 別紙、市様式一覧](${PAGE_URL})`,
    `- 直接URL: ${link.url}`,
    link.note ? `- 備考: ${link.note}` : null,
    "",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

type Token =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "anchor";
      text: string;
      href: string;
      url: string;
    };

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const anchorPattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/giu;
  let lastIndex = 0;

  for (const match of html.matchAll(anchorPattern)) {
    const index = match.index ?? 0;
    const before = normalizeText(stripTags(html.slice(lastIndex, index)));
    if (before) {
      tokens.push({ type: "text", text: before });
    }

    const href = decodeHtml(match[1]);
    tokens.push({
      type: "anchor",
      text: normalizeText(stripTags(match[2])),
      href,
      url: new URL(href, PAGE_URL).toString(),
    });
    lastIndex = index + match[0].length;
  }

  const rest = normalizeText(stripTags(html.slice(lastIndex)));
  if (rest) {
    tokens.push({ type: "text", text: rest });
  }

  return tokens;
}

function cleanTitle(anchorText: string) {
  const stripped = anchorText
    .replace(/（?(?:エクセル|ワード|PDF)：[^）]+）?/giu, "")
    .replace(/^\s*こちら（リンク）\s*$/u, "勤務形態一覧表")
    .trim();

  return /^（?(?:エクセル|ワード|PDF)/u.test(stripped) ? "" : stripped;
}

function collectOldFormatRefs(tokens: Token[], startIndex: number) {
  const refs: string[] = [];

  for (let index = startIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "anchor") {
      continue;
    }

    if (findFormatNos(token.text).length > 0) {
      break;
    }

    refs.push(...(token.text.match(/旧(?:別紙|様式)\s*[0-9０-９]+(?:[-－・、,，][0-9０-９]+)*/gu) ?? []));
  }

  return Array.from(new Set(refs));
}

function collectNote(tokens: Token[], startIndex: number) {
  const parts: string[] = [];

  for (let index = startIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "anchor") {
      continue;
    }

    if (findFormatNos(token.text).length > 0) {
      break;
    }

    parts.push(token.text);
  }

  return extractNote(parts.join(" "));
}

function extractNote(text: string) {
  const match = text.match(/※[^。]+(?:。|$)/u);
  return match ? match[0].trim() : null;
}

function findFormatNos(text: string) {
  const refs: string[] = [];
  const pattern = /(?:別紙|市様式)\s*[0-9０-９]+(?:[-－][0-9０-９]+)?/gu;

  for (const match of text.matchAll(pattern)) {
    const before = text.slice(Math.max(0, (match.index ?? 0) - 1), match.index ?? 0);
    if (before === "旧") {
      continue;
    }

    refs.push(match[0]);
  }

  return refs;
}

function splitTitleKeywords(title: string) {
  return title
    .replace(/[（）()・、，,]/gu, " ")
    .split(/\s+/u)
    .map((value) => value.trim())
    .filter((value) => value.length >= 3)
    .slice(0, 12);
}

function normalizeFormatNo(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/gu, "")
    .replace("市様式", "市様式")
    .replace("別紙", "別紙");
}

function inferExtension(text: string) {
  if (/ワード/u.test(text)) return ".docx";
  if (/PDF/iu.test(text)) return ".pdf";
  return ".xlsx";
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "_")
    .replace(/\s+/gu, " ")
    .trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/gu, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/gu, "&")
    .replace(/&nbsp;/gu, " ")
    .replace(/&rarr;/gu, "→")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}

function normalizeText(value: string) {
  return decodeHtml(value)
    .replace(/\r?\n/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function quoteYaml(value: string) {
  return JSON.stringify(value);
}

function findLast<T>(values: T[]) {
  return values.length ? values[values.length - 1] : null;
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
