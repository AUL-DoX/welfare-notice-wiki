/**
 * WordPress REST API 投稿スクリプト
 *
 * 使い方:
 *   tsx scripts/wp-publish.ts --list               # slug 一覧を表示
 *   tsx scripts/wp-publish.ts --slug=<slug>        # 1件だけ投稿
 *   tsx scripts/wp-publish.ts --all                # 全件投稿
 *   tsx scripts/wp-publish.ts --all --dry-run      # 実際には送信しない確認
 *
 * .env.local に以下を追記してください:
 *   WP_URL=https://aul-dox.jp
 *   WP_USER=<ユーザー名>
 *   WP_APP_PASSWORD=<アプリパスワード>
 */

import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getDocumentIndex, getDocumentBySlug, type DocumentRecord } from "@/lib/documents";
import { renderWordPressHtml } from "@/lib/wordpress";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── .env ローダー ──────────────────────────────────────────────────────────────

async function loadEnvFile(envPath: string) {
  const text = await fs.readFile(envPath, "utf8").catch(() => "");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (!process.env[key]) {
      process.env[key] = raw.replace(/^["']|["']$/g, "").trim();
    }
  }
}

// ── WordPress API クライアント ──────────────────────────────────────────────────

type WpTerm = { id: number; name: string; slug: string };
type WpPost = { id: number; slug: string; link: string };

class WpClient {
  private readonly apiBase: string;
  private readonly authHeader: string;

  constructor(siteUrl: string, user: string, appPassword: string) {
    this.apiBase = siteUrl.replace(/\/$/, "") + "/wp-json/wp/v2";
    this.authHeader = "Basic " + Buffer.from(`${user}:${appPassword}`).toString("base64");
  }

  private async req<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "(no body)");
      throw new Error(`WP API ${method} ${endpoint} → HTTP ${res.status}: ${msg}`);
    }

    return res.json() as Promise<T>;
  }

  /** taxonomy に name が存在すれば ID を返し、なければ作成して ID を返す */
  async getOrCreateTerm(
    taxonomy: "categories" | "tags",
    name: string,
    termCache: Map<string, number>,
  ): Promise<number> {
    const cacheKey = `${taxonomy}:${name}`;
    if (termCache.has(cacheKey)) return termCache.get(cacheKey)!;

    const results = await this.req<WpTerm[]>(
      "GET",
      `/${taxonomy}?search=${encodeURIComponent(name)}&per_page=20`,
    );
    const existing = results.find((t) => t.name === name);
    const id = existing
      ? existing.id
      : (await this.req<WpTerm>("POST", `/${taxonomy}`, { name })).id;

    termCache.set(cacheKey, id);
    return id;
  }

  /** スラッグで既存投稿を検索（下書き含む） */
  async findPostBySlug(slug: string): Promise<WpPost | null> {
    const results = await this.req<WpPost[]>(
      "GET",
      `/posts?slug=${encodeURIComponent(slug)}&status=any&per_page=1`,
    );
    return results[0] ?? null;
  }

  async createPost(data: object): Promise<WpPost> {
    return this.req<WpPost>("POST", "/posts", data);
  }

  async updatePost(id: number, data: object): Promise<WpPost> {
    return this.req<WpPost>("POST", `/posts/${id}`, data);
  }
}

// ── カテゴリ名マッピング ────────────────────────────────────────────────────────

const WP_CATEGORY_NAME: Record<string, string> = {
  disability: "障がい福祉",
  care: "介護",
  common: "共通",
  unclassified: "未分類",
};

// ── 1件投稿 ───────────────────────────────────────────────────────────────────

