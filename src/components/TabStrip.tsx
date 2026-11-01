import { useTranslation } from "react-i18next";
import { findNode, useCollectionStore } from "../store/collection";
import { useTabsStore } from "../store/tabs";
import { useResponseStore } from "../store/response";
import { TabMenuBridge } from "./TabContextMenu";

/** 多标签条：方法色块 + 未保存蓝点 + 运行中加载动画 + 完成气泡（绿勾/红叹号）+ 右键菜单 */
export default function TabStrip() {
  const { t } = useTranslation();
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const activate = useTabsStore((s) => s.activate);
  const closeTab = useTabsStore((s) => s.closeTab);
  const openBlankRest = useTabsStore((s) => s.openBlankRest);
  const items = useCollectionStore((s) => s.items);
  const rmap = useResponseStore((s) => s.map);
  const dirtyNodeId = useCollectionStore((s) => s.dirtyNodeId);

  return (
    <div className="flex items-end gap-0.5 overflow-x-auto bg-bg px-2 pt-1.5">
      {tabs.map((tab) => {
        const node = findNode(items, tab.nodeId);
        if (!node || node.type !== "request") return null;
        const active = tab.tabId === activeTabId;
        const rs = rmap[tab.nodeId];
        const methodCls =
          node.kind === "soap" ? "m-SOAP" : `m-${node.request.method}`;
        return (
          <div
            key={tab.tabId}
            onClick={() => activate(tab.tabId)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              TabMenuBridge.show(tab.nodeId, e.clientX, e.clientY);
            }}
            className={`relative flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-t-lg border border-b-0 px-3 py-2 text-xs ${
              active
                ? "border-line bg-panel text-ink"
                : "border-transparent bg-panel-2 text-ink-2 hover:text-ink"
            }`}
          >
            {rs?.loading ? (
              <span className="spinner" title={t("response.sending")} />
            ) : (
              <span className={`method-tag w-auto font-bold ${methodCls}`}>
                {node.kind === "soap" ? "SOAP" : node.request.method}
              </span>
            )}
            <span className="max-w-[120px] truncate">{node.name}</span>
            {dirtyNodeId === tab.nodeId && !rs?.loading && (
              <span className="tab-dirty-dot" title={t("tabs.unsaved")} />
            )}
            {rs?.bubble && (
              <span
                className={`tab-bubble ${rs.bubble}`}
                title={rs.bubble === "ok" ? t("response.doneOk") : t("response.doneErr")}
              >
                {rs.bubble === "ok" ? "✓" : "!"}
              </span>
            )}
            <span
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.tabId);
              }}
              className="rounded px-1 text-[11px] text-ink-3 hover:bg-panel-2 hover:text-[#f53f3f]"
            >
              ✕
            </span>
          </div>
        );
      })}
      <div
        onClick={openBlankRest}
        title={t("tabs.newTab")}
        className="mb-0.5 shrink-0 cursor-pointer rounded-md px-2.5 py-1.5 text-[15px] leading-none text-ink-3 hover:bg-panel-2 hover:text-ink"
      >
        ＋
      </div>
    </div>
  );
}
