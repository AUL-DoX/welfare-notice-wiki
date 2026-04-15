import Link from "next/link";
import { getDocumentIndex } from "@/lib/documents";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/document-categories";
import { CategorySelector } from "@/components/category-selector";
import { isAdminModeCookie } from "@/lib/admin";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = params.q ?? "";
  const [{ documents, sourceCount, failedDocuments }, isAdmin] = await Promise.all([
    getDocumentIndex(query),
    isAdminModeCookie(),
  ]);
  const latestDocument = documents[0] ?? null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5f1e8_0%,#fcfbf8_26%,#f2f4ec_100%)] text-stone-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5 lg:px-8 lg:py-6">
        <section className="grid gap-4 rounded-[2rem] border border-stone-200/70 bg-white/90 p-5 shadow-[0_24px_70px_rgba(55,43,24,0.08)] backdrop-blur md:grid-cols-[1.45fr_0.72fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-900/70">
              AUL Welfare Notice Wiki
            </p>
            <h1 className="max-w-5xl text-[1.8rem] font-semibold leading-[1.08] tracking-[-0.03em] text-stone-900 md:text-[2.45rem]">
              介護と障害福祉サービスの通知文
              <br />
              Wiki
            </h1>
            <p className="max-w-4xl text-lg leading-9 text-stone-700 md:text-xl">
              キーワードを入力すると、介護と障害福祉サービスに関する通知文を検索できます。詳細ページでは、
              運用時に追加した関連キーワードを確認できます。
            </p>
            <form className="flex flex-col gap-3 sm:flex-row" action="/">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="例: 処遇改善加算 交付要綱 補助金"
                className="min-w-0 flex-1 rounded-full border-2 border-stone-400 bg-stone-50 px-5 py-3 text-lg outline-none placeholder:text-stone-400 transition focus:border-amber-800 focus:bg-white md:text-xl"
              />
              <button
                type="submit"
                className="rounded-full bg-stone-900 px-6 py-3 text-base font-semibold text-stone-50 transition hover:bg-amber-900 md:text-lg"
              >
                検索する
              </button>
              {query ? (
                <Link
                  href="/"
                  className="rounded-full border border-stone-300 px-6 py-3 text-center text-base font-semibold text-stone-700 transition hover:border-amber-900 hover:text-amber-900 md:text-lg"
                >
                  検索を解除
                </Link>
              ) : null}
            </form>
          </div>

          <aside className="grid gap-3 self-start rounded-[1.5rem] bg-stone-900 p-4 text-stone-50">
            <div>
              <p className="text-base text-stone-300">登録文書数</p>
              <p className="mt-1 text-4xl font-semibold">{sourceCount}</p>
            </div>
            <div>
              <p className="text-base text-stone-300">このページでできること</p>
              <p className="mt-1 text-lg leading-8 text-stone-100">
                単語で検索
                <br />
                全文ページへ移動
                <br />
                関連キーワードを確認
              </p>
            </div>
          </aside>
        </section>

        {failedDocuments.length > 0 ? (
          <section className="rounded-[1.5rem] border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <h2 className="text-lg font-semibold">読み込みエラー</h2>
            <div className="mt-3 flex flex-col gap-2">
              {failedDocuments.map((item) => (
                <p key={item.fileName} className="rounded-2xl bg-white px-4 py-3 text-sm leading-6">
                  {item.fileName}: {item.error}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500">Documents</p>
              <h2 className="mt-1 text-2xl font-semibold">{query ? `「${query}」の検索結果` : "新着記事"}</h2>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-stone-600">{documents.length}件</p>
              {query ? (
                <Link
                  href="/"
                  className="text-sm font-semibold text-amber-900 underline decoration-stone-300 underline-offset-4 transition hover:decoration-amber-900"
                >
                  検索をクリア
                </Link>
              ) : null}
            </div>
          </div>

          {latestDocument ? (
            <section className="grid gap-3 rounded-[1.75rem] border border-stone-200 bg-white p-4 shadow-[0_12px_35px_rgba(62,45,24,0.06)] lg:grid-cols-[0.8fr_1.35fr_0.95fr] lg:items-start">
              <aside className="rounded-[1.35rem] bg-stone-50 p-4">
                <h3 className="text-lg font-semibold text-stone-900 md:text-xl">日付順一覧</h3>
                <div className="mt-3 flex flex-col gap-3">
                  {documents.map((doc) => (
                    <div key={doc.slug} className="space-y-2">
                      <Link
                        href={`/docs/${encodeURIComponent(doc.slug)}`}
                        className="block rounded-[1rem] bg-white px-4 py-3 transition hover:bg-amber-50"
                      >
                        <p className="text-sm font-medium text-stone-500 md:text-base">
                          {formatDate(doc.uploadedAt)}
                        </p>
                        <p className="mt-1 text-base font-semibold leading-7 text-stone-900 md:text-lg">
                          {doc.title}
                        </p>
                      </Link>
                      <div className="px-1">
                        <CategorySelector slug={doc.slug} category={doc.category} compact editable={isAdmin} />
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              <article className="space-y-4 rounded-[1.35rem] border border-stone-200/70 bg-white px-4 py-4">
                <div className="flex flex-wrap gap-2 text-xs font-medium text-stone-500">
                  <Badge>{latestDocument.sourceType.toUpperCase()}</Badge>
                  {latestDocument.issuer ? <Badge>{latestDocument.issuer}</Badge> : null}
                  {latestDocument.publishedAt ? <Badge>{latestDocument.publishedAt}</Badge> : null}
                  <Badge>{DOCUMENT_CATEGORY_LABELS[latestDocument.category]}</Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-base font-medium text-stone-500 md:text-lg">新着記事</p>
                  <Link
                    href={`/docs/${encodeURIComponent(latestDocument.slug)}`}
                    className="text-2xl font-semibold tracking-tight text-stone-900 hover:text-amber-900 md:text-[2rem]"
                  >
                    {latestDocument.title}
                  </Link>
                  <p className="text-lg leading-8 text-stone-700 md:text-xl">{latestDocument.summary}</p>
                </div>

                <p className="text-lg leading-8 text-stone-700 md:text-[1.15rem]">{latestDocument.preview}</p>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/docs/${encodeURIComponent(latestDocument.slug)}`}
                    className="text-base font-semibold text-amber-900 underline decoration-stone-300 underline-offset-4 transition hover:decoration-amber-900 md:text-lg"
                  >
                    全文を見る
                  </Link>
                  <a
                    href={`/api/files/${encodeURIComponent(latestDocument.slug)}`}
                    className="text-base font-semibold text-stone-700 underline decoration-stone-300 underline-offset-4 transition hover:text-amber-900 hover:decoration-amber-900 md:text-lg"
                  >
                    元ファイルを開く
                  </a>
                </div>

                <CategorySelector slug={latestDocument.slug} category={latestDocument.category} editable={isAdmin} />
              </article>

              <aside className="space-y-3 rounded-[1.35rem] bg-stone-50 p-4">
                <div>
                  <h3 className="text-lg font-semibold text-stone-900 md:text-xl">関連キーワード</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {latestDocument.relatedTerms.length > 0 ? (
                      latestDocument.relatedTerms.slice(0, 10).map((term) => (
                        <Link
                          key={term}
                          href={`/docs/${encodeURIComponent(latestDocument.slug)}?focus=${encodeURIComponent(term)}`}
                          className="rounded-full bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-amber-100 hover:text-amber-900 md:text-base"
                        >
                          {term}
                        </Link>
                      ))
                    ) : (
                      <p className="rounded-[1rem] bg-white px-4 py-3 text-base text-stone-500 md:text-lg">
                        キーワードは詳細画面から追加できます。
                      </p>
                    )}
                  </div>
                </div>
              </aside>
            </section>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white/70 p-8 text-center text-stone-600">
              {query
                ? "検索に一致する文書がありません。別の表現で試してください。"
                : "文書が登録されると、ここに新着記事が表示されます。"}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
      {children}
    </span>
  );
}

function formatDate(updatedAt: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(updatedAt));
}