async function publishDocument(
  doc: DocumentRecord,
  client: WpClient,
  termCache: Map<string, number>,
  dryRun: boolean,
): Promise<void> {
  const categoryName = WP_CATEGORY_NAME[doc.category] ?? "未分類";

  if (dryRun) {
    const tagList = doc.keywords.slice(0, 15).join(", ");
    console.log(`  [dry-run] "${doc.title}"`);
    console.log(`            category=${categoryName}  tags=${tagList}`);
    return;
  }

  // カテゴリ・タグを解決
  const categoryId = await client.getOrCreateTerm("categories", categoryName, termCache);
  const tagIds = await Promise.all(
    doc.keywords
      .slice(0, 15) // タグは最大15件
      .map((kw) => client.getOrCreateTerm("tags", kw, termCache)),
  );

  const html = renderWordPressHtml(doc);

  const postData = {
    title: doc.title,
    content: html,
    excerpt: doc.summary,
    slug: doc.slug,
    status: "draft",
    categories: [categoryId],
    tags: tagIds,
  };

  const existing = await client.findPostBySlug(doc.slug);

  if (existing) {
    const updated = await client.updatePost(existing.id, postData);
    console.log(`  updated  ID=${updated.id}  "${doc.title}"`);
  } else {
    const created = await client.createPost(postData);
    console.log(`  created  ID=${created.id}  "${doc.title}"`);
  }
}

// ── メイン ────────────────────────────────────────────────────────────────────

async function main() {
  await loadEnvFile(path.join(ROOT_DIR, ".env"));
  await loadEnvFile(path.join(ROOT_DIR, ".env.local"));

  const WP_URL = process.env.WP_URL;
  const WP_USER = process.env.WP_USER;
  const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

  const args = process.argv.slice(2);
  const slugArg = args.find((a) => a.startsWith("--slug="))?.slice("--slug=".length);
  const all = args.includes("--all");
  const listOnly = args.includes("--list");
  const dryRun = args.includes("--dry-run");

  // --list: slug 一覧を出すだけ（認証不要）
  if (listOnly) {
    const { documents } = await getDocumentIndex();
    console.log("利用可能なスラッグ一覧:");
    for (const doc of documents) {
      console.log(`  ${doc.slug.padEnd(50)}  ${doc.title}`);
    }
    return;
  }

  if (!slugArg && !all) {
    console.error(
      [
        "使い方:",
        "  tsx scripts/wp-publish.ts --list",
        "  tsx scripts/wp-publish.ts --slug=<slug>",
        "  tsx scripts/wp-publish.ts --all",
        "  tsx scripts/wp-publish.ts --all --dry-run",
      ].join("\n"),
    );
    process.exit(1);
  }

  if (!dryRun && (!WP_URL || !WP_USER || !WP_APP_PASSWORD)) {
    console.error(
      [
        "環境変数が不足しています。.env または .env.local に以下を追記してください:",
        "  WP_URL=https://aul-dox.jp",
        "  WP_USER=<ユーザー名>",
        "  WP_APP_PASSWORD=<アプリパスワード>",
      ].join("\n"),
    );
    process.exit(1);
  }

  const client = dryRun
    ? (null as unknown as WpClient)
    : new WpClient(WP_URL!, WP_USER!, WP_APP_PASSWORD!);
  const termCache = new Map<string, number>();

  let docs: DocumentRecord[];

  if (slugArg) {
    const doc = await getDocumentBySlug(slugArg);
    if (!doc) {
      const { documents } = await getDocumentIndex();
      console.error(`スラッグ "${slugArg}" が見つかりません。`);
      console.error("利用可能なスラッグ: " + documents.map((d) => d.slug).join(", "));
      process.exit(1);
    }
    docs = [doc];
  } else {
    const result = await getDocumentIndex();
    docs = result.documents;
  }

  const target = dryRun ? "(dry-run)" : WP_URL!;
  console.log(`\n${docs.length} 件を ${target} に投稿します...\n`);

  let ok = 0;
  let ng = 0;

  for (const doc of docs) {
    try {
      await publishDocument(doc, client, termCache, dryRun);
      ok++;
    } catch (err) {
      console.error(`  ERROR  "${doc.fileName}": ${err instanceof Error ? err.message : String(err)}`);
      ng++;
    }
  }

  console.log(`\n完了: 成功 ${ok} 件 / 失敗 ${ng} 件`);
  if (ng > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
