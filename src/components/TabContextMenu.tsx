import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import FloatingMenu, { type FloatingMenuItem } from "./FloatingMenu";
import Modal from "./Modal";
import { findNode, useCollectionStore } from "../store/collection";
import { useTabsStore } from "../store/tabs";
import { useUiStore } from "../store/ui";
import { buildSendOptions } from "../utils/send";
import { toCurl, type CurlFlavor } from "../utils/curl";
import { apixToPostman } from "../utils/postman";
import { soapToSendOptions } from "../utils/soap";

/** 页签右键菜单：与左侧树右键一致（复制 cURL / 复制副本 / 导出 / 新建 / 重命名 / 删除） */

/** 桥接：页签条把 (nodeId, x, y) 推给单例菜单 */
class TabMenuBridgeImpl {
  private listener: ((nodeId: string, x: number, y: number) => void) | null = null;
  show(nodeId: string, x: number, y: number) {
    this.listener?.(nodeId, x, y);
  }
  subscribe(fn: (nodeId: string, x: number, y: number) => void) {
    this.listener = fn;
    return () => {
      if (this.listener === fn) this.listener = null;
    };
  }
}
export const TabMenuBridge = new TabMenuBridgeImpl();

export default function TabContextMenu() {
  const { t } = useTranslation();
  const setStatus = useUiStore((s) => s.setStatus);
  const items = useCollectionStore((s) => s.items);
  const duplicateRequest = useCollectionStore((s) => s.duplicateRequest);
  const rename = useCollectionStore((s) => s.rename);
  const openNode = useTabsStore((s) => s.openNode);
  const openBlankRest = useTabsStore((s) => s.openBlankRest);
  const openBlankSoap = useTabsStore((s) => s.openBlankSoap);
  const tabList = useTabsStore((s) => s.tabs);
  const closeRight = useTabsStore((s) => s.closeRight);
  const closeLeft = useTabsStore((s) => s.closeLeft);
  const closeAll = useTabsStore((s) => s.closeAll);

  /** nodeId → tabId（批量关闭以页签为单位） */
  const tabIdOf = (nodeId: string) =>
    tabList.find((t) => t.nodeId === nodeId)?.tabId ?? "";

  const [ctx, setCtx] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [renameCtx, setRenameCtx] = useState<{ id: string; name: string } | null>(null);

  useEffect(
    () =>
      TabMenuBridge.subscribe((nodeId, x, y) => setCtx({ nodeId, x, y })),
    []
  );
  const node = ctx ? findNode(items, ctx.nodeId) : null;

  async function copyCurl(kind: CurlFlavor) {
    if (!node || node.type !== "request") return;
    const opts =
      node.kind === "soap" ? soapToSendOptions(node.request) : buildSendOptions(node.request);
    try {
      await navigator.clipboard.writeText(toCurl(opts, kind));
      setStatus("statusbar.copied");
    } catch {
      setStatus("statusbar.copyFailed");
    }
  }

  async function doExport(format: "postman" | "apifox") {
    if (!node) return;
    const exportItems = node.type === "folder" ? node.children : [node];
    const content = apixToPostman(node.name, exportItems);
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

  function buildMenu(): FloatingMenuItem[] {
    if (!node) return [];
    const menu: FloatingMenuItem[] = [];
    if (node.type === "request") {
      menu.push({
        key: "curl",
        label: t("sidebar.copyCurl"),
        icon: "📋",
        sub: [
          { key: "linux", label: "Linux / macOS" },
          { key: "windows", label: "Windows (cmd)" },
        ],
        onClick: (subKey) => void copyCurl((subKey as CurlFlavor) ?? "linux"),
      });
      menu.push({
        key: "duplicate",
        label: t("sidebar.duplicate"),
        icon: "⧉",
        onClick: () => {
          duplicateRequest(node.id);
          const newId = useCollectionStore.getState().selectedId;
          if (newId) openNode(newId);
        },
      });
    }
    menu.push({
      key: "export",
      label: t("sidebar.export"),
      icon: "📤",
      sub: [
        { key: "postman", label: t("sidebar.exportPostman") },
        { key: "apifox", label: t("sidebar.exportApifox") },
      ],
      onClick: (subKey) => void doExport((subKey as "postman" | "apifox") ?? "postman"),
    });
    menu.push({
      key: "new",
      label: t("sidebar.new"),
      icon: "➕",
      sub: [
        { key: "rest", label: `${t("sidebar.newRequest")}（REST）` },
        { key: "soap", label: `${t("sidebar.newRequest")}（SOAP）` },
      ],
      onClick: (subKey) => {
        if (subKey === "soap") openBlankSoap();
        else openBlankRest();
      },
    });
    menu.push({
      key: "rename",
      label: t("sidebar.rename"),
      icon: "✏️",
      onClick: () => setRenameCtx({ id: node.id, name: node.name }),
    });
    // 批量关闭页签（以当前右键页签为基准）
    menu.push({
      key: "closeRight",
      label: t("tabs.closeRight"),
      icon: "⇥",
      onClick: () => closeRight(tabIdOf(ctx!.nodeId)),
    });
    menu.push({
      key: "closeLeft",
      label: t("tabs.closeLeft"),
      icon: "⇤",
      onClick: () => closeLeft(tabIdOf(ctx!.nodeId)),
    });
    menu.push({
      key: "closeAll",
      label: t("tabs.closeAll"),
      icon: "✕✕",
      onClick: () => closeAll(),
    });
    return menu;
  }

  return (
    <>
      {ctx && (
        <FloatingMenu
          x={ctx.x}
          y={ctx.y}
          items={buildMenu()}
          onClose={() => setCtx(null)}
        />
      )}
      {renameCtx && (
        <Modal
          title={t("sidebar.rename")}
          onClose={() => setRenameCtx(null)}
          width={380}
        >
          <input
            autoFocus
            value={renameCtx.name}
            onChange={(e) => setRenameCtx({ ...renameCtx, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (renameCtx.name.trim()) rename(renameCtx.id, renameCtx.name.trim());
                setRenameCtx(null);
              }
            }}
            className="h-9 w-full rounded-md border border-line bg-panel-2 px-3 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setRenameCtx(null)}
              className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-panel-2"
            >
              {t("about.close")}
            </button>
            <button
              onClick={() => {
                if (renameCtx.name.trim()) rename(renameCtx.id, renameCtx.name.trim());
                setRenameCtx(null);
              }}
              className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:brightness-110"
            >
              {t("about.ok")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
