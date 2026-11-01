import { useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../hooks/useClickOutside";
import FloatingMenu, { type FloatingMenuItem } from "./FloatingMenu";
import {
  findNode,
  findParentId,
  useCollectionStore,
} from "../store/collection";
import { useUiStore } from "../store/ui";
import { useTabsStore } from "../store/tabs";
import { useResponseStore } from "../store/response";
import { buildSendOptions } from "../utils/send";
import { toCurl, type CurlFlavor } from "../utils/curl";
import { apixToPostman, postmanToApix } from "../utils/postman";
import { soapToSendOptions } from "../utils/soap";
import { openCollectionDir, revealRequestFile } from "../utils/files";
import type { TreeNode } from "../types/collection";

/** 左侧栏：搜索 + 新建菜单 + 接口树（增删改/重命名/拖拽）；宽度可拖拽 */
export default function Sidebar({ width }: { width: number }) {
  const { t } = useTranslation();
  const setStatus = useUiStore((s) => s.setStatus);
  const items = useCollectionStore((s) => s.items);
  const select = useCollectionStore((s) => s.select);
  const addRequest = useCollectionStore((s) => s.addRequest);
  const addFolder = useCollectionStore((s) => s.addFolder);
  const rename = useCollectionStore((s) => s.rename);
  const remove = useCollectionStore((s) => s.remove);
  const moveNode = useCollectionStore((s) => s.moveNode);
  const importCollection = useCollectionStore((s) => s.importCollection);
  const openNode = useTabsStore((s) => s.openNode);
  const setCurlImportOpen = useUiStore((s) => s.setCurlImportOpen);
  const insertFolderFromImport = useCollectionStore((s) => s.insertFolderFromImport);
  const duplicateRequest = useCollectionStore((s) => s.duplicateRequest);
  const justCreatedId = useCollectionStore((s) => s.justCreatedId);
  const colPath = useCollectionStore((s) => s.path);
  const rmap = useResponseStore((s) => s.map);
  // 高亮跟随当前激活页签（而不是最后一次点击的树节点）
  const activeNodeId = useTabsStore(
    (s) => s.tabs.find((t) => t.tabId === s.activeTabId)?.nodeId ?? null
  );

  /** 新建请求（REST/SOAP）后立即打开对应页签 */
  function addAndOpen(parentId: string | null, kind: "rest" | "soap") {
    addRequest(parentId, kind);
    const id = useCollectionStore.getState().selectedId;
    if (id) openNode(id);
  }

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  // 同步记录拖拽节点：dragover/drop 事件发生在 state 更新前，必须用 ref 才来得及
  const dragIdRef = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: TreeNode | null } | null>(null);
  const addRef = useRef<HTMLDivElement>(null);
  useClickOutside(addRef, () => setAddOpen(false), addOpen);

  // 新建/复制请求 → 树内直接进入重命名状态
  useEffect(() => {
    if (!justCreatedId) return;
    setRenamingId(justCreatedId);
    useCollectionStore.setState({ justCreatedId: null });
  }, [justCreatedId]);

  // 确认删除态：点击其他位置 / Esc 取消（删除按钮自身区域不重置）
  useEffect(() => {
    if (!confirmDeleteId) return;
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.("[data-del-confirm]")) return;
      setConfirmDeleteId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmDeleteId(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [confirmDeleteId]);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearDrag() {
    dragIdRef.current = null;
    setDragId(null);
    setDropTarget(null);
  }

  function handleDrop(targetId: string) {
    const id = dragIdRef.current;
    if (!id) return;
    const target = findNode(items, targetId);
    if (target?.type === "folder") moveNode(id, targetId, null);
    else moveNode(id, findParentId(items, targetId), targetId);
    clearDrag();
  }

  function commitRename(id: string, value: string) {
    const name = value.trim();
    if (name) rename(id, name);
    setRenamingId(null);
  }

  function handleRemove(node: TreeNode) {
    // 两步确认：第一次点 ✕ 进入确认态，再点一次才真正删除
    // （不使用 window.confirm —— Tauri WebView2 下它不阻塞 JS，时序不可靠）
    if (confirmDeleteId === node.id) {
      remove(node.id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(node.id);
    }
  }

  function duplicate(id: string) {
    duplicateRequest(id);
    const newId = useCollectionStore.getState().selectedId;
    if (newId) openNode(newId);
  }

  async function copyCurl(node: TreeNode, kind: CurlFlavor) {
    if (node.type !== "request") return;
    const opts =
      node.kind === "soap" ? soapToSendOptions(node.request) : buildSendOptions(node.request);
    try {
      await navigator.clipboard.writeText(toCurl(opts, kind));
      setStatus("statusbar.copied");
    } catch {
      setStatus("statusbar.copyFailed");
    }
  }

  async function doExport(node: TreeNode, format: "postman" | "apifox") {
    const items = node.type === "folder" ? node.children : [node];
    const content = apixToPostman(node.name, items);
    const p = await saveDialog({
      filters: [{ name: "JSON", extensions: ["json"] }],
      defaultPath:
        format === "apifox" ? `${node.name}.apifox.json` : `${node.name}.postman.json`,
    });
    if (typeof p !== "string") return;
    try {
      await invoke("write_text_file", { path: p, content });
      setStatus("statusbar.exported");
    } catch (e) {
      setStatus("statusbar.saveFailed", { reason: String(e) });
    }
  }

  function buildMenu(node: TreeNode | null): FloatingMenuItem[] {
    const items: FloatingMenuItem[] = [];
    // 根（空白区域）：新建 + 导入到根目录
    if (node === null) {
      items.push({
        key: "new",
        label: t("sidebar.new"),
        icon: "➕",
        sub: [
          { key: "rest", label: `${t("sidebar.newRequest")}（REST）` },
          { key: "soap", label: `${t("sidebar.newRequest")}（SOAP）` },
          { key: "folder", label: t("sidebar.addFolder") },
        ],
        onClick: (subKey) => {
          if (subKey === "soap") addAndOpen(null, "soap");
          else if (subKey === "folder") addFolder(null);
          else addAndOpen(null, "rest");
        },
      });
      items.push({
        key: "import",
        label: t("menu.import"),
        icon: "📥",
        sub: [
          { key: "file", label: t("sidebar.importFile") },
          { key: "curl", label: t("sidebar.curlImport") },
        ],
        onClick: (subKey) => {
          if (subKey === "curl") {
            setCurlImportOpen(true, null);
          } else {
            void importToRoot();
          }
        },
      });
      if (colPath) {
        items.push({
          key: "reveal",
          label: t("sidebar.revealInExplorer"),
          icon: "📂",
          onClick: () => void openCollectionDir(colPath),
        });
      }
      return items;
    }
    if (node.type === "request") {
      items.push({
        key: "curl",
        label: t("sidebar.copyCurl"),
        icon: "📋",
        sub: [
          { key: "linux", label: "Linux / macOS" },
          { key: "windows", label: "Windows (cmd)" },
        ],
        onClick: (subKey) => void copyCurl(node, (subKey as CurlFlavor) ?? "linux"),
      });
      items.push({
        key: "duplicate",
        label: t("sidebar.duplicate"),
        icon: "⧉",
        onClick: () => duplicate(node.id),
      });
    }
    items.push({
      key: "export",
      label: t("sidebar.export"),
      icon: "📤",
      sub: [
        { key: "postman", label: t("sidebar.exportPostman") },
        { key: "apifox", label: t("sidebar.exportApifox") },
      ],
      onClick: (subKey) => void doExport(node, (subKey as "postman" | "apifox") ?? "postman"),
    });
    // 文件夹：支持把 Postman/Apifox 文件或 cURL 导入到该目录内
    if (node.type === "folder") {
      items.push({
        key: "import",
        label: t("menu.import"),
        icon: "📥",
        sub: [
          { key: "file", label: t("sidebar.importFile") },
          { key: "curl", label: t("sidebar.curlImport") },
        ],
        onClick: (subKey) => {
          if (subKey === "curl") {
            setCurlImportOpen(true, node.id);
          } else {
            void importIntoFolder(node.id);
          }
        },
      });
    }
    // 在文件管理器中打开/定位
    if (node.type === "request" && colPath) {
      items.push({
        key: "reveal",
        label: t("sidebar.revealInExplorer"),
        icon: "📂",
        onClick: () => void revealRequestFile(colPath, node.id),
      });
    }
    if (node.type === "folder" && colPath) {
      items.push({
        key: "reveal",
        label: t("sidebar.revealInExplorer"),
        icon: "📂",
        onClick: () => void openCollectionDir(colPath),
      });
    }
    items.push({
      key: "rename",
      label: t("sidebar.rename"),
      icon: "✏️",
      onClick: () => setRenamingId(node.id),
    });
    items.push({
      key: "delete",
      label: t("sidebar.deleteBtn"),
      icon: "🗑",
      onClick: () => handleRemove(node),
    });
    return items;
  }

  /** 导入到根目录（作为新文件夹） */
  async function importToRoot() {
    const p = await openFileDialog({
      multiple: false,
      filters: [{ name: "Postman / Apifox 导出", extensions: ["json", "zip"] }],
    });
    if (typeof p !== "string") return;
    try {
      const raw = await invoke<string>("read_import_source", { path: p });
      const coll = postmanToApix(raw);
      insertFolderFromImport(coll);
      setStatus("statusbar.imported", { name: coll.name });
    } catch (e) {
      setStatus("statusbar.invalidFile", { reason: String(e) });
    }
  }

  /** 把 Postman/Apifox 导出文件导入到指定文件夹内 */
  async function importIntoFolder(folderId: string) {
    const p = await openFileDialog({
      multiple: false,
      filters: [{ name: "Postman / Apifox 导出", extensions: ["json", "zip"] }],
    });
    if (typeof p !== "string") return;
    try {
      const raw = await invoke<string>("read_import_source", { path: p });
      const coll = postmanToApix(raw);
      importCollection(coll, folderId);
      setStatus("statusbar.imported", { name: coll.name });
    } catch (e) {
      setStatus("statusbar.invalidFile", { reason: String(e) });
    }
  }

  function renameInput(node: TreeNode): ReactNode {
    return (
      <input
        autoFocus
        defaultValue={node.name}
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitRename(node.id, e.currentTarget.value);
          if (e.key === "Escape") setRenamingId(null);
        }}
        onBlur={(e) => commitRename(node.id, e.currentTarget.value)}
        className="w-full rounded border border-accent bg-panel px-1 text-xs text-ink outline-none"
      />
    );
  }

  const rowCls =
    "group flex items-center gap-2 rounded px-2 py-[5px] text-[12.5px] cursor-pointer select-none";
  const hoverBtn =
    "hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-[10px] text-ink-3 hover:bg-panel-2 hover:text-ink";

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const isDropTarget = dropTarget === node.id;
    const base = {
      draggable: renamingId !== node.id,
      onDragStart: (e: React.DragEvent) => {
        dragIdRef.current = node.id;
        setDragId(node.id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", node.id);
      },
      onDragEnd: clearDrag,
      onDragOver: (e: React.DragEvent) => {
        const did = dragIdRef.current;
        if (!did || did === node.id) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(node.id);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleDrop(node.id);
      },
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY, node });
      },
    };
    const highlight = isDropTarget ? " bg-accent-soft" : "";

    if (node.type === "folder") {
      return (
        <div
          key={node.id}
          // 文件夹整体（含子节点区）都是合法落点：放入该文件夹
          onDragOver={(e) => {
            const did = dragIdRef.current;
            if (!did || did === node.id) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDropTarget(node.id);
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(node.id);
          }}
        >
          <div
            {...base}
            onClick={() => toggleCollapse(node.id)}
            onDoubleClick={() => setRenamingId(node.id)}
            style={{ paddingLeft: 8 + depth * 16 }}
            className={rowCls + highlight + " hover:bg-panel-2"}
          >
            <span className="w-2.5 text-[9px] text-ink-3">
              {collapsed.has(node.id) ? "▸" : "▾"}
            </span>
            <span className="text-[13px]">📁</span>
            {renamingId === node.id ? (
              renameInput(node)
            ) : (
              <span className="truncate font-medium text-ink-2">{node.name}</span>
            )}
            <span className="ml-auto hidden items-center gap-0.5 group-hover:flex">
              <button
                title={t("sidebar.addRequest")}
                onClick={(e) => {
                  e.stopPropagation();
                  addAndOpen(node.id, "rest");
                }}
                className={hoverBtn}
              >
                ＋
              </button>
              <button
                title={t("sidebar.addFolder")}
                onClick={(e) => {
                  e.stopPropagation();
                  addFolder(node.id);
                }}
                className={hoverBtn}
              >
                🗂
              </button>
              <button
                data-del-confirm
                title={t("sidebar.deleteBtn")}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(node);
                }}
                className={
                  confirmDeleteId === node.id
                    ? "hidden group-hover:flex h-5 items-center rounded bg-[#f53f3f] px-1 text-[10px] font-medium text-white"
                    : hoverBtn + " hover:!text-[#f53f3f]"
                }
              >
                {confirmDeleteId === node.id ? t("sidebar.confirmDeleteBtn") : "✕"}
              </button>
            </span>
          </div>
          {!collapsed.has(node.id) &&
            node.children.map((c) => renderNode(c, depth + 1))}
        </div>
      );
    }

    const methodCls = node.kind === "soap" ? "m-SOAP" : `m-${node.request.method}`;
    return (
      <div
        key={node.id}
        {...base}
        onClick={() => {
          select(node.id);
          openNode(node.id);
        }}
        onDoubleClick={() => setRenamingId(node.id)}
        style={{ paddingLeft: 8 + depth * 16 }}
        className={
          rowCls +
          highlight +
          (activeNodeId === node.id
            ? " bg-accent-soft text-accent"
            : " hover:bg-panel-2")
        }
      >
        {(() => {
          const rs = rmap[node.id];
          // 运行中：方法标签换成加载动画
          if (rs?.loading) return <span className="spinner" />;
          return (
            <span className={`method-tag w-[38px] shrink-0 ${methodCls}`}>
              {node.kind === "soap" ? "SOAP" : node.request.method}
            </span>
          );
        })()}
        {renamingId === node.id ? (
          renameInput(node)
        ) : (
          <span className="truncate">{node.name}</span>
        )}
        {rmap[node.id]?.bubble && (
          <span
            className={`bubble-badge ${rmap[node.id]!.bubble}`}
            title={
              rmap[node.id]!.bubble === "ok"
                ? t("response.doneOk")
                : t("response.doneErr")
            }
          >
            {rmap[node.id]!.bubble === "ok" ? "✓" : "!"}
          </span>
        )}
        <span className="ml-auto hidden group-hover:flex">
          <button
            data-del-confirm
            title={t("sidebar.deleteBtn")}
            onClick={(e) => {
              e.stopPropagation();
              handleRemove(node);
            }}
            className={
              confirmDeleteId === node.id
                ? "hidden group-hover:flex h-5 items-center rounded bg-[#f53f3f] px-1 text-[10px] font-medium text-white"
                : hoverBtn + " hover:!text-[#f53f3f]"
            }
          >
            {confirmDeleteId === node.id ? t("sidebar.confirmDeleteBtn") : "✕"}
          </button>
        </span>
      </div>
    );
  };

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-line bg-panel"
      style={{ width }}
    >
      {/* 搜索 + 新建 */}
      <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-2.5">
        <div className="flex h-[30px] flex-1 items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2.5">
          <span className="text-ink-3">🔍</span>
          <input
            placeholder={t("sidebar.search")}
            className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        <div className="relative" ref={addRef}>
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="h-[30px] shrink-0 rounded-md border border-accent bg-accent-soft px-2.5 text-xs font-medium text-accent hover:brightness-95"
          >
            ＋ {t("sidebar.new")}
          </button>
          {addOpen && (
            <div className="absolute right-0 top-[34px] z-[80] w-40 rounded-lg border border-line bg-panel p-1 shadow-xl">
              <div
                onClick={() => {
                  addAndOpen(null, "rest");
                  setAddOpen(false);
                }}
                className="cursor-pointer rounded px-3 py-2 text-xs text-ink hover:bg-panel-2"
              >
                📄 {t("sidebar.newRequest")}（REST）
              </div>
              <div
                onClick={() => {
                  addAndOpen(null, "soap");
                  setAddOpen(false);
                }}
                className="cursor-pointer rounded px-3 py-2 text-xs text-ink hover:bg-panel-2"
              >
                🔗 {t("sidebar.newRequest")}（SOAP）
              </div>
              <div
                onClick={() => {
                  addFolder(null);
                  setAddOpen(false);
                }}
                className="cursor-pointer rounded px-3 py-2 text-xs text-ink hover:bg-panel-2"
              >
                📁 {t("sidebar.addFolder")}
              </div>
              <div
                onClick={() => {
                  setAddOpen(false);
                  setCurlImportOpen(true);
                }}
                className="cursor-pointer rounded px-3 py-2 text-xs text-ink hover:bg-panel-2"
              >
                📋 {t("sidebar.curlImport")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 接口树（容器级 drop = 移到根目录；空白右键 = 根目录菜单） */}
      <div
        className="flex-1 overflow-y-auto px-1.5 py-1"
        onDragOver={(e) => {
          if (!dragIdRef.current) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropTarget("root");
        }}
        onDrop={(e) => {
          e.preventDefault();
          const id = dragIdRef.current;
          if (id) moveNode(id, null, null);
          clearDrag();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY, node: null });
        }}
      >
        {items.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-5 text-ink-3">
            {t("sidebar.emptyTree")}
          </p>
        ) : (
          items.map((n) => renderNode(n, 0))
        )}
        {dragId && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget("root");
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = dragIdRef.current;
              if (id) moveNode(id, null, null);
              clearDrag();
            }}
            className={`m-1.5 rounded-md border border-dashed px-2 py-2 text-center text-[11px] ${
              dropTarget === "root"
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-ink-3"
            }`}
          >
            {t("sidebar.dropToRoot")}
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {ctxMenu && (
        <FloatingMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={buildMenu(ctxMenu.node)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </aside>
  );
}
