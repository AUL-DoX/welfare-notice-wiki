import { NextResponse } from "next/server";
import { requireAdminMode } from "@/lib/admin";
import { updateDocumentCategory } from "@/lib/documents";
import type { DocumentCategory } from "@/lib/document-categories";

export async function POST(request: Request) {
  try {
    requireAdminMode(request);
    const body = (await request.json()) as {
      slug?: string;
      category?: string;
    };

    if (!body.slug || !body.category) {
      return NextResponse.json({ error: "slug and category are required" }, { status: 400 });
    }

    const result = await updateDocumentCategory(body.slug, body.category as DocumentCategory);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "failed to update category",
      },
      { status: 500 },
    );
  }
}
