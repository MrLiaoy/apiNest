import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import i18n from "../i18n";
import { useSettingsStore } from "./settings";
import { useUiStore } from "./ui";
import {
  newRequestData,
  type Collection,
  type FolderItem,
  type RequestData,
  type RequestKind,
  type TreeNode,
} from "../types/collection";

const SAVE_DEBOUNCE_MS = 800;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** 内容有改动、待写盘的请求 id（写盘成功后清空） */
const dirtyRequestIds = new Set<string>();

export function uid(): string {
  return crypto.randomUUID();
}

export function basename(p: string): string {
  return p.split(/[\\/]/).pop() || p;
}

// ===== 树操作工具 =====

export function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === "folder") {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

export function findParentId(nodes: TreeNode[], id: string): string | null {
  for (const n of nodes) {
    if (n.type === "folder") {
      if (n.children.some((c) => c.id === id)) return n.id;
      const hit = findParentId(n.children, id);
      if (hit !== null) return hit;
    }
  }
  return null;
}

function removeNode(
  nodes: TreeNode[],
  id: string
): { nodes: TreeNode[]; node: TreeNode | null } {
  let removed: TreeNode | null = null;
  const next: TreeNode[] = [];
  for (const n of nodes) {
    if (n.id === id) {
      removed = n;
      continue;
    }
    if (n.type === "folder") {
      const inner = removeNode(n.children, id);
      if (inner.node) removed = inner.node;
      next.push({ ...n, children: inner.nodes });
    } else {
      next.push(n);
    }
  }
  return { nodes: next, node: removed };
}

function containsId(node: TreeNode, id: string): boolean {
  if (node.id === id) return true;
  if (node.type === "folder") return node.children.some((c) => containsId(c, id));
  return false;
}

function mapNode(
  nodes: TreeNode[],
  id: string,
  fn: (n: TreeNode) => TreeNode
): TreeNode[] {
  return nodes.map((n) => {
    if (n.id === id) return fn(n);
    if (n.type === "folder") return { ...n, children: mapNode(n.children, id, fn) };
    return n;
  });
}

function collectRequestIds(node: TreeNode, out: string[]) {
  if (node.type === "request") out.push(node.id);
  else node.children.forEach((c) => collectRequestIds(c, out));
}

// ===== 文件格式 =====

function normalizeNode(n: unknown): TreeNode | null {
  if (!n || typeof n !== "object") return null;
  const raw = n as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : uid();
  const name = typeof raw.name === "string" ? raw.name : "?";
  if (raw.type === "folder") {
    const children = Array.isArray(raw.children)
      ? (raw.children.map(normalizeNode).filter(Boolean) as TreeNode[])
      : [];
    return { type: "folder", id, name, children };
  }
  const r = (raw.request ?? {}) as Record<string, unknown>;
  const req = newRequestData(raw.kind === "soap" ? "soap" : "rest");
  if (typeof r.method === "string") req.method = r.method;
  if (typeof r.url === "string") req.url = r.url;
  const rows = (v: unknown) =>
    Array.isArray(v)
      ? v
          .filter((x) => x && typeof x === "object")
          .map((x: Record<string, unknown>) => ({
            key: String(x.key ?? ""),
            value: String(x.value ?? ""),
            enabled: x.enabled !== false,
            ...(x.note !== undefined ? { note: String(x.note) } : {}),
            ...(x.fileType ? { fileType: true } : {}),
            ...(typeof x.path === "string" && x.path ? { path: x.path } : {}),
          }))
      : [];
  req.params = rows(r.params);
  req.headers = rows(r.headers);
  if (r.auth && typeof r.auth === "object")
    req.auth = { ...req.auth, ...(r.auth as Record<string, unknown>) } as typeof req.auth;
  if (r.body && typeof r.body === "object") {
    const b = r.body as Record<string, unknown>;
    req.body = {
      type: (b.type as typeof req.body.type) ?? "none",
      content: typeof b.content === "string" ? b.content : "",
    };
    if (Array.isArray(b.rows)) req.body.rows = rows(b.rows);
  }
  if (typeof r.wsdl === "string") req.wsdl = r.wsdl;
  if (typeof r.endpoint === "string") req.endpoint = r.endpoint;
  if (typeof r.operation === "string") req.operation = r.operation;
  if (typeof r.soapAction === "string") req.soapAction = r.soapAction;
  if (typeof r.envelope === "string") req.envelope = r.envelope;
  return {
    type: "request",
    id,
    name,
    kind: raw.kind === "soap" ? "soap" : "rest",
    request: req,
  };
}

/** 解析骨架文件：请求节点只含 id/name/kind，request 内容为默认占位（随后按 id 加载填充） */
function parseSkeleton(content: string): Collection {
  const raw = JSON.parse(content) as Record<string, unknown>;
  if (!raw || typeof raw !== "object") throw new Error("not a json object");
  const items = Array.isArray(raw.items)
    ? (raw.items.map(normalizeNode).filter(Boolean) as TreeNode[])
    : [];
  return {
    apix: 1,
    name: typeof raw.name === "string" ? raw.name : "API",
    items,
  };
}

function toSkeletonItems(items: TreeNode[]): unknown[] {
  return items.map((n) =>
    n.type === "folder"
      ? {
          type: "folder",
          id: n.id,
          name: n.name,
          children: toSkeletonItems(n.children),
        }
      : { type: "request", id: n.id, name: n.name, kind: n.kind }
  );
}

function skeletonJson(name: string, items: TreeNode[]): string {
  return JSON.stringify(
    { apix: 1, name, items: toSkeletonItems(items) },
    null,
    2
  );
}

// ===== Store =====

interface CollectionState {
  /** 集合目录路径 */
  path: string | null;
  name: string;
  items: TreeNode[];
  dirty: boolean;
  /** 最近被编辑、尚未写入磁盘的请求节点（页签上显示蓝点） */
  dirtyNodeId: string | null;
  /** 刚创建、待树内进入重命名状态的节点 id（消费后置回 null） */
  justCreatedId: string | null;
  selectedId: string | null;
  newCollection: (name?: string) => void;
  openFromDir: (dir: string) => Promise<void>;
  save: () => Promise<boolean>;
  saveAs: () => Promise<boolean>;
  select: (id: string | null) => void;
  addRequest: (parentId: string | null, kind: RequestKind) => void;
  addFolder: (parentId: string | null) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  updateRequest: (id: string, patch: Partial<RequestData>) => void;
  /** 复制请求：完整拷贝定义（不含历史），插入到原请求之后，名称自动去重 */
  duplicateRequest: (id: string) => void;
  restoreSnapshot: (
    snapshot: { name: string; kind: RequestKind; request: RequestData },
    parentId?: string | null
  ) => void;
  importCollection: (coll: Collection, intoFolderId?: string) => void;
  /** 导入为根目录下的新文件夹 */
  insertFolderFromImport: (coll: Collection) => void;
  moveNode: (id: string, targetFolderId: string | null, afterId?: string | null) => void;
}

export const useCollectionStore = create<CollectionState>((set, get) => {
  /** 骨架变更提交 */
  function commit(items: TreeNode[]) {
    set({ items, dirty: true });
    scheduleAutosave();
  }

  function scheduleAutosave() {
    if (!useSettingsStore.getState().autoSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void get().save();
    }, SAVE_DEBOUNCE_MS);
  }

  function insert(parentId: string | null, node: TreeNode, afterId?: string | null) {
    const items = get().items;
    // 同目录内重名自动追加序号（新请求 / 新请求1 / 新请求2 …）
    const siblings =
      parentId === null
        ? items
        : (findNode(items, parentId) as FolderItem | null)?.children ?? [];
    const names = new Set(siblings.map((s) => s.name));
    let name = node.name;
    if (names.has(name)) {
      let i = 1;
      while (names.has(`${name}${i}`)) i++;
      name = `${name}${i}`;
    }
    node = { ...node, name };
    if (node.type === "request") {
      dirtyRequestIds.add(node.id);
    } else {
      const ids: string[] = [];
      collectRequestIds(node, ids);
      ids.forEach((id) => dirtyRequestIds.add(id));
    }
    if (parentId === null) {
      const next = [...items];
      const idx = afterId ? next.findIndex((n) => n.id === afterId) : -1;
      next.splice(idx + 1, 0, node);
      set({ items: next, selectedId: node.id });
    } else {
      set({
        items: mapNode(items, parentId, (n) => {
          if (n.type !== "folder") return n;
          const children = [...n.children];
          const at = afterId ? children.findIndex((c) => c.id === afterId) : -1;
          children.splice(at < 0 ? children.length : at, 0, node);
          return { ...n, children };
        }),
        selectedId: node.id,
      });
    }
    commit(get().items);
  }

  async function persistAll(dir: string, fullCopy = false): Promise<boolean> {
    try {
      await invoke("write_text_file", {
        path: `${dir}/apix.collection.json`,
        content: skeletonJson(get().name, get().items),
      });
      // 写请求文件：全量（另存/导入）或仅脏的
      const ids: string[] = [];
      collectRequestIds({ type: "folder", id: "-", name: "-", children: get().items }, ids);
      for (const id of ids) {
        if (!fullCopy && !dirtyRequestIds.has(id)) continue;
        const node = findNode(get().items, id);
        if (node?.type !== "request") continue;
        await invoke("write_request", {
          dir,
          id,
          content: JSON.stringify({ id, request: node.request }, null, 2),
        });
      }
      dirtyRequestIds.clear();
      set({ path: dir, dirty: false, dirtyNodeId: null });
      useSettingsStore.getState().addRecent(dir);
      useUiStore.getState().setStatus("statusbar.saved");
      return true;
    } catch (e) {
      useUiStore.getState().setStatus("statusbar.saveFailed", { reason: String(e) });
      useUiStore.getState().showToast("statusbar.saveFailed", { reason: String(e) }, "err");
      return false;
    }
  }

  /** 为未落盘的新集合分配工作区目录 */
  async function ensureNewDir(): Promise<string> {
    const s = useSettingsStore.getState();
    const ws = s.workspaceDir ?? (await join(await appDataDir(), "workspace"));
    await invoke("ensure_dir", { path: ws }).catch(() => {});
    return invoke<string>("unique_collection_dir", { workspace: ws, name: get().name });
  }

  return {
    path: null,
    name: "API",
    items: [],
    dirty: false,
    dirtyNodeId: null,
    justCreatedId: null,
    selectedId: null,

    newCollection: (name) => {
      clearTimeout(saveTimer);
      dirtyRequestIds.clear();
      set({
        path: null,
        name: name ?? i18n.t("menu.newCollection"),
        items: [],
        dirty: false,
        dirtyNodeId: null,
        selectedId: null,
      });
      // 默认工作区：立即创建集合目录 + 骨架，全程无对话框
      void (async () => {
        try {
          const dir = await ensureNewDir();
          await invoke("ensure_dir", { path: dir });
          if (get().path === null) {
            await invoke("write_text_file", {
              path: `${dir}/apix.collection.json`,
              content: skeletonJson(get().name, get().items),
            });
            set({ path: dir, dirty: false });
            useSettingsStore.getState().addRecent(dir);
          }
        } catch (e) {
          useUiStore.getState().setStatus("statusbar.saveFailed", { reason: String(e) });
        }
      })();
    },

    openFromDir: async (dir) => {
      try {
        const skeleton = await invoke<string>("open_collection_dir", { dir });
        const coll = parseSkeleton(skeleton);
        // 并行加载所有请求内容
        const reqNodes: (TreeNode & { type: "request" })[] = [];
        collectRequestIds(
          { type: "folder", id: "-", name: "-", children: coll.items },
          []
        );
        const walk = (nodes: TreeNode[]) => {
          for (const n of nodes) {
            if (n.type === "request") reqNodes.push(n);
            else walk(n.children);
          }
        };
        walk(coll.items);
        await Promise.all(
          reqNodes.map(async (n) => {
            try {
              const raw = await invoke<string>("read_request", { dir, id: n.id });
              const data = JSON.parse(raw) as { request?: Partial<RequestData> };
              if (data.request) n.request = { ...n.request, ...data.request };
            } catch {
              /* 请求文件缺失时保留默认 */
            }
          })
        );
        dirtyRequestIds.clear();
        set({
          path: dir,
          name: coll.name,
          items: coll.items,
          dirty: false,
          dirtyNodeId: null,
          selectedId: null,
        });
        useSettingsStore.getState().addRecent(dir);
        useUiStore.getState().setStatus("statusbar.opened", { name: basename(dir) });
      } catch (e) {
        useUiStore.getState().setStatus("statusbar.invalidFile", { reason: String(e) });
      }
    },

    save: async () => {
      const { path } = get();
      if (path) return persistAll(path);
      // 无目录（异常情况）：静默分配工作区目录
      try {
        const dir = await ensureNewDir();
        return await persistAll(dir);
      } catch (e) {
        useUiStore.getState().setStatus("statusbar.saveFailed", { reason: String(e) });
        return false;
      }
    },

    saveAs: async () => {
      const dir = await openDialog({ directory: true, title: i18n.t("menu.saveAs") });
      if (typeof dir !== "string") return false;
      return persistAll(dir, true); // 整集合全量复制到新目录
    },

    select: (selectedId) => set({ selectedId }),

    addRequest: (parentId, kind) => {
      insert(parentId, {
        type: "request",
        id: uid(),
        name: i18n.t("sidebar.newRequest"),
        kind,
        request: newRequestData(kind),
      });
      set({ justCreatedId: get().selectedId });
    },

    addFolder: (parentId) => {
      insert(parentId, {
        type: "folder",
        id: uid(),
        name: i18n.t("sidebar.newFolder"),
        children: [],
      });
    },

    rename: (id, name) => {
      commit(mapNode(get().items, id, (n) => ({ ...n, name })));
    },

    remove: (id) => {
      const node = findNode(get().items, id);
      if (get().selectedId === id) set({ selectedId: null });
      commit(removeNode(get().items, id).nodes);
      // 清理磁盘上的请求定义与历史文件
      if (node) {
        const ids: string[] = [];
        collectRequestIds(node, ids);
        const dir = get().path;
        ids.forEach((rid) => {
          dirtyRequestIds.delete(rid);
          if (dir) void invoke("delete_request_files", { dir, id: rid }).catch(() => {});
        });
      }
    },

    updateRequest: (id, patch) => {
      commit(
        mapNode(get().items, id, (n) =>
          n.type === "request" ? { ...n, request: { ...n.request, ...patch } } : n
        )
      );
      dirtyRequestIds.add(id);
      set({ dirtyNodeId: id });
    },

    duplicateRequest: (id) => {
      const node = findNode(get().items, id);
      if (node?.type !== "request") return;
      const parentId = findParentId(get().items, id);
      insert(
        parentId,
        {
          type: "request",
          id: uid(),
          name: node.name,
          kind: node.kind,
          request: JSON.parse(JSON.stringify(node.request)) as RequestData,
        },
        id
      );
      set({ justCreatedId: get().selectedId });
    },

    restoreSnapshot: (snapshot, parentId = null) => {
      insert(parentId, {
        type: "request",
        id: uid(),
        name: snapshot.name,
        kind: snapshot.kind,
        request: JSON.parse(JSON.stringify(snapshot.request)) as RequestData,
      });
    },

    importCollection: (coll, intoFolderId) => {
      clearTimeout(saveTimer);
      if (intoFolderId) {
        const folder: FolderItem = {
          type: "folder",
          id: uid(),
          name: coll.name,
          children: coll.items,
        };
        set({ dirty: true, dirtyNodeId: null, selectedId: folder.id });
        commit(
          mapNode(get().items, intoFolderId, (n) =>
            n.type === "folder" ? { ...n, children: [...n.children, folder] } : n
          )
        );
      } else {
        dirtyRequestIds.clear();
        set({
          path: null,
          name: coll.name,
          items: coll.items,
          dirty: true,
          dirtyNodeId: null,
          selectedId: null,
        });
      }
      // 所有请求内容都需要写盘
      const ids: string[] = [];
      coll.items.forEach((n) => collectRequestIds(n, ids));
      ids.forEach((id) => dirtyRequestIds.add(id));
      scheduleAutosave();
    },

    insertFolderFromImport: (coll) => {
      insert(null, {
        type: "folder",
        id: uid(),
        name: coll.name,
        children: coll.items,
      });
    },

    moveNode: (id, targetFolderId, afterId) => {
      const items = get().items;
      if (id === targetFolderId) return;
      const node = findNode(items, id);
      if (!node) return;
      if (targetFolderId && containsId(node, targetFolderId)) return;
      const { nodes: without, node: removed } = removeNode(items, id);
      if (!removed) return;
      let next: TreeNode[];
      if (targetFolderId === null) {
        next = [...without];
        const idx = afterId
          ? next.findIndex((n) => n.id === afterId)
          : next.length - 1;
        next.splice(idx + 1, 0, removed);
      } else {
        next = mapNode(without, targetFolderId, (n) => {
          if (n.type !== "folder") return n;
          const children = [...n.children];
          const at = afterId ? children.findIndex((c) => c.id === afterId) : -1;
          children.splice(at < 0 ? children.length : at, 0, removed);
          return { ...n, children };
        });
      }
      commit(next);
    },
  };
});

// 集合目录变化 → 记录为“最后打开的工作区”（启动时自动恢复用）
useCollectionStore.subscribe((s, prev) => {
  if (s.path && s.path !== prev.path) {
    useSettingsStore.getState().setLastCollectionDir(s.path);
  }
});

/** 应用启动时调用：恢复最后一次打开的集合；没有则创建默认工作区 */
export function bootstrapLastCollection(): Promise<void> {
  const last = useSettingsStore.getState().lastCollectionDir;
  if (last) {
    return useCollectionStore
      .getState()
      .openFromDir(last)
      .then(() => {
        // 目录失效（被删除/移动）→ 回退到默认工作区
        if (!useCollectionStore.getState().path) {
          useCollectionStore.getState().newCollection();
        }
      });
  }
  useCollectionStore.getState().newCollection();
  return Promise.resolve();
}
