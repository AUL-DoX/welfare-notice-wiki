import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from "@/lib/document-categories";

export const SOURCE_DOCS_DIR = path.join(process.cwd(), "source-docs");
const DATA_DIR = path.join(process.cwd(), "data");
const CATEGORY_FILE_PATH = path.join(DATA_DIR, "document-categories.json");
const DOCUMENT_METADATA_FILE_PATH = path.join(DATA_DIR, "document-metadata.json");
const DOCUMENT_KEYWORDS_FILE_PATH = path.join(DATA_DIR, "document-keywords.json");
const require = createRequire(import.meta.url);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
});

const STOP_WORDS = new Set([
  "について",
  "および",
  "または",
  "なお",
  "ただし",
  "という",
  "ため",
  "ところ",
  "以上",
  "以下",
  "各位",
  "こちら",
  "令和",
  "通知",
  "文書",
  "資料",
  "様式",
  "別紙",
  "別添",
  "提出",
  "確認",
  "必要",
  "場合",
  "一覧",
  "対応",
  "送付",
  "対象",
  "厚生労働省",
  "こども家庭庁",
  "都道府県",
  "指定都市",
  "中核市",
  "札幌市",
  "障害福祉課",
  "援護局",
  "万円",
  "千円",
  "円",
  "年",
  "月",
  "日",
  "https",
  "http",
  "www",
  "mhlw",
  "pdf",
  "html",
]);

export type SourceType = "pdf" | "pptx" | "txt" | "md" | "csv";

export type DocumentRecord = {
  slug: string;
  fileName: string;
  filePath: string;
  sourceType: SourceType;
  category: DocumentCategory;
  title: string;
  issuer: string | null;
  publishedAt: string | null;
  deadline: string | null;
  summary: string;
  manualKeywords: string[];
  keywords: string[];
  relatedTerms: string[];
  preview: string;
  body: string;
  slideTitles: string[];
  uploadedAt: string;
  updatedAt: string;
};

type FailedDocument = {
  fileName: string;
  sourceType: string;
  error: string;
};

export type SearchResult = {
  documents: DocumentRecord[];
  sourceCount: number;
  supportedExtensions: string[];
  failedDocuments: FailedDocument[];
};

type CategoryMap = Record<string, DocumentCategory>;
type DocumentMetadataMap = Record<
  string,
  {
    uploadedAt: string;
  }
>;
type DocumentKeywordMap = Record<
  string,
  {
    manualKeywords: string[];
  }
>;

export async function ensureSourceDocsDir() {
  await fs.mkdir(SOURCE_DOCS_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function getDocumentIndex(query?: string): Promise<SearchResult> {
  await ensureSourceDocsDir();

  const entries = await fs.readdir(SOURCE_DOCS_DIR, { withFileTypes: true });
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.name.startsWith(".") &&
        entry.name.toLowerCase() !== "readme.md",
    )
    .map((entry) => path.join(SOURCE_DOCS_DIR, entry.name));

  const categoryMap = await loadCategoryMap();
  const documentMetadata = await loadDocumentMetadata();
  const documentKeywords = await loadDocumentKeywords();
  await syncDocumentMetadata(files, documentMetadata);
  const results = await Promise.all(
    files.map((filePath) => parseDocument(filePath, categoryMap, documentMetadata, documentKeywords)),
  );
  const documents = results
    .flatMap((result) => (result.ok ? [result.document] : []))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt) || b.updatedAt.localeCompare(a.updatedAt));
  const failedDocuments = results.flatMap((result) => (result.ok ? [] : [result.failed]));

  for (const failed of failedDocuments) {
    console.error(`[document-parse] ${failed.fileName}: ${failed.error}`);
  }

  const normalizedQuery = normalizeQuery(query);
  const filtered = normalizedQuery
    ? documents.filter((doc) => matchesQuery(doc, normalizedQuery))
    : documents;

  return {
    documents: filtered,
    sourceCount: documents.length,
    supportedExtensions: [".pdf", ".pptx", ".md", ".txt", ".csv"],
    failedDocuments,
  };
}

export async function getDocumentBySlug(slug: string) {
  const { documents } = await getDocumentIndex();
  return documents.find((doc) => doc.slug === slug) ?? null;
}

export async function getDocumentFileBuffer(slug: string) {
  const doc = await getDocumentBySlug(slug);
  if (!doc) {
    return null;
  }

  return {
    buffer: await fs.readFile(doc.filePath),
    fileName: doc.fileName,
    sourceType: doc.sourceType,
  };
}

