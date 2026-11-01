import type { RequestData, RequestKind } from "../types/collection";

export interface HistoryResp {
  status: number;
  statusText: string;
  durationMs: number;
  sizeBytes: number;
  /** 响应体（截断至 64KB，控制历史文件体积） */
  bodyText: string;
  truncated: boolean;
}

export interface HistoryEntry {
  time: string; // ISO 时间
  name: string;
  kind: RequestKind;
  method: string; // 展示用（REST 方法或 SOAP）
  url: string;
  status: number | null; // null = 发送失败
  durationMs: number | null;
  sizeBytes: number | null;
  /** 响应快照（失败为 null）；响应体截断存 64KB */
  resp: HistoryResp | null;
  snapshot: { name: string; kind: RequestKind; request: RequestData };
}
