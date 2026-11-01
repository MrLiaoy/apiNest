/** Postman Collection v2.1 ↔ apix 集合 互转。
 *  Apifox 官方导入器原生支持 v2.1 格式，因此「Apifox 格式」导出同样采用 v2.1。 */
import type { Collection, KeyValueRow, TreeNode, RequestData } from "../types/collection";

function uid(): string {
  return crypto.randomUUID();
}

// ===== 导出：apix → Postman v2.1 =====

interface PmItem {
  name?: string;
  item?: PmItem[];
  request?: Record<string, unknown>;
}

function reqToPm(n: TreeNode & { type: "request" }): PmItem {
  const r = n.request;
  const headers: { key: string; value: string }[] = r.headers
    .filter((h) => h.enabled && h.key.trim())
    .map((h) => ({ key: h.key, value: h.value }));

  let body: Record<string, unknown> | undefined;
  if (n.kind === "soap") {
    headers.push({ key: "Content-Type", value: "text/xml; charset=utf-8" });
    if (r.soapAction) headers.push({ key: "SOAPAction", value: r.soapAction });
    body = { mode: "raw", raw: r.body.content };
  } else {
    switch (r.body.type) {
      case "json":
        body = {
          mode: "raw",
          raw: r.body.content,
          options: { raw: { language: "json" } },
        };
        break;
      case "raw":
        body = { mode: "raw", raw: r.body.content };
        break;
      case "urlencoded":
        body = {
          mode: "urlencoded",
          urlencoded: (r.body.rows ?? [])
            .filter((x) => x.key.trim())
            .map((x) => ({ key: x.key, value: x.value, disabled: !x.enabled })),
        };
        break;
      case "form":
        body = {
          mode: "formdata",
          formdata: (r.body.rows ?? [])
            .filter((x) => x.key.trim())
            .map((x) =>
              x.fileType
                ? { key: x.key, type: "file", src: [x.path ?? ""], disabled: !x.enabled }
                : { key: x.key, value: x.value, type: "text", disabled: !x.enabled }
            ),
        };
        break;
      default:
        break;
    }
  }

  const request: Record<string, unknown> = {
    method: n.kind === "soap" ? "POST" : r.method,
    url: r.url,
  };
  if (headers.length > 0) request.header = headers;
  if (body) request.body = body;
  if (r.auth.type === "bearer" && r.auth.token) {
    request.auth = { type: "bearer", bearer: [{ key: "token", value: r.auth.token }] };
  } else if (r.auth.type === "basic") {
    request.auth = {
      type: "basic",
      basic: [
        { key: "username", value: r.auth.username ?? "" },
        { key: "password", value: r.auth.password ?? "" },
      ],
    };
  } else if (r.auth.type === "apikey" && r.auth.keyName) {
    request.auth = {
      type: "apikey",
      apikey: [
        { key: "key", value: r.auth.keyName },
        { key: "value", value: r.auth.keyValue ?? "" },
        { key: "in", value: r.auth.location === "query" ? "query" : "header" },
      ],
    };
  }

  return { name: n.name, request };
}

function nodeToPm(n: TreeNode): PmItem {
  if (n.type === "folder") {
    return { name: n.name, item: n.children.map(nodeToPm) };
  }
  return reqToPm(n);
}

