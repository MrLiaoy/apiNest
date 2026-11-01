import { useEffect } from "react";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import TabStrip from "./components/TabStrip";
import RequestEditor from "./components/RequestEditor";
import ResponsePanel from "./components/ResponsePanel";
import StatusBar from "./components/StatusBar";
import SettingsDialog from "./components/SettingsDialog";
import AboutDialog from "./components/AboutDialog";
import CurlImportDialog from "./components/CurlImportDialog";
import TabContextMenu from "./components/TabContextMenu";
import Toast from "./components/Toast";
import CloseConfirmDialog from "./components/CloseConfirmDialog";
import { useShortcuts } from "./hooks/useShortcuts";
import { useUiStore } from "./store/ui";
import { useSettingsStore } from "./store/settings";
import { bootstrapLastCollection } from "./store/collection";
import { applyTheme } from "./utils/theme";

/** 可拖动分隔条：拖动调整响应区高度 */
function Divider() {
  const setResponseHeight = useUiStore((s) => s.setResponseHeight);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const h = Math.min(
        Math.max(window.innerHeight - ev.clientY, 120),
        window.innerHeight - 260
      );
      setResponseHeight(h);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className="h-[5px] shrink-0 cursor-row-resize border-t border-line bg-panel hover:bg-accent-soft"
    />
  );
}

/** 启动引导只执行一次（StrictMode 双渲染防护） */
let appBooted = false;

/** 任务 01：五区域主布局（标题栏 / 侧栏 / 编辑区 / 响应区 / 状态栏） */
export default function App() {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const aboutOpen = useUiStore((s) => s.aboutOpen);
  const curlImportOpen = useUiStore((s) => s.curlImportOpen);
  const theme = useSettingsStore((s) => s.theme);

  // 启动：恢复最后一次打开的工作区；首次使用则创建默认工作区
  useEffect(() => {
    if (appBooted) return;
    appBooted = true;
    void bootstrapLastCollection();
  }, []);

  useShortcuts();

  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);

  // 侧栏拖宽（200~420，持久化）
  function startSidebarDrag(e: React.MouseEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      setSidebarWidth(Math.min(Math.max(ev.clientX, 200), 420));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // 「跟随系统」主题：监听系统配色变化实时切换
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // 右键菜单整理：除文本输入控件外，屏蔽默认浏览器右键菜单
  // （自定义右键菜单在树/历史行上通过 onContextMenu 单独接管）
  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable
      )
        return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, []);

  // Ctrl+A 范围限制：焦点在标记了 data-selectable 的区域内 → 只全选该区域；
  // 在普通输入控件里 → 浏览器默认行为；在其他位置 → 不做整页全选
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && (e.key === "a" || e.key === "A"))) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      const region = target.closest?.("[data-selectable]");
      e.preventDefault();
      if (!region) return;
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(region);
      sel?.removeAllRanges();
      sel?.addRange(range);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar width={sidebarWidth} />
        <div
          onMouseDown={startSidebarDrag}
          className="w-[4px] shrink-0 cursor-col-resize bg-transparent hover:bg-accent-soft"
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <TabStrip />
          <RequestEditor />
          <Divider />
          <ResponsePanel />
        </main>
      </div>
      <StatusBar />
      {settingsOpen && <SettingsDialog />}
      {aboutOpen && <AboutDialog />}
      {curlImportOpen && <CurlImportDialog />}
      <CloseConfirmDialog />
      <Toast />
      <TabContextMenu />
    </div>
  );
}
