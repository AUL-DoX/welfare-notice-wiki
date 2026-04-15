import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocumentBySlug } from "@/lib/documents";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/document-categories";
import { CategorySelector } from "@/components/category-selector";
import { DocumentDetailClient } from "@/components/document-detail-client";

export const dynamic = "force-dynamic";

type DetailProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function DocumentDetail({ params }: DetailProps) {
  const { slug } = await params;
  const doc = await getDocumentBySlug(decodeURIComponent(slug));

  if (!doc) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f4ec_0%,#fafaf7_50%,#eef1e7_100%)] px-5 py-6 text-stone-900 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <Link href="/" className="text-base font-medium text-stone-600 hover:text-amber-900 md:text-lg">
          一覧に戻る
        </Link>

        <section className="grid gap-4 rounded-[2rem] border border-stone-200/80 bg-white/90 p-5 shadow-[0_24px_70px_rgba(55,43,24,0.08)] lg:grid-cols-[1.5fr_0.8fr] lg:items-start">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs font-medium text-stone-500">
              <Badge>{doc.sourceType.toUpperCase()}</Badge>
              {doc.issuer ? <Badge>{doc.issuer}</Badge> : null}
              {doc.publishedAt ? <Badge>{doc.publishedAt}</Badge> : null}
              <Badge>{DOCUMENT_CATEGORY_LABELS[doc.category]}</Badge>
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-stone-900">{doc.title}</h1>
              <p className="mt-3 text-xl leading-10 text-stone-700">{doc.summary}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={`/api/files/${encodeURIComponent(doc.slug)}`}
                className="rounded-full bg-stone-900 px-5 py-3 text-base font-semibold text-stone-50 transition hover:bg-amber-900 md:text-lg"
              >
                元ファイルを開く
              </a>
              <Link
                href={`/wordpress/${encodeURIComponent(doc.slug)}`}
                className="rounded-full bg-amber-100 px-5 py-3 text-base font-semibold text-amber-950 transition hover:bg-amber-200 md:text-lg"
              >
                WordPress用HTML
              </Link>
              <Link
                href={`/?q=${encodeURIComponent(doc.title.split(" ").slice(0, 2).join(" "))}`}
                className="rounded-full border border-stone-300 px-5 py-3 text-base font-semibold text-stone-800 transition hover:border-amber-900 hover:text-amber-900 md:text-lg"
              >
                近い文書を探す
              </Link>
            </div>
            <CategorySelector slug={doc.slug} category={doc.category} />
          </div>

          <aside className="self-start space-y-4 rounded-[1.5rem] bg-stone-50 p-4">
            <DetailBlock label="原本ファイル">{doc.fileName}</DetailBlock>
            <DetailBlock label="締切候補">{doc.deadline ?? "未抽出"}</DetailBlock>
            <DetailBlock label="アップロード日">
              {new Intl.DateTimeFormat("ja-JP", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(doc.uploadedAt))}
            </DetailBlock>
          </aside>
        </section>

        <DocumentDetailClient doc={doc} />
      </div>
    </main>
  );
}

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-base font-semibold tracking-[0.08em] text-stone-500 md:text-lg">{label}</p>
      <div className="mt-2 text-lg leading-9 text-stone-800 md:text-[1.6rem]">{children}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
      {children}
    </span>
  );
}
