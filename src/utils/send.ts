import { invoke } from "@tauri-apps/api/core";
import type { AuthConfig, KeyValueRow, RequestData } from "../types/collection";
import { basicAuthValue } from "./auth";
import { splitUrl } from "./url";

export interface RespHeader {
  key: string;
  value: string;
}

export interface SendResponse {
  status: number;
  statusText: string;
  headers: RespHeader[];
  durationMs: number;
  sizeBytes: number;
  bodyText: string;
  truncated: boolean;
}

export type BodyPayload =
  | { type: "none" }
  | { type: "json"; content: string }
  | { type: "form"; rows: { key: string; value: string }[]; files: { name: string; path: string }[] }
  | { type: "urlencoded"; content: string }
  | { type: "raw"; content: string };

export interface SendOptions {
  method: string;
  url: string;
  headers: { key: string; value: string }[];
  body: BodyPayload;
}

/** URL 没写协议头时自动补 http://（与浏览器/cURL 的宽容行为一致） */
export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(u) ? u : `http://${u}`;
}

/** 写入头（同名大小写不敏感时覆盖，避免手写 + 自动注入产生重复头） */
function setHeader(
  headers: { key: string; value: string }[],
  key: string,
  value: string
) {
  const idx = headers.findIndex((h) => h.key.toLowerCase() === key.toLowerCase());
  if (idx >= 0) headers[idx] = { key, value };
  else headers.push({ key, value });
}

/** 认证注入（REST / SOAP 共用）：Bearer/Basic → Authorization 头；API Key → 头或 query，同名一律覆盖 */
export function applyAuth(
  headers: { key: string; value: string }[],
  extraParams: KeyValueRow[],
  auth: AuthConfig
) {
  switch (auth.type) {
    case "bearer":
      if (auth.token?.trim()) {
        setHeader(headers, "Authorization", `Bearer ${auth.token.trim()}`);
      }
      break;
    case "basic":
      if (auth.username !== undefined || auth.password !== undefined) {
        setHeader(
          headers,
          "Authorization",
          `Basic ${basicAuthValue(auth.username ?? "", auth.password ?? "")}`
        );
      }
      break;
    case "apikey":
      if (auth.keyName?.trim() && auth.keyValue?.trim()) {
        if (auth.location === "query") {
          extraParams.push({
            key: auth.keyName.trim(),
            value: auth.keyValue.trim(),
            enabled: true,
          });
        } else {
          setHeader(headers, auth.keyName.trim(), auth.keyValue.trim());
        }
      }
      break;
    default:
      break;
  }
}

/** 把请求模型组装成发送载荷：认证注入、启用参数拼 query、启用头过滤、body 按类型映射 */
export function buildSendOptions(req: RequestData): SendOptions {
  const headers = req.headers
    .filter((h) => h.enabled && h.key.trim())
    .map((h) => ({ key: h.key, value: h.value }));
  const extraParams = [...req.params];

  applyAuth(headers, extraParams, req.auth);

  const qs = extraParams
    .filter((p) => p.enabled && p.key.trim())
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join("&");
  // URL 与参数表镜像同一份 query —— 发送时以「基础地址 + 启用参数」重组，避免重复拼接
  const { base } = splitUrl(req.url);
  const url = normalizeUrl(base) + (qs ? `?${qs}` : "");

  let body: BodyPayload;
  switch (req.body.type) {
    case "json":
      body = { type: "json", content: req.body.content };
      break;
    case "urlencoded": {
      const content = (req.body.rows ?? [])
        .filter((r) => r.enabled && r.key.trim())
        .map((r) => `${encodeURIComponent(r.key)}=${encodeURIComponent(r.value)}`)
        .join("&");
      body = { type: "urlencoded", content };
      break;
    }
    case "raw":
      body = { type: "raw", content: req.body.content };
      break;
    case "form": {
      const rs = req.body.rows ?? [];
      // multipart 的 Content-Type 必须由 reqwest 生成（带 boundary），手动头一律忽略
      const filtered = headers.filter((h) => h.key.toLowerCase() !== "content-type");
      headers.length = 0;
      headers.push(...filtered);
      body = {
        type: "form",
        rows: rs
          .filter((r) => r.enabled && !r.fileType && r.key.trim())
          .map((r) => ({ key: r.key, value: r.value })),
        files: rs
          .filter((r) => r.enabled && r.fileType && r.key.trim() && r.path)
          .map((r) => ({ name: r.key, path: r.path ?? "" })),
      };
      break;
    }
    default:
      body = { type: "none" };
  }

  return { method: req.method, url, headers, body };
}

export function invokeSend(opts: SendOptions): Promise<SendResponse> {
  return invoke<SendResponse>("send_request", { opts });
}
