import { cookies } from "next/headers";

export function isAdminModeToken(token?: string | null) {
  const expected = process.env.ADMIN_MODE_TOKEN;
  if (!expected) {
    return false;
  }

  return token === expected;
}

export async function isAdminModeCookie(): Promise<boolean> {
  const expected = process.env.ADMIN_MODE_TOKEN;
  if (!expected) {
    return false;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token")?.value;
  return token === expected;
}

function parseCookieValue(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function requireAdminMode(request: Request) {
  const expected = process.env.ADMIN_MODE_TOKEN;
  if (!expected) {
    throw new Error("admin mode is not configured");
  }

  const headerToken = request.headers.get("x-admin-token");
  if (headerToken === expected) {
    return;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieToken = parseCookieValue(cookieHeader, "admin-token");
  if (cookieToken === expected) {
    return;
  }

  throw new Error("admin token is invalid");
}
