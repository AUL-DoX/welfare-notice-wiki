"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentRecord } from "@/lib/documents";

type Props = {
  doc: DocumentRecord;
  isAdmin?: boolean;
  adminToken?: string | null;
};

export function DocumentDetailClient({ doc, isAdmin = false, adminToken = null }: Props) {
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus") ?? "";
  const contentRef = useRef<HTMLDivElement>(null);
  const [keywords, setKeywords] = useState(doc.keywords);
  const [keywordInput, setKeywordInput] = useState("");
  const [saveState, setSaveState] = useState<{
    saving: boolean;
    error: string | null;
    message: string | null;
  }>({
    saving: false,
    error: null,
    message: null,
  });

  const parts = useMemo(() => splitHighlightedText(doc.body, focus), [doc.body, focus]);

  useEffect(() => {
    if (!focus) {
      return;
    }

    const firstMark = contentRef.current?.querySelector("mark");
    firstMark?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  async function handleSaveKeywords() {
    const addedKeywords = keywordInput
      .split(/[,\n、#\s]+/u)
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (addedKeywords.length === 0) {
      setSaveState({
        saving: false,
        error: "追加するキーワードを入力してください。",
        message: null,
      });
      return;
    }

    setSaveState({
      saving: true,
      error: null,
      message: null,
    });

    try {
      const nextKeywords = Array.from(new Set([...doc.manualKeywords, ...keywords, ...addedKeywords]));
      const response = await fetch("/api/keywords", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { "x-admin-token": adminToken } : {}),
        },
        body: JSON.stringify({
          slug: doc.slug,
          keywords: nextKeywords,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        manualKeywords?: string[];
      };

      if (!response.ok || !Array.isArray(payload.manualKeywords)) {
        throw new Error(payload.error ?? "関連キーワードを保存できませんでした。");
      }

      const mergedKeywords = Array.from(new Set([...payload.manualKeywords, ...doc.keywords]));
      setKeywords(mergedKeywords);
      setKeywordInput("");
      setSaveState({
        saving: false,
        error: null,
        message: "関連キーワードを保存しました。",
      });
    } catch (error) {
      setSaveState({
        saving: false,
        error: error instanceof Error ? error.message : "関連キーワードを保存できませんでした。",
        message: null,
      });
    }
  }

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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">関連キーワード</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500 md:text-base">
                ChatGPT で作ったハッシュタグや、運用上追加したい用語をここで保存します。
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {keywords.map((keyword) => (
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

          {isAdmin ? (
            <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
              <label className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                管理者用キーワード追加
              </label>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                カンマ、改行、スペース、`#` 区切りでまとめて追加できます。
              </p>
              <textarea
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                placeholder="#処遇改善加算 #障害福祉サービス #交付要綱"
                className="mt-3 min-h-32 w-full rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3 text-base leading-7 text-stone-800 outline-none transition focus:border-amber-400"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-sm text-stone-500">
                  {saveState.error ? <span className="text-rose-600">{saveState.error}</span> : null}
                  {saveState.message ? <span className="text-emerald-700">{saveState.message}</span> : null}
                </div>
                <button
                  type="button"
                  onClick={handleSaveKeywords}
                  disabled={saveState.saving}
                  className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-900 disabled:cursor-wait disabled:bg-stone-400"
                >
                  {saveState.saving ? "保存中..." : "関連キーワードを保存"}
                </button>
              </div>
            </div>
          ) : null}
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
