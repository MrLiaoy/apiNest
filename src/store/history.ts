import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { HistoryEntry } from "./historyTypes";

interface HistoryState {
  entries: HistoryEntry[];
  /** 已加载历史对应的请求（dir::requestId） */
  loadedFor: string | null;
  load: (dir: string, requestId: string) => Promise<void>;
  record: (
    dir: string,
    requestId: string,
    entry: HistoryEntry,
    max: number
  ) => Promise<void>;
  clear: (dir: string, requestId: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  loadedFor: null,

  load: async (dir, requestId) => {
    const key = `${dir}::${requestId}`;
    if (get().loadedFor === key) return;
    try {
      const raw = await invoke<string>("read_request_history", { dir, id: requestId });
      const data = JSON.parse(raw) as { entries?: HistoryEntry[] };
      set({
        entries: Array.isArray(data.entries) ? data.entries : [],
        loadedFor: key,
      });
    } catch {
      set({ entries: [], loadedFor: key });
    }
  },

  record: async (dir, requestId, entry, max) => {
    try {
      await invoke("append_request_history", {
        dir,
        id: requestId,
        entry: JSON.stringify(entry),
        max,
      });
      // 只在当前查看的请求上追加显示
      if (get().loadedFor === `${dir}::${requestId}`) {
        const entries = [...get().entries, entry];
        set({ entries: entries.slice(-max) });
      }
    } catch {
      // 历史写入失败不打断主流程
    }
  },

  clear: async (dir, requestId) => {
    try {
      await invoke("clear_request_history", { dir, id: requestId });
      set({ entries: [] });
    } catch {
      /* ignore */
    }
  },
}));

// 类型单独放 historyTypes.ts 会造成循环依赖混乱，这里直接 re-export 便捷类型
export type { HistoryEntry } from "./historyTypes";
