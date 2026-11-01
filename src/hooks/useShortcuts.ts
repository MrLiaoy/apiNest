/** 全局快捷键：Ctrl+Enter 发送 / Ctrl+S 保存 / Ctrl+W 关标签 / Ctrl+T 新建 REST 标签 */
import { useEffect } from "react";
import { useCollectionStore } from "../store/collection";
import { useTabsStore } from "../store/tabs";
import { sendActiveRequest } from "../utils/sendActive";

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "enter") {
        e.preventDefault();
        sendActiveRequest();
      } else if (key === "s") {
        e.preventDefault();
        void useCollectionStore.getState().save();
      } else if (key === "w") {
        e.preventDefault();
        const { activeTabId, closeTab } = useTabsStore.getState();
        if (activeTabId) closeTab(activeTabId);
      } else if (key === "t") {
        e.preventDefault();
        useTabsStore.getState().openBlankRest();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
