import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const expected = process.env.ADMIN_MODE_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "admin mode is not configured" }, { status: 500 });
  }

  const body = (await request.json()) as { token?: string };
  if (body.token !== expected) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin-token", expected, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
