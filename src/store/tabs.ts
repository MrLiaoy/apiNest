import { create } from "zustand";
import { findNode, uid, useCollectionStore } from "./collection";

export interface OpenTab {
  tabId: string;
  nodeId: string;
}

interface TabsState {
  tabs: OpenTab[];
  activeTabId: string | null;
  /** 打开或激活某树节点对应的标签 */
  openNode: (nodeId: string) => void;
  activate: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  /** 关闭指定页签右侧全部 */
  closeRight: (tabId: string) => void;
  /** 关闭指定页签左侧全部 */
  closeLeft: (tabId: string) => void;
  /** 关闭全部页签 */
  closeAll: () => void;
  /** ＋ 新建空白 REST 请求（落进集合根目录）并打开标签 */
  openBlankRest: () => void;
  /** 新建空白 SOAP 请求并打开标签 */
  openBlankSoap: () => void;
  /** 按当前集合路径恢复上次会话 */
  restore: () => void;
}

function sessionKey(path: string | null): string | null {
  return path ? `apix.session.${path}` : null;
}

function persist(tabs: OpenTab[], activeTabId: string | null) {
  const key = sessionKey(useCollectionStore.getState().path);
  if (!key) return;
  const activeNodeId = tabs.find((t) => t.tabId === activeTabId)?.nodeId ?? null;
  localStorage.setItem(
    key,
    JSON.stringify({ nodeIds: tabs.map((t) => t.nodeId), activeNodeId })
  );
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openNode: (nodeId) => {
    const existing = get().tabs.find((t) => t.nodeId === nodeId);
    if (existing) {
      set({ activeTabId: existing.tabId });
      persist(get().tabs, existing.tabId);
      return;
    }
    const tab = { tabId: uid(), nodeId };
    set({ tabs: [...get().tabs, tab], activeTabId: tab.tabId });
    persist(get().tabs, tab.tabId);
  },

  activate: (tabId) => {
    set({ activeTabId: tabId });
    persist(get().tabs, tabId);
  },

  closeTab: (tabId) => {
    const tabs = get().tabs;
    const idx = tabs.findIndex((t) => t.tabId === tabId);
    if (idx < 0) return;
    const next = tabs.filter((t) => t.tabId !== tabId);
    let activeTabId = get().activeTabId;
    if (activeTabId === tabId) {
      // 关闭当前激活的 → 切到相邻（左优先，其次右）
      const neighbor = next[Math.min(idx, next.length - 1)] ?? null;
      activeTabId = neighbor?.tabId ?? null;
    }
    set({ tabs: next, activeTabId });
    persist(next, activeTabId);
  },

  closeRight: (tabId) => {
    const idx = get().tabs.findIndex((t) => t.tabId === tabId);
    if (idx < 0) return;
    [...get().tabs.slice(idx + 1)].forEach((t) => get().closeTab(t.tabId));
  },

  closeLeft: (tabId) => {
    const idx = get().tabs.findIndex((t) => t.tabId === tabId);
    if (idx < 0) return;
    [...get().tabs.slice(0, idx)].forEach((t) => get().closeTab(t.tabId));
  },

  closeAll: () => {
    [...get().tabs].forEach((t) => get().closeTab(t.tabId));
  },

  openBlankRest: () => {
    const col = useCollectionStore.getState();
    col.addRequest(null, "rest");
    const nodeId = useCollectionStore.getState().selectedId;
    if (nodeId) get().openNode(nodeId);
  },

  openBlankSoap: () => {
    const col = useCollectionStore.getState();
    col.addRequest(null, "soap");
    const nodeId = useCollectionStore.getState().selectedId;
    if (nodeId) get().openNode(nodeId);
  },

  restore: () => {
    const key = sessionKey(useCollectionStore.getState().path);
    if (!key) {
      set({ tabs: [], activeTabId: null });
      return;
    }
    const raw = localStorage.getItem(key);
    // 该路径没有已保存的会话（如刚新建的集合）→ 保留当前已打开的页签
    if (raw === null) return;
    try {
      const data = JSON.parse(raw);
      const { items } = useCollectionStore.getState();
      const nodeIds: string[] = Array.isArray(data.nodeIds) ? data.nodeIds : [];
      const tabs = nodeIds
        .filter((id) => findNode(items, id))
        .map((nodeId) => ({ tabId: uid(), nodeId }));
      const active =
        tabs.find((t) => t.nodeId === data.activeNodeId) ?? tabs[0] ?? null;
      set({ tabs, activeTabId: active?.tabId ?? null });
    } catch {
      set({ tabs: [], activeTabId: null });
    }
  },
}));

// ===== 集合状态联动 =====

// 切换集合文件 → 恢复该文件的标签会话
useCollectionStore.subscribe((s, prev) => {
  if (s.path !== prev.path) useTabsStore.getState().restore();
});

// 树节点被删除 → 自动关闭对应标签
useCollectionStore.subscribe((s, prev) => {
  if (s.items === prev.items) return;
  const { tabs, closeTab } = useTabsStore.getState();
  for (const t of tabs) {
    if (!findNode(s.items, t.nodeId)) closeTab(t.tabId);
  }
});