/** 导出为 Postman Collection v2.1 JSON 文本（单请求 = 单条目集合） */
export function apixToPostman(name: string, items: TreeNode[]): string {
  return JSON.stringify(
    {
      info: {
        name,
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: items.map(nodeToPm),
    },
    null,
    2
  );
}

// ===== 导入：Postman v2.1 → apix =====

function pmAuthToApix(auth: unknown): RequestData["auth"] {
  const a = auth as Record<string, unknown> | undefined;
  const type = typeof a?.type === "string" ? a.type : undefined;
  const get = (k: string): string => {
    const arr = a?.[k];
    if (Array.isArray(arr)) {
      const first = arr[0] as Record<string, unknown> | undefined;
      return String(first?.value ?? "");
    }
    return "";
  };
  if (type === "bearer") return { type: "bearer", token: get("bearer") };
  if (type === "basic")
    return {
      type: "basic",
      username: get("basic"),
      password: (a?.basic as { password?: string } | undefined)?.password ?? "",
    };
  if (type === "apikey")
    return {
      type: "apikey",
      keyName: get("apikey"),
      keyValue: "",
      location: "header",
    };
  return { type: "none" };
}

function pmToNode(item: Record<string, unknown>): TreeNode | null {
  if (Array.isArray(item.item)) {
    return {
      type: "folder",
      id: uid(),
      name: typeof item.name === "string" ? item.name : "folder",
      children: (item.item as Record<string, unknown>[])
        .map(pmToNode)
        .filter(Boolean) as TreeNode[],
    };
  }
  const req = (item.request ?? {}) as Record<string, unknown>;
  const method =
    typeof req.method === "string" ? req.method.toUpperCase() : "GET";
  const rawUrl =
    typeof req.url === "string"
      ? req.url
      : ((req.url as Record<string, unknown> | undefined)?.raw as string | undefined) ?? "";

  const params: KeyValueRow[] = [];
  const urlObj = req.url as Record<string, unknown> | undefined;
  if (Array.isArray(urlObj?.query)) {
    for (const q of urlObj.query as Record<string, unknown>[]) {
      if (q && typeof q.key === "string" && q.key) {
        params.push({
          key: q.key,
          value: String(q.value ?? ""),
          enabled: q.disabled !== true,
        });
      }
    }
  }

  const headers: KeyValueRow[] = Array.isArray(req.header)
    ? (req.header as Record<string, unknown>[])
        .filter((h) => typeof h.key === "string" && h.key)
        .map((h) => ({
          key: String(h.key),
          value: String(h.value ?? ""),
          enabled: h.disabled !== true,
        }))
    : [];

  let body: RequestData["body"] = { type: "none", content: "" };
  const b = req.body as Record<string, unknown> | undefined;
  const mode = typeof b?.mode === "string" ? b.mode : undefined;
  if (mode === "raw" && typeof b?.raw === "string") {
    const isJson =
      (b.options as Record<string, Record<string, string>> | undefined)?.raw
        ?.language === "json" ||
      b.raw.trim().startsWith("{") ||
      b.raw.trim().startsWith("[");
    body = { type: isJson ? "json" : "raw", content: b.raw };
  } else if (mode === "urlencoded" && Array.isArray(b?.urlencoded)) {
    body = {
      type: "urlencoded",
      content: "",
      rows: (b.urlencoded as Record<string, unknown>[]).map((x) => ({
        key: String(x.key ?? ""),
        value: String(x.value ?? ""),
        enabled: x.disabled !== true,
      })),
    };
  } else if (mode === "formdata" && Array.isArray(b?.formdata)) {
    body = {
      type: "form",
      content: "",
      rows: (b.formdata as Record<string, unknown>[]).map((x) => ({
        key: String(x.key ?? ""),
        value: String(x.value ?? ""),
        enabled: x.disabled !== true,
        ...(x.type === "file"
          ? {
              fileType: true,
              path: Array.isArray(x.src)
                ? String((x.src as string[])[0] ?? "")
                : String(x.src ?? ""),
            }
          : {}),
      })),
    };
  }

  const request: RequestData = {
    method,
    url: rawUrl,
    params,
    headers,
    auth: pmAuthToApix(req.auth),
    body,
  };

  return {
    type: "request",
    id: uid(),
    name: typeof item.name === "string" ? item.name : method,
    kind: "rest",
    request,
  };
}

/** Postman v2.1 JSON（Postman / Apifox 导出）→ apix 集合；非集合格式抛错 */
export function postmanToApix(content: string): Collection {
  const root = JSON.parse(content) as Record<string, unknown>;
  if (!root || !Array.isArray(root.item)) {
    throw new Error("不是 Postman / Apifox 集合文件（缺少 item 结构）");
  }
  const info = (root.info ?? {}) as Record<string, unknown>;
  return {
    apix: 1,
    name: typeof info.name === "string" ? info.name : "Imported",
    items: (root.item as Record<string, unknown>[])
      .map(pmToNode)
      .filter(Boolean) as TreeNode[],
  };
}
