"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import type { DocumentRecord } from "@/lib/documents";

type Props = {
  doc: DocumentRecord;
};

export function DocumentDetailClient({ doc }: Props) {
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus") ?? "";
  const contentRef = useRef<HTMLDivElement>(null);

  const parts = useMemo(() => splitHighlightedText(doc.body, focus), [doc.body, focus]);

  useEffect(() => {
    if (!focus) {
      return;
    }

    const firstMark = contentRef.current?.querySelector("mark");
    firstMark?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
      <article className="rounded-[2rem] border border-stone-200/80 bg-white p-5 shadow-[0_18px_55px_rgba(55,43,24,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold md:text-3xl">全文</h2>
          {focus ? (
            <Link
              href={`/docs/${encodeURIComponent(doc.slug)}`}
              className="text-base font-semibold text-amber-900 underline decoration-stone-300 underline-offset-4 md:text-lg"
            >
              強調を解除
            </Link>
          ) : null}
        </div>
        <div
          ref={contentRef}
          className="mt-4 whitespace-pre-wrap text-lg leading-[2.4] text-stone-700 md:text-[1.65rem]"
        >
          {parts.length > 0 ? (
            parts.map((part, index) =>
              part.highlight ? (
                <mark key={`${part.text}-${index}`} className="rounded bg-amber-200 px-1 text-stone-900">
                  {part.text}
                </mark>
              ) : (
                <span key={`${part.text}-${index}`}>{part.text}</span>
              ),
            )
          ) : (
            <span>{doc.body || "本文を抽出できませんでした。"}</span>
          )}
        </div>
      </article>

      <aside className="space-y-4 self-start">
        <section className="rounded-[2rem] border border-stone-200/80 bg-white p-5 shadow-[0_18px_55px_rgba(55,43,24,0.06)]">
          <h2 className="text-2xl font-semibold md:text-3xl">関連する文章</h2>
          <div className="mt-4 flex flex-col gap-3">
            {doc.actions.length > 0 ? (
              doc.actions.map((action) => (
                <Link
                  key={action}
                  href={`/docs/${encodeURIComponent(doc.slug)}?focus=${encodeURIComponent(action)}`}
                  className={[
                    "rounded-[1.25rem] border px-4 py-3 text-lg leading-10 transition md:text-[1.6rem]",
                    focus === action
                      ? "border-amber-300 bg-amber-100 text-amber-950"
                      : "border-stone-200 bg-stone-50 text-stone-700 hover:border-amber-200 hover:bg-amber-50",
                  ].join(" ")}
                >
                  {action}
                </Link>
              ))
            ) : (
              <p className="text-lg text-stone-500 md:text-[1.6rem]">抽出できた文章はまだありません。</p>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-200/80 bg-white p-5 shadow-[0_18px_55px_rgba(55,43,24,0.06)]">
          <h2 className="text-2xl font-semibold md:text-3xl">関連キーワード</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {doc.keywords.map((keyword) => (
              <Link
                key={keyword}
                href={`/docs/${encodeURIComponent(doc.slug)}?focus=${encodeURIComponent(keyword)}`}
                className={[
                  "rounded-full border px-3 py-2 text-lg transition md:text-[1.45rem]",
                  focus === keyword
                    ? "border-lime-300 bg-lime-100 text-lime-950"
                    : "border-stone-200 bg-stone-100 text-stone-700 hover:border-lime-200 hover:bg-lime-50 hover:text-lime-900",
                ].join(" ")}
              >
                {keyword}
              </Link>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function splitHighlightedText(text: string, focus: string) {
  if (!focus) {
    return [{ text, highlight: false }];
  }

  const escaped = focus.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, "giu");
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;

    if (start > lastIndex) {
      parts.push({ text: text.slice(lastIndex, start), highlight: false });
    }

    parts.push({ text: text.slice(start, end), highlight: true });
    lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }

  return parts;
}
