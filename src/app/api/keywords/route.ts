import { NextResponse } from "next/server";
import { requireAdminMode } from "@/lib/admin";
import { updateDocumentKeywords } from "@/lib/documents";

export async function POST(request: Request) {
  try {
    requireAdminMode(request);
    const body = (await request.json()) as {
      slug?: string;
      keywords?: string[];
    };

    if (!body.slug || !Array.isArray(body.keywords)) {
      return NextResponse.json({ error: "slug and keywords are required" }, { status: 400 });
    }

    const result = await updateDocumentKeywords(body.slug, body.keywords);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "failed to update keywords",
      },
      { status: 500 },
    );
  }
}
