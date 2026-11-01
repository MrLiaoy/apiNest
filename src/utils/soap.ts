/** SOAP：WSDL 解析结果 → 信封模板生成（模板填入可编辑报文区，参数结构不受限） */
import type { KeyValueRow, RequestData } from "../types/collection";
import type { SendOptions } from "./send";
import { applyAuth, normalizeUrl } from "./send";

/** SOAP 请求 → 发送载荷（发送 / 复制 cURL / 导出共用），认证与 REST 共用同一注入逻辑 */
export function soapToSendOptions(r: RequestData): SendOptions {
  const headers: { key: string; value: string }[] = [
    { key: "Content-Type", value: "text/xml; charset=utf-8" },
  ];
  if (r.soapAction) headers.push({ key: "SOAPAction", value: r.soapAction });
  else if (r.operation) headers.push({ key: "SOAPAction", value: `"${r.operation}"` });

  // 认证注入：Bearer/Basic/APIKey(头) 覆盖同名头；APIKey(query) 拼到地址
  const extraParams: KeyValueRow[] = [];
  applyAuth(headers, extraParams, r.auth);
  const qs = extraParams
    .filter((p) => p.key.trim())
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join("&");

  return {
    method: "POST",
    url: normalizeUrl(r.endpoint || r.wsdl || r.url) + (qs ? `?${qs}` : ""),
    headers,
    body: { type: "raw", content: r.body.content },
  };
}

export interface WsdlParam {
  name: string;
  typeName: string;
}

export interface WsdlOperation {
  name: string;
  soapAction: string;
}

export interface WsdlInfo {
  endpoint: string;
  targetNamespace: string;
  operation: string;
  soapAction: string;
  operations: WsdlOperation[];
  params: WsdlParam[];
}

/** 生成 SOAP 1.1 信封模板（填入可编辑报文区，用户可任意改：list/嵌套/多值均可） */
export function buildEnvelope(info: WsdlInfo): string {
  const prefix = "web";
  const ns = info.targetNamespace || "urn:temp";
  const op = info.operation;
  const lines =
    info.params.length > 0
      ? info.params
          .map(
            (p) =>
              `      <${prefix}:${p.name}></${prefix}:${p.name}> <!-- ${p.typeName} -->`
          )
          .join("\n")
      : "      <!-- 无入参 -->";
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:${prefix}="${ns}">`,
    `  <soapenv:Header/>`,
    `  <soapenv:Body>`,
    `    <${prefix}:${op}>`,
    lines,
    `    </${prefix}:${op}>`,
    `  </soapenv:Body>`,
    `</soapenv:Envelope>`,
  ].join("\n");
}
