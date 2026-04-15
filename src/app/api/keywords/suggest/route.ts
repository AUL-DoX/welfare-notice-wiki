import { NextResponse } from "next/server";
import { getDocumentBySlug } from "@/lib/documents";
import { suggestKeywordsForDocument } from "@/lib/keyword-suggestions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      slug?: string;
    };

    if (!body.slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const doc = await getDocumentBySlug(body.slug);
    if (!doc) {
      return NextResponse.json({ error: "document not found" }, { status: 404 });
    }

    const result = await suggestKeywordsForDocument(doc);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "failed to suggest keywords",
      },
      { status: 500 },
    );
  }
}
