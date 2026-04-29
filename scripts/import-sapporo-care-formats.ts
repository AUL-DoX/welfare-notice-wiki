import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = path.join(ROOT_DIR, "source-docs", "2026");
const META_DIR = path.join(ROOT_DIR, "source-docs", "meta");
const SUPPORTED_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xls", ".docx", ".doc", ".pdf"]);

const PAGES = [
  {
    url: "https://www.city.sapporo.jp/kaigo/k200jigyo/kyotaku-siteikoushinn.html#kimmukeitai",
    folder: "sapporo-care-renewal",
    label: "指定更新申請（居宅サービス・総合事業）",
  },
  {
    url: "https://www.city.sapporo.jp/kaigo/k200jigyo/t_taisei-todokede.html",
    folder: "sapporo-care-taisei",
    label: "加算の届出（地域密着型サービス・居宅介護支援・介護予防支援）",
  },
] as const;

type SourcePage = (typeof PAGES)[number];

type FormatLink = {
  title: string;
  context: string | null;
  url: string;
  extension: string;
  page: SourcePage;
};

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const skipDownload = args.has("--meta-only");
  const refreshMeta = args.has("--refresh-meta");

  const links = (await Promise.all(PAGES.map(parsePage))).flat();

  if (dryRun) {
    console.log(`${links.length} files found`);
    for (const link of links) {
      console.log([link.page.folder, link.title, link.extension, link.url].join(" | "));
    }
    return;
  }

  await fs.mkdir(META_DIR, { recursive: true });
  let downloaded = 0;
  let skipped = 0;
  let metaWritten = 0;

  for (const page of PAGES) {
    await fs.mkdir(path.join(SOURCE_ROOT, page.folder), { recursive: true });
  }

  for (const link of links) {
    const fileName = makeFileName(link);
    const filePath = path.join(SOURCE_ROOT, link.page.folder, fileName);

    if (!skipDownload) {
      if (await fileExists(filePath)) {
        skipped += 1;
      } else {
        await fs.writeFile(filePath, await fetchBytes(link.url));
        downloaded += 1;
      }
    }

    const metaPath = path.join(META_DIR, `${path.basename(fileName, path.extname(fileName))}.md`);
    if (!(await fileExists(metaPath)) || refreshMeta) {
      await fs.writeFile(metaPath, buildMetaMarkdown(link, fileName), "utf8");
      metaWritten += 1;
    }
  }

  console.log(`Imported ${links.length} files. downloaded=${downloaded} skipped=${skipped} meta=${metaWritten}`);
}

async function parsePage(page: SourcePage): Promise<FormatLink[]> {
  const html = await fetchText(page.url);
  const tokens = tokenize(html, page.url);
  const links: FormatLink[] = [];
  const seen = new Set<string>();
  let currentContext: string | null = page.label;

  for (const token of tokens) {
    if (token.type === "text") {
      const context = extractContext(token.text);
      if (context) currentContext = context;
      continue;
    }

    const extension = path.extname(new URL(token.url).pathname).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      continue;
    }

    const anchorTitle = cleanAnchorTitle(token.text);
    if (!anchorTitle || anchorTitle === "こちら" || seen.has(token.url)) {
      continue;
    }

    seen.add(token.url);
    links.push({
      title: buildTitle(anchorTitle, currentContext, page.label),
      context: currentContext,
      url: token.url,
      extension,
      page,
    });
  }

  return links;
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

type Token =
  | { type: "text"; text: string }
  | { type: "anchor"; text: string; href: string; url: string };

function tokenize(html: string, baseUrl: string): Token[] {
  const tokens: Token[] = [];
  const main = html.match(/<main\b[\s\S]*?<\/main>/iu)?.[0] ?? html;
  const anchorPattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/giu;
  let lastIndex = 0;

  for (const match of main.matchAll(anchorPattern)) {
    const index = match.index ?? 0;
    const before = htmlToText(main.slice(lastIndex, index));
    if (before) tokens.push({ type: "text", text: before });

    const href = decodeHtml(match[1]);
    tokens.push({
      type: "anchor",
      text: normalizeInlineText(stripTags(match[2])),
      href,
      url: new URL(href, baseUrl).toString(),
    });
    lastIndex = index + match[0].length;
  }

  const rest = htmlToText(main.slice(lastIndex));
  if (rest) tokens.push({ type: "text", text: rest });

  return tokens;
}

