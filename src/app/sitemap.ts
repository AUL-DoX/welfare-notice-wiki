import type { MetadataRoute } from "next";
import { getDocumentIndex } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://wn-wiki.aul-dox.jp";

  const { documents } = await getDocumentIndex();

  const docEntries: MetadataRoute.Sitemap = documents.map((doc) => ({
    url: `${BASE_URL}/docs/${encodeURIComponent(doc.slug)}`,
    lastModified: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...docEntries,
  ];
}
