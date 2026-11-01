import { create } from "zustand";
import { useUiStore } from "./ui";
import { useHistoryStore } from "./history";
import { useCollectionStore } from "./collection";
import { useSettingsStore } from "./settings";
import { useTabsStore } from "./tabs";
import { invokeSend, type SendOptions, type SendResponse } from "../utils/send";
import type { RequestData, RequestKind } from "../types/collection";

export interface SendMeta {
  name: string;
  kind: RequestKind;
  method: string;
  url: string;
  request: RequestData;
}

/** 每个请求节点自己的响应状态：切页签互不影响，慢请求可后台继续跑 */
export interface NodeRespState {
  loading: boolean;
  resp: SendResponse | null;
  error: { code: string; detail: string } | null;
  /** 跑完时不在当前页签 → 页签上显示气泡（ok=绿勾 / err=红感叹号），激活该页签后清除 */
  bubble: "ok" | "err" | null;
}

const EMPTY_NODE: NodeRespState = {
  loading: false,
  resp: null,
  error: null,
  bubble: null,
};

interface ResponseState {
  map: Record<string, NodeRespState>;
  send: (nodeId: string, opts: SendOptions, meta?: SendMeta) => Promise<void>;
  clearBubble: (nodeId: string) => void;
}

export const useResponseStore = create<ResponseState>((set, get) => {
  function setNode(nodeId: string, patch: Partial<NodeRespState>) {
    set({
      map: {
        ...get().map,
        [nodeId]: { ...(get().map[nodeId] ?? EMPTY_NODE), ...patch },
      },
    });
  }

  function activeNodeId(): string | null {
    const { tabs, activeTabId } = useTabsStore.getState();
    return tabs.find((t) => t.tabId === activeTabId)?.nodeId ?? null;
  }

  return {
    map: {},

    clearBubble: (nodeId) => {
      const cur = get().map[nodeId];
      if (cur?.bubble) setNode(nodeId, { bubble: null });
    },

    send: async (nodeId, opts, meta) => {
      setNode(nodeId, { loading: true, resp: null, error: null, bubble: null });
      try {
        const resp = await invokeSend(opts);
        setNode(nodeId, {
          loading: false,
          resp,
          error: null,
          bubble: activeNodeId() !== nodeId ? "ok" : null,
        });
        useUiStore
          .getState()
          .setStatus("statusbar.sent", {
            method: opts.method,
            status: resp.status,
            time: `${resp.durationMs} ms`,
          });
        // 记录到该请求自己的历史文件（成功/失败都记；响应体截断存 64KB）
        const dir = useCollectionStore.getState().path;
        const max = useSettingsStore.getState().maxHistoryPerRequest;
        if (dir) {
          void useHistoryStore.getState().record(
            dir,
            nodeId,
            {
              time: new Date().toISOString(),
              name: meta?.name ?? "",
              kind: meta?.kind ?? "rest",
              method: meta?.method ?? opts.method,
              url: opts.url,
              status: resp.status,
              durationMs: resp.durationMs,
              sizeBytes: resp.sizeBytes,
              resp: {
                status: resp.status,
                statusText: resp.statusText,
                durationMs: resp.durationMs,
                sizeBytes: resp.sizeBytes,
                bodyText: resp.bodyText.slice(0, 64 * 1024),
                truncated: resp.truncated || resp.bodyText.length > 64 * 1024,
              },
              snapshot: meta
                ? { name: meta.name, kind: meta.kind, request: meta.request }
                : { name: "", kind: "rest", request: {} as RequestData },
            },
            max
          );
        }
      } catch (e) {
        const err = (e ?? {}) as { code?: string; detail?: string };
        const code = err.code ?? "unknown";
        setNode(nodeId, {
          loading: false,
          resp: null,
          error: { code, detail: err.detail ?? String(e) },
          bubble: activeNodeId() !== nodeId ? "err" : null,
        });
        useUiStore
          .getState()
          .setStatus(`error.${code}`, { detail: err.detail ?? "" });
        useUiStore
          .getState()
          .showToast(`error.${code}`, { detail: err.detail ?? "" }, "err");
        const dir = useCollectionStore.getState().path;
        const max = useSettingsStore.getState().maxHistoryPerRequest;
        if (dir) {
          void useHistoryStore.getState().record(
            dir,
            nodeId,
            {
              time: new Date().toISOString(),
              name: meta?.name ?? "",
              kind: meta?.kind ?? "rest",
              method: meta?.method ?? opts.method,
              url: opts.url,
              status: null,
              durationMs: null,
              sizeBytes: null,
              resp: null,
              snapshot: meta
                ? { name: meta.name, kind: meta.kind, request: meta.request }
                : { name: "", kind: "rest", request: {} as RequestData },
            },
            max
          );
        }
      }
    },
  };
});

// 激活某页签 → 清除该节点的完成气泡
useTabsStore.subscribe((s, prev) => {
  if (s.activeTabId === prev.activeTabId) return;
  const node = s.tabs.find((t) => t.tabId === s.activeTabId)?.nodeId;
  if (node) useResponseStore.getState().clearBubble(node);
});
