"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentRecord } from "@/lib/documents";

type Props = {
  doc: DocumentRecord;
};

type SuggestState = {
  loading: boolean;
  source: "openai" | "fallback" | null;
  error: string | null;
  suggestions: string[];
  selected: string[];
  saving: boolean;
};

export function DocumentDetailClient({ doc }: Props) {
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus") ?? "";
  const contentRef = useRef<HTMLDivElement>(null);
  const [keywords, setKeywords] = useState(doc.keywords);
  const [suggestState, setSuggestState] = useState<SuggestState>({
    loading: false,
    source: null,
    error: null,
    suggestions: [],
    selected: [],
    saving: false,
  });

  const parts = useMemo(() => splitHighlightedText(doc.body, focus), [doc.body, focus]);

  useEffect(() => {
    if (!focus) {
      return;
    }

    const firstMark = contentRef.current?.querySelector("mark");
    firstMark?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  async function handleSuggestKeywords() {
    setSuggestState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const response = await fetch("/api/keywords/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug: doc.slug }),
      });

      const payload = (await response.json()) as {
        error?: string;
        keywords?: string[];
        source?: "openai" | "fallback";
      };

      if (!response.ok || !Array.isArray(payload.keywords)) {
        throw new Error(payload.error ?? "キーワード候補を取得できませんでした。");
      }

      const suggestions = payload.keywords.filter((keyword) => !keywords.includes(keyword));
      setSuggestState({
        loading: false,
        error: null,
        source: payload.source ?? null,
        suggestions,
        selected: suggestions,
        saving: false,
      });
    } catch (error) {
      setSuggestState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "キーワード候補を取得できませんでした。",
      }));
    }
  }

  function toggleSuggestedKeyword(keyword: string) {
    setSuggestState((current) => ({
      ...current,
      selected: current.selected.includes(keyword)
        ? current.selected.filter((value) => value !== keyword)
        : [...current.selected, keyword],
    }));
  }

  async function handleSaveKeywords() {
    if (suggestState.selected.length === 0) {
      return;
    }

    setSuggestState((current) => ({
      ...current,
      saving: true,
      error: null,
    }));

    try {
      const nextKeywords = Array.from(new Set([...doc.manualKeywords, ...suggestState.selected]));
      const response = await fetch("/api/keywords", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      setSuggestState((current) => ({
        ...current,
        saving: false,
        suggestions: current.suggestions.filter((keyword) => !current.selected.includes(keyword)),
        selected: [],
      }));
    } catch (error) {
      setSuggestState((current) => ({
        ...current,
        saving: false,
        error: error instanceof Error ? error.message : "関連キーワードを保存できませんでした。",
      }));
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">関連キーワード</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500 md:text-base">
                保存済みキーワードを優先表示します。AI候補は確認してから追加できます。
              </p>
            </div>
            <button
              type="button"
              onClick={handleSuggestKeywords}
              disabled={suggestState.loading}
              className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-900 disabled:cursor-wait disabled:bg-stone-400"
            >
              {suggestState.loading ? "AI確認中..." : "AI候補"}
            </button>
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

          {suggestState.error ? (
            <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {suggestState.error}
            </p>
          ) : null}

          {suggestState.suggestions.length > 0 ? (
            <div className="mt-5 space-y-3 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">AI候補</p>
                  <p className="mt-1 text-sm text-stone-600">
                    {suggestState.source === "openai"
                      ? "OpenAIで候補を生成しました。"
                      : "AI未接続のため、本文から候補を整理しました。"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveKeywords}
                  disabled={suggestState.saving || suggestState.selected.length === 0}
                  className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                >
                  {suggestState.saving ? "保存中..." : "選択を保存"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestState.suggestions.map((keyword) => {
                  const selected = suggestState.selected.includes(keyword);
                  return (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => toggleSuggestedKeyword(keyword)}
                      className={[
                        "rounded-full border px-3 py-2 text-left text-base transition md:text-lg",
                        selected
                          ? "border-amber-300 bg-amber-100 text-amber-950"
                          : "border-stone-200 bg-white text-stone-700 hover:border-amber-200 hover:bg-amber-50",
                      ].join(" ")}
                    >
                      {selected ? "追加予定: " : ""}
                      {keyword}
                    </button>
                  );
                })}
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