function htmlToText(value: string) {
  return normalizeLines(
    decodeHtml(value)
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/td|\/th|\/h[1-6])\b[^>]*>/giu, "\n")
      .replace(/<[^>]+>/gu, " "),
  );
}

function extractContext(text: string) {
  const lines = text
    .split(/\n+/u)
    .map(cleanContextLine)
    .filter(Boolean)
    .filter((line) => !isBoilerplateContext(line));

  return lines.at(-1) ?? null;
}

function cleanAnchorTitle(value: string) {
  return normalizeInlineText(value)
    .replace(/^■\s*/u, "")
    .replace(/（(?:エクセル|ワード|PDF|Excel|Word)[^）]*）/giu, "")
    .replace(/\((?:エクセル|ワード|PDF|Excel|Word)[^)]*\)/giu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function cleanContextLine(value: string) {
  return normalizeInlineText(value)
    .replace(/^[\d\s]+$/u, "")
    .replace(/^[・■]+/u, "")
    .trim();
}

function isBoilerplateContext(value: string) {
  return (
    value.length < 2 ||
    /^(ここから本文です|ページの先頭へ戻る|エクセル版|PDF版|付表|添付|書類|番号|各種様式)$/u.test(value) ||
    /^(更新日|ホーム|検索|文字サイズ|お問い合わせ先|このページについて)/u.test(value) ||
    /^(申請書等の押印は不要です|書類作成時は必ず|指定更新申請書及び必要書類|必要な添付書類は|※)/u.test(value)
  );
}

function buildTitle(anchorTitle: string, context: string | null, pageLabel: string) {
  const base = anchorTitle.replace(/\s+/gu, " ").trim();
  const contextLabel = context && context !== pageLabel ? context.replace(/\s+/gu, " ").trim() : "";

  if (!contextLabel || base.includes(contextLabel) || contextLabel.includes(base)) {
    return base;
  }

  if (/^(標準様式|別紙|付表|更新様式)/u.test(base)) {
    return `${base} ${contextLabel}`;
  }

  if (/^(標準様式|別紙|付表|更新様式)/u.test(contextLabel)) {
    return `${contextLabel} ${base}`;
  }

  return `${base}（${contextLabel}）`;
}

function makeFileName(link: FormatLink) {
  const remoteName = decodeURIComponent(path.basename(new URL(link.url).pathname));
  const remoteStem = path.basename(remoteName, path.extname(remoteName));
  const extensionLabel = link.extension.slice(1);
  const baseName = sanitizeFileName(`${link.title}_${remoteStem}_${extensionLabel}`).slice(0, 150).replace(/[. ]+$/u, "");
  return `${baseName || "sapporo-care-format"}${link.extension}`;
}

function buildMetaMarkdown(link: FormatLink, fileName: string) {
  const keywords = Array.from(
    new Set(
      [
        "札幌市",
        "介護保険",
        "介護保険サービス",
        link.page.label,
        link.context,
        ...splitTitleKeywords(link.title),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  return [
    "---",
    "category: care",
    `title: ${quoteYaml(link.title)}`,
    "source: 札幌市",
    `source_page: ${link.page.url}`,
    `source_url: ${link.url}`,
    `retrieved_at: ${new Date().toISOString()}`,
    link.context ? `context: ${quoteYaml(link.context)}` : null,
    "keywords:",
    ...keywords.map((keyword) => `  - ${quoteYaml(keyword)}`),
    "---",
    "",
    `# ${link.title}`,
    "",
    `- 元ファイル: [[2026/${link.page.folder}/${fileName}]]`,
    `- 掲載元: [札幌市 ${link.page.label}](${link.page.url})`,
    `- 直接URL: ${link.url}`,
    "",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function splitTitleKeywords(title: string) {
  return title
    .replace(/[（）()【】・、。／/]/gu, " ")
    .split(/\s+/u)
    .map((value) => value.trim())
    .filter((value) => value.length >= 2)
    .slice(0, 16);
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

function normalizeLines(value: string) {
  return value
    .replace(/\r\n?/gu, "\n")
    .split(/\n/gu)
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function normalizeInlineText(value: string) {
  return decodeHtml(value).replace(/\s+/gu, " ").trim();
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "_")
    .replace(/\s+/gu, " ")
    .trim();
}

function quoteYaml(value: string) {
  return JSON.stringify(value);
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
