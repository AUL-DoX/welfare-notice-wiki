export function isAdminModeToken(token?: string | null) {
  const expected = process.env.ADMIN_MODE_TOKEN;
  if (!expected) {
    return false;
  }

  return token === expected;
}

export function requireAdminMode(request: Request) {
  const expected = process.env.ADMIN_MODE_TOKEN;
  if (!expected) {
    throw new Error("admin mode is not configured");
  }

  const provided = request.headers.get("x-admin-token");
  if (provided !== expected) {
    throw new Error("admin token is invalid");
  }
}
