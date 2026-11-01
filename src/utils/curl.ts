/** cURL 生成（Linux / Windows cmd 两种风格）与 cURL 命令解析导入 */
import type { SendOptions } from "./send";
import type { RequestData, KeyValueRow } from "../types/collection";

export type CurlFlavor = "linux" | "windows";

function quote(s: string, kind: CurlFlavor): string {
  if (kind === "linux") return `'${s.replace(/'/g, `'\\''`)}'`;
  return `"${s.replace(/"/g, `\\"`)}"`;
}

/** 把发送载荷转成 cURL 命令（SOAP/REST 通用：调用方组装好 headers + body 即可） */
export function toCurl(opts: SendOptions, kind: CurlFlavor): string {
  const sep = kind === "linux" ? " \\\n  " : " ^\n  ";
  const parts: string[] = [`curl -X ${opts.method}`];
  for (const h of opts.headers) {
    parts.push(`-H ${quote(`${h.key}: ${h.value}`, kind)}`);
  }
  switch (opts.body.type) {
    case "json":
    case "raw":
    case "urlencoded":
      if (opts.body.content) parts.push(`--data ${quote(opts.body.content, kind)}`);
      break;
    case "form":
      for (const r of opts.body.rows) parts.push(`-F ${quote(`${r.key}=${r.value}`, kind)}`);
      for (const f of opts.body.files) parts.push(`-F ${quote(`${f.name}=@${f.path}`, kind)}`);
      break;
    default:
      break;
  }
  parts.push(quote(opts.url, kind));
  return parts.join(sep);
}

// ===== cURL 解析导入 =====

function joinContinuations(text: string): string {
  return text
    .replace(/\\\r?\n/g, " ") // bash 续行
    .replace(/\^\r?\n/g, " ") // cmd 续行
    .replace(/\r?\n/g, " ");
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (const c of text) {
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }
    if (c === " " || c === "\t") {
      if (cur) {
        tokens.push(cur);
        cur = "";
      }
      continue;
    }
    cur += c;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export type ParseCurlResult =
  | { ok: true; name: string; request: RequestData }
  | { ok: false; error: string };

/** 解析 cURL 命令 → 请求模型（支持 -X -H -d/--data* -F -u --url，兼容 bash/cmd 续行） */
export function parseCurl(text: string): ParseCurlResult {
  const tokens = tokenize(joinContinuations(text.trim()));
  if (tokens.length === 0 || !/^curl(\.exe)?$/i.test(tokens[0])) {
    return { ok: false, error: "不是以 curl 开头的有效命令" };
  }

  let method = "GET";
  let url = "";
  const headers: KeyValueRow[] = [];
  const formRows: KeyValueRow[] = [];
  let dataParts: string[] = [];
  let hasData = false;
  let dataIsForm = false;
  let basicUser: string | null = null;
  let basicPass: string | null = null;
  let hasBodyFlag = false;

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    const next = () => tokens[++i] ?? "";
    switch (t) {
      case "-X":
      case "--request":
        method = next().toUpperCase();
        hasBodyFlag = method !== "GET";
        break;
      case "--url":
        url = next();
        break;
      case "-H":
      case "--header": {
        const raw = next();
        const idx = raw.indexOf(":");
        if (idx > 0) {
          const key = raw.slice(0, idx).trim();
          const value = raw.slice(idx + 1).trim();
          if (/^content-type$/i.test(key)) continue; // 由 body 类型自动决定
          headers.push({ key, value, enabled: true });
        }
        break;
      }
      case "-d":
      case "--data":
      case "--data-raw":
      case "--data-binary":
      case "--data-ascii":
      case "--data-urlencode":
        dataParts.push(next());
        hasData = true;
        dataIsForm = dataIsForm || t === "--data-urlencode";
        break;
      case "-F":
      case "--form":
      case "--form-string": {
        const raw = next();
        const eq = raw.indexOf("=");
        if (eq > 0) {
          const key = raw.slice(0, eq);
          const value = raw.slice(eq + 1);
          const isFile = value.startsWith("@");
          formRows.push({
            key,
            value: isFile ? "" : decodeSafe(value),
            enabled: true,
            fileType: isFile,
            path: isFile ? decodeSafe(value.slice(1)) : undefined,
          });
          hasData = true;
          dataIsForm = true;
        }
        break;
      }
      case "-u":
      case "--user": {
        const raw = next();
        const idx = raw.indexOf(":");
        basicUser = idx < 0 ? raw : raw.slice(0, idx);
        basicPass = idx < 0 ? "" : raw.slice(idx + 1);
        break;
      }
      default:
        if (!t.startsWith("-") && !url) url = t;
        break;
    }
  }

  if (!url) return { ok: false, error: "命令中没有找到 URL" };

  const request: RequestData = {
    method,
    url,
    params: [],
    headers,
    auth:
      basicUser !== null
        ? { type: "basic", username: basicUser, password: basicPass ?? "" }
        : { type: "none" },
    body: { type: "none", content: "" },
  };

  if (formRows.length > 0) {
    request.body = { type: "form", content: "", rows: formRows };
  } else if (hasData) {
    const content = dataParts.join("&");
    const trimmed = content.trim();
    request.body =
      trimmed.startsWith("{") || trimmed.startsWith("[")
        ? { type: "json", content }
        : { type: dataIsForm ? "urlencoded" : "raw", content };
  } else if (hasBodyFlag) {
    request.body = { type: "raw", content: "" };
  }

  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    /* 保留原文 */
  }
  return { ok: true, name: `curl 导入 - ${host}`, request };
}
