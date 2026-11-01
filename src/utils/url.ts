import type { KeyValueRow } from "../types/collection";

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

/** URL 拆分：?query 解码进参数表 */
export function splitUrl(url: string): { base: string; rows: KeyValueRow[] } {
  const qIndex = url.indexOf("?");
  if (qIndex < 0) return { base: url, rows: [] };
  const base = url.slice(0, qIndex);
  const query = url.slice(qIndex + 1);
  const rows: KeyValueRow[] = [];
  for (const part of query.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const key = eq < 0 ? part : part.slice(0, eq);
    const value = eq < 0 ? "" : part.slice(eq + 1);
    rows.push({
      key: decodeSafe(key),
      value: decodeSafe(value),
      enabled: true,
    });
  }
  return { base, rows };
}

/** 参数表重建 URL（未启用的行不进 URL，与 Postman 一致） */
export function joinUrl(base: string, rows: KeyValueRow[]): string {
  const qs = rows
    .filter((r) => r.enabled && r.key.trim())
    .map((r) => `${encodeURIComponent(r.key)}=${encodeURIComponent(r.value)}`)
    .join("&");
  return qs ? `${base}?${qs}` : base;
}