export async function updateDocumentCategory(slug: string, category: DocumentCategory) {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    throw new Error("slug is required");
  }

  if (!(category in DOCUMENT_CATEGORY_LABELS)) {
    throw new Error("invalid category");
  }

  const categoryMap = await loadCategoryMap();
  categoryMap[normalizedSlug] = category;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CATEGORY_FILE_PATH, JSON.stringify(categoryMap, null, 2), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EPERM") {
      throw new Error("本番環境ではカテゴリ保存ができません。ローカルでJSONを更新して git push してください。");
    }

    throw error;
  }

  return { slug: normalizedSlug, category };
}

export async function updateDocumentKeywords(slug: string, keywords: string[]) {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    throw new Error("slug is required");
  }

  const manualKeywords = Array.from(
    new Set(
      keywords
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  );

  const keywordMap = await loadDocumentKeywords();
  keywordMap[normalizedSlug] = { manualKeywords };
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DOCUMENT_KEYWORDS_FILE_PATH, JSON.stringify(keywordMap, null, 2), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EPERM") {
      throw new Error("本番環境ではキーワード保存ができません。ローカルでJSONを更新して git push してください。");
    }

    throw error;
  }

  return { slug: normalizedSlug, manualKeywords };
}

async function loadCategoryMap(): Promise<CategoryMap> {
  try {
    const raw = await fs.readFile(CATEGORY_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, DocumentCategory] => {
        const [, value] = entry;
        return typeof value === "string" && value in DOCUMENT_CATEGORY_LABELS;
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function loadDocumentMetadata(): Promise<DocumentMetadataMap> {
  try {
    const raw = await fs.readFile(DOCUMENT_METADATA_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, { uploadedAt?: unknown }>;

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => {
        if (typeof value?.uploadedAt !== "string") {
          return [];
        }

        return [[key, { uploadedAt: value.uploadedAt }]];
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function loadDocumentKeywords(): Promise<DocumentKeywordMap> {
  try {
    const raw = await fs.readFile(DOCUMENT_KEYWORDS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, { manualKeywords?: unknown }>;

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => {
        if (!Array.isArray(value?.manualKeywords)) {
          return [];
        }

        return [
          [
            key,
            {
              manualKeywords: value.manualKeywords.filter(
                (keyword): keyword is string => typeof keyword === "string",
              ),
            },
          ],
        ];
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function syncDocumentMetadata(files: string[], documentMetadata: DocumentMetadataMap) {
  let changed = false;

  for (const filePath of files) {
    const slug = slugify(path.basename(filePath));
    if (documentMetadata[slug]) {
      continue;
    }

    const stats = await fs.stat(filePath);
    documentMetadata[slug] = {
      uploadedAt: stats.birthtime.toISOString(),
    };
    changed = true;
  }

  if (!changed) {
    return;
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DOCUMENT_METADATA_FILE_PATH, JSON.stringify(documentMetadata, null, 2), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // Vercel's runtime filesystem is read-only, so missing metadata should not crash the app.
    if (code === "EROFS" || code === "EPERM") {
      return;
    }

    throw error;
  }
}

async function parseDocument(
  filePath: string,
  categoryMap: CategoryMap,
  documentMetadata: DocumentMetadataMap,
  documentKeywords: DocumentKeywordMap,
) {
  const extension = path.extname(filePath).toLowerCase();

  try {
    switch (extension) {
      case ".pdf":
        return {
          ok: true as const,
          document: await parsePdf(filePath, categoryMap, documentMetadata, documentKeywords),
        };
      case ".pptx":
        return {
          ok: true as const,
          document: await parsePptx(filePath, categoryMap, documentMetadata, documentKeywords),
        };
      case ".md":
      case ".txt":
        return {
          ok: true as const,
          document: await parseTextDocument(filePath, categoryMap, documentMetadata, documentKeywords),
        };
      case ".csv":
        return {
          ok: true as const,
          document: await parseCsvDocument(filePath, categoryMap, documentMetadata, documentKeywords),
        };
      default:
        return {
          ok: false as const,
          failed: {
            fileName: path.basename(filePath),
            sourceType: extension.slice(1) || "unknown",
            error: `unsupported extension: ${extension}`,
          },
        };
    }
  } catch (error) {
    return {
      ok: false as const,
      failed: {
        fileName: path.basename(filePath),
        sourceType: extension.slice(1) || "unknown",
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function parsePdf(
  filePath: string,
  categoryMap: CategoryMap,
  documentMetadata: DocumentMetadataMap,
  documentKeywords: DocumentKeywordMap,
) {
  const buffer = await fs.readFile(filePath);
  const pdfjs = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js") as {
    disableWorker: boolean;
    getDocument: (data: Uint8Array) => Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: (options: {
          normalizeWhitespace: boolean;
          disableCombineTextItems: boolean;
        }) => Promise<{
          items: Array<{
            str: string;
            transform: number[];
          }>;
        }>;
      }>;
      destroy: () => void;
    }>;
  };

  pdfjs.disableWorker = true;
  const document = await pdfjs.getDocument(new Uint8Array(buffer));
  let text = "";

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    });

    let lastY: number | undefined;
    let pageText = "";

    for (const item of textContent.items) {
      if (lastY === undefined || lastY === item.transform[5]) {
        pageText += item.str;
      } else {
        pageText += `\n${item.str}`;
      }
      lastY = item.transform[5];
    }

    text += `\n\n${pageText}`;
  }

  document.destroy();
  return buildRecord(filePath, "pdf", text, [], categoryMap, documentMetadata, documentKeywords);
}

async function parsePptx(
  filePath: string,
  categoryMap: CategoryMap,
  documentMetadata: DocumentMetadataMap,
  documentKeywords: DocumentKeywordMap,
) {
  const buffer = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => extractSlideNumber(left) - extractSlideNumber(right));

  const slides = await Promise.all(
    slideEntries.map(async (name) => {
      const xml = await zip.files[name].async("string");
      const parsed = xmlParser.parse(xml);
      return collectTextNodes(parsed).join("\n").trim();
    }),
  );

  const slideTitles = slides
    .map((slide) => slide.split(/\r?\n/).find((line) => line.trim()))
    .filter((line): line is string => Boolean(line))
    .slice(0, 12);

  return buildRecord(
    filePath,
    "pptx",
    slides.join("\n\n"),
    slideTitles,
    categoryMap,
    documentMetadata,
    documentKeywords,
  );
}

async function parseTextDocument(
  filePath: string,
  categoryMap: CategoryMap,
  documentMetadata: DocumentMetadataMap,
  documentKeywords: DocumentKeywordMap,
) {
  const text = await fs.readFile(filePath, "utf8");
  return buildRecord(
    filePath,
    path.extname(filePath).slice(1) as SourceType,
    text,
    [],
    categoryMap,
    documentMetadata,
    documentKeywords,
  );
}

async function parseCsvDocument(
  filePath: string,
  categoryMap: CategoryMap,
  documentMetadata: DocumentMetadataMap,
  documentKeywords: DocumentKeywordMap,
) {
  const buffer = await fs.readFile(filePath);
  const csvText = decodeCsvBuffer(buffer);
  return buildRecord(filePath, "csv", csvToReadableText(csvText), [], categoryMap, documentMetadata, documentKeywords);
}

function extractSlideNumber(name: string) {
  const match = name.match(/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}

function collectTextNodes(node: unknown): string[] {
  if (typeof node === "string") {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap((item) => collectTextNodes(item));
  }

  if (!node || typeof node !== "object") {
    return [];
  }

  return Object.entries(node).flatMap(([key, value]) => {
    if (key === "t") {
      return typeof value === "string" ? [value] : collectTextNodes(value);
    }

    return collectTextNodes(value);
  });
}

async function buildRecord(
  filePath: string,
  sourceType: SourceType,
  rawText: string,
  slideTitles: string[],
  categoryMap: CategoryMap,
  documentMetadata: DocumentMetadataMap,
  documentKeywords: DocumentKeywordMap,
): Promise<DocumentRecord> {
  const stats = await fs.stat(filePath);
  const normalizedText = normalizeText(rawText);
  const lines = normalizedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const keywords = extractKeywords(`${path.basename(filePath)}\n${normalizedText}`);
  const slug = slugify(path.basename(filePath));
  const uploadedAt = documentMetadata[slug]?.uploadedAt ?? stats.birthtime.toISOString();
  const manualKeywords = documentKeywords[slug]?.manualKeywords ?? [];
  const mergedKeywords = Array.from(new Set([...manualKeywords, ...keywords]));

  return {
    slug,
    fileName: path.basename(filePath),
    filePath,
    sourceType,
    category: categoryMap[slug] ?? "unclassified",
    title: deriveTitle(path.basename(filePath), lines, slideTitles),
    issuer: detectIssuer(normalizedText),
    publishedAt: detectDate(normalizedText),
    deadline: detectDeadline(normalizedText),
    summary: buildSummary(lines),
    manualKeywords,
    keywords: mergedKeywords,
    relatedTerms: mergedKeywords.slice(0, 8),
    preview: buildPreview(normalizedText),
    body: normalizedText,
    slideTitles,
    uploadedAt,
    updatedAt: stats.mtime.toISOString(),
  };
}

function deriveTitle(fileName: string, lines: string[], slideTitles: string[]) {
  const title = [...slideTitles, ...lines].find((line) => line.length >= 4 && line.length <= 100);
  return title ?? fileName.replace(path.extname(fileName), "");
}

function detectIssuer(text: string) {
  const candidates = [
    "厚生労働省",
    "こども家庭庁",
    "札幌市",
    "札幌市役所",
    "北海道",
    "中核市",
    "指定都市",
  ];

  return candidates.find((candidate) => text.includes(candidate)) ?? null;
}

function detectDate(text: string) {
  const patterns = [
    /(20\d{2})[\/\-年\.](\d{1,2})[\/\-月\.](\d{1,2})日?/u,
    /(令和\d+)年(\d{1,2})月(\d{1,2})日/u,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

function detectDeadline(text: string) {
  return (
    splitIntoSentences(text).find((sentence) =>
      /(締切|期限|提出期限|申請期限).{0,30}(まで|必着|期限内)/u.test(sentence),
    ) ?? null
  );
}

function extractKeywords(text: string) {
  const normalized = text
    .replace(/https?:\/\/\S+/giu, " ")
    .replace(/\b(?:www|mhlw|pdf|html?)\b/giu, " ")
    .replace(/[()（）[\]［］「」『』【】]/gu, " ");
  const counts = new Map<string, number>();
  const terms = normalized.match(/[一-龠々ぁ-んァ-ヶA-Za-z0-9ー]{3,30}/gu) ?? [];

  for (const rawTerm of terms) {
    const term = cleanKeywordCandidate(rawTerm);
    if (!term) {
      continue;
    }

    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([term, count]) => ({
      term,
      count,
      score: scoreKeyword(term, count),
    }))
    .filter((entry) => entry.score >= 2)
    .sort((left, right) => right.score - left.score || right.count - left.count || left.term.localeCompare(right.term))
    .map((entry) => entry.term)
    .slice(0, 12);
}

function cleanKeywordCandidate(rawTerm: string) {
  const term = rawTerm.trim().replace(/^[^一-龠々ぁ-んァ-ヶA-Za-z0-9]+|[^一-龠々ぁ-んァ-ヶA-Za-z0-9]+$/gu, "");

  if (!term || STOP_WORDS.has(term) || term.length <= 2) {
    return null;
  }

  if (looksLikeLowSignalKeyword(term)) {
    return null;
  }

  if (/^[A-Za-z0-9_-]+$/u.test(term)) {
    return null;
  }

  if (/^[ぁ-んァ-ヶー]+$/u.test(term) && term.length <= 4) {
    return null;
  }

  return term;
}

function looksLikeLowSignalKeyword(term: string) {
  return (
    /^[0-9０-９]+$/u.test(term) ||
    /^[A-Za-z]{1,2}$/u.test(term) ||
    /^[ぁ-ん]{3,}$/u.test(term) ||
    /^(例えば|ただし|という|または|および|なお|以下|以上|各位|こちら|もの|こと|ため|ところ|について|とおり)$/u.test(term) ||
    /^(https|http|www|mhlw|pdf|html)$/iu.test(term)
  );
}

function scoreKeyword(term: string, count: number) {
  let score = count;

  if (/[一-龠々]/u.test(term)) {
    score += 2;
  }

  if (term.length >= 4 && term.length <= 16) {
    score += 2;
  }

  if (/(加算|支援|福祉|介護|障害|児童|保険|届出|計画|要件|処遇|事業|通知|事務|様式|提出|申請|報酬|改定|調査|基準)/u.test(term)) {
    score += 4;
  }

  if (/(課|局|部|市|県|省)$/u.test(term)) {
    score -= 1;
  }

  return score;
}

function buildSummary(lines: string[]) {
  const summaryLines = lines.filter((line) => line.length >= 20 && line.length <= 120).slice(0, 2);
  return summaryLines.join(" ").slice(0, 220) || "本文を抽出できませんでした。";
}

function buildPreview(text: string) {
  return text.replace(/\s+/g, " ").slice(0, 320);
}

function splitIntoSentences(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n")
    .split(/(?<=[。！？])/u)
    .flatMap((chunk) => chunk.split("\n"))
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function matchesQuery(doc: DocumentRecord, query: string) {
  const haystack = [
    doc.title,
    doc.issuer ?? "",
    doc.summary,
    doc.preview,
    doc.body,
    doc.keywords.join(" "),
    DOCUMENT_CATEGORY_LABELS[doc.category],
  ]
    .join("\n")
    .toLowerCase();

  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function normalizeQuery(query?: string) {
  return query?.trim().toLowerCase() ?? "";
}

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeCsvBuffer(buffer: Buffer) {
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }

  try {
    return new TextDecoder("shift_jis").decode(buffer);
  } catch {
    return utf8;
  }
}

function csvToReadableText(csvText: string) {
  return csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 300)
    .map((row) =>
      row
        .split(",")
        .map((cell) => cell.replace(/^"|"$/g, "").trim())
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}

function slugify(value: string) {
  const base = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(path.extname(value).toLowerCase(), "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  if (base.length > 0) {
    return base;
  }

  const hex = Buffer.from(value.normalize("NFKC"), "utf8").toString("hex");
  return `doc-${hex.slice(0, 24)}`;
}
