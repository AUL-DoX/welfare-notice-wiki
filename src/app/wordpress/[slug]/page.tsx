import { notFound } from "next/navigation";
import { getDocumentBySlug } from "@/lib/documents";
import { renderWordPressPreviewDocument } from "@/lib/wordpress";

type WordPressPreviewProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function WordPressPreview({ params }: WordPressPreviewProps) {
  const { slug } = await params;
  const doc = await getDocumentBySlug(decodeURIComponent(slug));

  if (!doc) {
    notFound();
  }

  return (
    <iframe
      title={`${doc.title} WordPress preview`}
      srcDoc={renderWordPressPreviewDocument(doc)}
      className="min-h-screen w-full border-0"
    />
  );
}
