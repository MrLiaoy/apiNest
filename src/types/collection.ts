/** 集合数据模型（对齐 docs/开发计划.md §3.1，无环境/变量体系） */

export type RequestKind = "rest" | "soap";

export interface KeyValueRow {
  key: string;
  value: string;
  enabled: boolean;
  note?: string;
  /** form-data 行：文件类型（value 列变为文件路径） */
  fileType?: boolean;
  path?: string;
}

export type BodyType =
  | "none"
  | "json"
  | "form"
  | "urlencoded"
  | "raw"
  | "soap";

export interface FormFile {
  key: string;
  path: string;
}

export interface RequestBody {
  type: BodyType;
  content: string;
  /** form-data 文本行 / x-www-form-urlencoded 行 */
  rows?: KeyValueRow[];
  /** form-data 文件行 */
  files?: FormFile[];
}

export interface AuthConfig {
  type: "none" | "bearer" | "basic" | "apikey";
  token?: string;
  username?: string;
  password?: string;
  keyName?: string;
  keyValue?: string;
  /** API Key 注入位置 */
  location?: "header" | "query";
}

export interface RequestData {
  method: string;
  url: string;
  params: KeyValueRow[];
  headers: KeyValueRow[];
  auth: AuthConfig;
  body: RequestBody;
  /** SOAP 专属（kind === "soap"） */
  wsdl?: string;
  endpoint?: string;
  operation?: string;
  /** 解析自 WSDL binding 的完整 SOAPAction（如 http://tempuri.org/Add） */
  soapAction?: string;
  envelope?: string;
}

export interface RequestItem {
  type: "request";
  id: string;
  name: string;
  kind: RequestKind;
  request: RequestData;
}

export interface FolderItem {
  type: "folder";
  id: string;
  name: string;
  children: TreeNode[];
}

export type TreeNode = RequestItem | FolderItem;

export interface Collection {
  apix: 1;
  name: string;
  items: TreeNode[];
}

export function newRequestData(kind: RequestKind = "rest"): RequestData {
  return {
    method: "GET",
    url: "",
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    wsdl: kind === "soap" ? "" : undefined,
  };
}
