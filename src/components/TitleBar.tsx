import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { useClickOutside } from "../hooks/useClickOutside";
import { useUiStore } from "../store/ui";
import { useSettingsStore } from "../store/settings";
import {
  basename,
  useCollectionStore,
} from "../store/collection";
import { postmanToApix } from "../utils/postman";
import { openCollectionDir } from "../utils/files";
import FloatingMenu from "./FloatingMenu";
import Logo from "./Logo";
import { resolveTheme } from "../utils/theme";

/** 自绘标题栏：菜单（文件/设置/关于）+ 拖动区 + 窗口控制 */
export default function TitleBar() {
  const { t } = useTranslation();
  const win = getCurrentWindow();
  const setStatus = useUiStore((s) => s.setStatus);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const setAboutOpen = useUiStore((s) => s.setAboutOpen);
  const setCloseConfirmOpen = useUiStore((s) => s.setCloseConfirmOpen);
  const { theme, lang, recents, setTheme, setLang, clearRecents } =
    useSettingsStore();
  const colPath = useCollectionStore((s) => s.path);
  const colDirty = useCollectionStore((s) => s.dirty);
  const newCollection = useCollectionStore((s) => s.newCollection);
  const save = useCollectionStore((s) => s.save);
  const saveAs = useCollectionStore((s) => s.saveAs);
  const openFromDir = useCollectionStore((s) => s.openFromDir);
  const insertFolderFromImport = useCollectionStore((s) => s.insertFolderFromImport);

  async function onOpenWorkspace() {
    setFileOpen(false);
    const dir = await open({ directory: true, title: t("menu.openWorkspace") });
    if (typeof dir === "string") await openFromDir(dir);
  }

  async function onImport() {
    setFileOpen(false);
    const path = await open({
      multiple: false,
      filters: [
        { name: "Postman / Apifox 导出", extensions: ["json", "zip"] },
      ],
    });
    if (typeof path !== "string") return;
    try {
      const raw = await invoke<string>("read_import_source", { path });
      const coll = postmanToApix(raw);
      insertFolderFromImport(coll);
      setStatus("statusbar.imported", { name: coll.name });
    } catch (e) {
      setStatus("statusbar.invalidFile", { reason: String(e) });
    }
  }

  const [fileOpen, setFileOpen] = useState(false);
  const [chipMenu, setChipMenu] = useState<{ x: number; y: number } | null>(null);
  const fileRef = useRef<HTMLDivElement>(null);
  useClickOutside(fileRef, () => setFileOpen(false), fileOpen);

  function toggleTheme() {
    // 快捷切换只在亮/暗间循环；「跟随系统」在设置弹窗里选
    setTheme(resolveTheme(theme) === "dark" ? "light" : "dark");
  }

  function toggleLang() {
    setLang(lang === "zh" ? "en" : "zh");
  }

  const iconBtn =
    "flex h-7 w-8 items-center justify-center rounded text-ink-3 hover:bg-panel-2 hover:text-ink";
  const menuBtn = (active: boolean) =>
    `rounded px-2.5 py-1 text-xs text-ink-2 hover:bg-panel-2 hover:text-ink ${
      active ? "bg-panel-2 text-ink" : ""
    }`;
  const menuItem =
    "cursor-pointer rounded px-3 py-2 text-xs text-ink hover:bg-panel-2";

  return (
    <header
      data-tauri-drag-region
      className="flex h-[42px] shrink-0 items-center gap-1 border-b border-line bg-panel px-3"
    >
      {/* 应用标识 */}
      <div data-tauri-drag-region className="mr-1 flex items-center gap-1.5">
        <Logo size={18} />
        <span className="text-[14px] font-semibold text-ink">{t("app.name")}</span>
      </div>

      {/* 菜单：文件 / 设置 / 关于 */}
      <div className="relative" ref={fileRef}>
        <button onClick={() => setFileOpen((v) => !v)} className={menuBtn(fileOpen)}>
          {t("menu.file")}
        </button>
        {fileOpen && (
          <div className="absolute left-0 top-[30px] z-[90] w-64 rounded-lg border border-line bg-panel p-1 shadow-xl">
            <div
              onClick={() => {
                newCollection();
                setFileOpen(false);
              }}
              className={menuItem}
            >
              ✨ {t("menu.newCollection")}
            </div>
            <div onClick={onOpenWorkspace} className={menuItem}>
              📂 {t("menu.openWorkspace")}
            </div>
            <div
              onClick={() => {
                void save();
                setFileOpen(false);
              }}
              className={menuItem}
            >
              💾 {t("menu.save")}
            </div>
            <div
              onClick={() => {
                void saveAs();
                setFileOpen(false);
              }}
              className={menuItem}
            >
              📝 {t("menu.saveAs")}
            </div>
            <div onClick={onImport} className={menuItem}>
              📥 {t("menu.import")}
            </div>
            <div className="mx-1 my-1 border-t border-line" />
            <div className="flex items-center justify-between px-3 py-1 text-[11px] text-ink-3">
              {t("menu.recent")}
              {recents.length > 0 && (
                <span onClick={clearRecents} className="cursor-pointer hover:text-ink">
                  {t("menu.clearRecents")}
                </span>
              )}
            </div>
            {recents.length === 0 ? (
              <div className="px-3 py-1.5 text-[11.5px] text-ink-3">
                {t("menu.noRecent")}
              </div>
            ) : (
              recents.map((p) => (
                <div
                  key={p}
                  onClick={() => {
                    setFileOpen(false);
                    void openFromDir(p);
                  }}
                  title={p}
                  className="cursor-pointer truncate rounded px-3 py-1.5 text-xs text-ink-2 hover:bg-panel-2 hover:text-ink"
                >
                  {p}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <button onClick={() => setSettingsOpen(true)} className={menuBtn(false)}>
        {t("menu.settings")}
      </button>
      <button onClick={() => setAboutOpen(true)} className={menuBtn(false)}>
        {t("menu.about")}
      </button>

      {/* 当前集合文件状态（右键 → 在文件管理器中打开） */}
      <div
        data-tauri-drag-region
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (colPath) setChipMenu({ x: e.clientX, y: e.clientY });
        }}
        className="ml-1 flex items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2.5 py-1 text-xs text-ink-2"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            colPath ? (colDirty ? "bg-[#ff7d00]" : "bg-[#00b42a]") : "bg-ink-3"
          }`}
        />
        {colPath ? basename(colPath) : t("titlebar.noFile")}
      </div>
      {chipMenu && colPath && (
        <FloatingMenu
          x={chipMenu.x}
          y={chipMenu.y}
          items={[
            {
              key: "reveal",
              label: t("sidebar.revealInExplorer"),
              icon: "📂",
              onClick: () => void openCollectionDir(colPath),
            },
          ]}
          onClose={() => setChipMenu(null)}
        />
      )}

      <div className="flex-1" data-tauri-drag-region />

      {/* 语言 / 主题快捷切换 */}
      <button onClick={toggleLang} className={iconBtn + " text-xs"}>
        {lang === "zh" ? "EN" : "中文"}
      </button>
      <button onClick={toggleTheme} className={iconBtn + " text-[15px]"}>
        {resolveTheme(theme) === "dark" ? "☀️" : "🌙"}
      </button>

      {/* 窗口控制 */}
      <div className="ml-1.5 flex">
        <button className={iconBtn} title={t("titlebar.minimize")} onClick={() => win.minimize()}>
          ─
        </button>
        <button className={iconBtn} title={t("titlebar.maximize")} onClick={() => win.toggleMaximize()}>
          □
        </button>
        <button
          onClick={() => setCloseConfirmOpen(true)}
          className={iconBtn + " hover:!bg-[#f53f3f] hover:!text-white"}
          title={t("titlebar.close")}
        >
          ✕
        </button>
      </div>
    </header>
  );
}
