import { NextResponse } from "next/server";
import { getDocumentFileBuffer } from "@/lib/documents";

type RouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { slug } = await params;
  const file = await getDocumentFileBuffer(slug);

  if (!file) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const contentType = getContentType(file.sourceType);

  return new NextResponse(file.buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    },
  });
}

function getContentType(type: string) {
  switch (type) {
    case "pdf":
      return "application/pdf";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xlsm":
      return "application/vnd.ms-excel.sheet.macroEnabled.12";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "md":
      return "text/markdown; charset=utf-8";
    case "csv":
      return "text/csv; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}
