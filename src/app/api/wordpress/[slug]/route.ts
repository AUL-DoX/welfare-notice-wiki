import { NextResponse } from "next/server";
import { getDocumentBySlug } from "@/lib/documents";
import { renderWordPressHtml } from "@/lib/wordpress";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const doc = await getDocumentBySlug(decodeURIComponent(slug));

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return new NextResponse(renderWordPressHtml(doc), {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
