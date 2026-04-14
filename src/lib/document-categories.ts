export type DocumentCategory = "unclassified" | "care" | "disability" | "common";

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  unclassified: "未分類",
  care: "介護",
  disability: "障がい福祉",
  common: "共通",
};
