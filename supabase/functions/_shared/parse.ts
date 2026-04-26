/**
 * Extract the resource ID from the URL path.
 * e.g. pathname="/works/some-uuid" with functionName="works" → "some-uuid"
 *      pathname="/works" → null
 */
export function extractId(url: URL, functionName: string): string | null {
  const prefix = `/${functionName}`;
  const rest = url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : "";
  const trimmed = rest.replace(/^\//, "");
  return trimmed || null;
}

export function getQueryParam(url: URL, name: string): string | null {
  return url.searchParams.get(name);
}

export function getIntParam(url: URL, name: string, defaultVal: number): number {
  const v = url.searchParams.get(name);
  return v ? parseInt(v, 10) : defaultVal;
}

export function getBoolParam(url: URL, name: string): boolean | null {
  const v = url.searchParams.get(name);
  if (v === null) return null;
  return v === "true" || v === "1";
}
