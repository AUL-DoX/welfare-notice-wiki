"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from "@/lib/document-categories";

const CATEGORY_ORDER: DocumentCategory[] = ["unclassified", "care", "disability", "common"];

type Props = {
  slug: string;
  category: DocumentCategory;
  compact?: boolean;
  editable?: boolean;
  adminToken?: string | null;
};

export function CategorySelector({ slug, category, compact = false, editable = false, adminToken = null }: Props) {
  const router = useRouter();
  const [savingCategory, setSavingCategory] = useState<DocumentCategory | null>(null);

  async function updateCategory(nextCategory: DocumentCategory) {
    if (nextCategory === category) {
      return;
    }

    setSavingCategory(nextCategory);

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { "x-admin-token": adminToken } : {}),
        },
        body: JSON.stringify({
          slug,
          category: nextCategory,
        }),
      });

      if (!response.ok) {
        throw new Error("カテゴリの保存に失敗しました。");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error(error);
    } finally {
      setSavingCategory(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className={compact ? "text-xs font-medium text-stone-500" : "text-sm font-medium text-stone-500"}>
        サービス種別
      </p>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_ORDER.map((entry) => {
          const isActive = entry === category;
          const isSaving = entry === savingCategory;

          return (
            <button
              key={entry}
              type="button"
              onClick={() => editable && updateCategory(entry)}
              disabled={!editable || Boolean(savingCategory)}
              className={[
                "rounded-full border px-3 py-2 font-medium transition",
                compact ? "text-xs" : "text-sm md:text-base",
                getCategoryButtonClass(entry, isActive),
                isSaving ? "opacity-70" : "",
                editable ? "" : "cursor-default",
              ].join(" ")}
            >
              {DOCUMENT_CATEGORY_LABELS[entry]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getCategoryButtonClass(category: DocumentCategory, isActive: boolean) {
  switch (category) {
    case "care":
      return isActive
        ? "border-sky-300 bg-sky-100 text-sky-950"
        : "border-sky-200 bg-white text-stone-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900";
    case "disability":
      return isActive
        ? "border-orange-300 bg-orange-100 text-orange-950"
        : "border-orange-200 bg-white text-stone-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900";
    case "common":
      return isActive
        ? "border-amber-300 bg-amber-100 text-amber-950"
        : "border-amber-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900";
    case "unclassified":
    default:
      return isActive
        ? "border-rose-300 bg-rose-100 text-rose-950"
        : "border-rose-200 bg-white text-stone-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-900";
  }
}
