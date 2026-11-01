import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import Modal from "./Modal";
import i18n from "../i18n";
import zh from "../locales/zh.json";
import { useSettingsStore } from "../store/settings";
import { useUiStore } from "../store/ui";
import type { ThemeMode } from "../utils/theme";

/** 设置弹窗：基础设置（自动保存 / 主题 / 语言） + 快捷键展示 */
export default function SettingsDialog() {
  const { t } = useTranslation();
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const setStatus = useUiStore((s) => s.setStatus);
  const {
    autoSave,
    theme,
    lang,
    workspaceDir,
    maxHistoryPerRequest,
    uiScale,
    customLangs,
    shortcuts,
    setAutoSave,
    setTheme,
    setLang,
    setWorkspaceDir,
    setMaxHistoryPerRequest,
    setUiScale,
    setCustomLangs,
  } = useSettingsStore();
  const [tab, setTab] = useState<"general" | "shortcuts">("general");
  const [resolvedDir, setResolvedDir] = useState("");

  // 工作区目录展示（null = 默认 appDataDir/workspace）
  useEffect(() => {
    void (async () => {
      setResolvedDir(workspaceDir ?? (await join(await appDataDir(), "workspace")));
    })();
  }, [workspaceDir]);

  async function onChangeWorkspaceDir() {
    const dir = await open({ directory: true });
    if (typeof dir === "string") setWorkspaceDir(dir);
  }

  async function onOpenWorkspaceDir() {
    try {
      await invoke("ensure_dir", { path: resolvedDir });
      await openPath(resolvedDir);
    } catch {
      setStatus("settings.openDirFailed");
    }
  }

  async function openLocaleDir() {
    try {
      const dir = await appDataDir();
      const locales = await join(dir, "locales");
      await mkdir(locales, { recursive: true }).catch(() => {});
      // 放一份语言包样例（首次生成，不覆盖用户改动）
      const templatePath = await join(locales, "template.json");
      if (!(await exists(templatePath).catch(() => false))) {
        const template = {
          __name: "样例：复制本文件、翻译值、改名后上传",
          _说明:
            "1. 复制本文件并重命名为语言代码（如 fr.json）；2. __name 填语言显示名；3. 翻译所有值（{{xxx}} 为变量占位请保留）；4. 通过本设置页上传，或重启应用自动加载。",
          ...zh,
        };
        await writeTextFile(templatePath, JSON.stringify(template, null, 2)).catch(
          () => {}
        );
      }
      await openPath(locales);
    } catch {
      setStatus("settings.openDirFailed");
    }
  }

  async function uploadLanguageFile() {
    const p = await open({
      multiple: false,
      filters: [{ name: "语言配置 JSON", extensions: ["json"] }],
    });
    if (typeof p !== "string") return;
    try {
      const result = await invoke<{ code: string; content: string }>("install_language", {
        src: p,
      });
      // 立即注册并切到新语言，无需重启
      i18n.addResourceBundle(
        result.code,
        "translation",
        JSON.parse(result.content),
        true,
        true
      );
      const existing = customLangs.filter((l) => l.code !== result.code);
      let name = result.code;
      try {
        const parsed = JSON.parse(result.content) as { __name?: string };
        if (typeof parsed.__name === "string") name = parsed.__name;
      } catch {
        /* ignore */
      }
      setCustomLangs([...existing, { code: result.code, name }]);
      setLang(result.code);
      setStatus("statusbar.langInstalled", { name });
    } catch (e) {
      setStatus("statusbar.langInstallFailed", { reason: String(e) });
    }
  }

  const label = "text-xs text-ink-2";
  const pill = (active: boolean) =>
    `cursor-pointer rounded-md border px-3 py-1.5 text-xs ${
      active
        ? "border-accent bg-accent-soft font-medium text-accent"
        : "border-line text-ink-2 hover:bg-panel-2"
    }`;

  return (
    <Modal title={t("settings.title")} onClose={() => setSettingsOpen(false)}>
      {/* 页签 */}
      <div className="mb-4 flex gap-1 border-b border-line">
        {(["general", "shortcuts"] as const).map((key) => (
          <div
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px cursor-pointer border-b-2 px-3 pb-2 text-[12.5px] ${
              tab === key
                ? "border-accent font-medium text-accent"
                : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {t(`settings.tab${key === "general" ? "General" : "Shortcuts"}`)}
          </div>
        ))}
      </div>

      {tab === "general" ? (
        <div className="flex flex-col gap-5">
          {/* 自动保存 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] text-ink">{t("settings.autoSave")}</div>
              <div className="mt-0.5 text-[11.5px] text-ink-3">
                {t("settings.autoSaveHint")}
              </div>
            </div>
            <button
              onClick={() => setAutoSave(!autoSave)}
              className={`h-5 w-9 shrink-0 rounded-full transition ${
                autoSave ? "bg-accent" : "bg-[var(--border)]"
              }`}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-white shadow transition ${
                  autoSave ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* 主题 */}
          <div className="flex items-center justify-between">
            <div className={label}>{t("settings.theme")}</div>
            <div className="flex gap-1.5">
              {(["light", "dark", "system"] as ThemeMode[]).map((m) => (
                <div key={m} onClick={() => setTheme(m)} className={pill(theme === m)}>
                  {t(`settings.theme${m[0].toUpperCase()}${m.slice(1)}`)}
                </div>
              ))}
            </div>
          </div>

          {/* 工作区目录 */}
          <div>
            <div className="flex items-center justify-between">
              <div className={label}>{t("settings.workspaceDir")}</div>
              <div className="flex gap-1.5">
                <button
                  onClick={onChangeWorkspaceDir}
                  className="rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-2 hover:bg-panel-2"
                >
                  {t("settings.changeDir")}
                </button>
                <button
                  onClick={onOpenWorkspaceDir}
                  className="rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-2 hover:bg-panel-2"
                >
                  {t("settings.openDir")}
                </button>
              </div>
            </div>
            <p
              title={resolvedDir}
              className="mt-1.5 truncate rounded bg-panel-2 px-2 py-1.5 font-mono text-[11px] text-ink-3"
            >
              {resolvedDir}
            </p>
            <p className="mt-1 text-[11.5px] text-ink-3">
              {t("settings.workspaceHint")}
            </p>
          </div>

          {/* 单请求历史条数 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] text-ink">{t("settings.maxHistory")}</div>
              <div className="mt-0.5 text-[11.5px] text-ink-3">
                {t("settings.maxHistoryHint")}
              </div>
            </div>
            <input
              type="number"
              min={10}
              max={1000}
              value={maxHistoryPerRequest}
              onChange={(e) => {
                const n = Math.min(1000, Math.max(10, Math.floor(Number(e.target.value) || 100)));
                setMaxHistoryPerRequest(n);
              }}
              className="h-8 w-24 rounded-md border border-line bg-panel-2 px-2 text-right text-xs text-ink outline-none focus:border-accent"
            />
          </div>

          {/* 界面缩放 */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] text-ink">{t("settings.uiScale")}</div>
                <div className="mt-0.5 text-[11.5px] text-ink-3">
                  {t("settings.uiScaleHint")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={90}
                  max={130}
                  step={5}
                  value={Math.round(uiScale * 100)}
                  onChange={(e) => setUiScale(Number(e.target.value) / 100)}
                  className="w-40"
                  style={{ accentColor: "var(--accent)" }}
                />
                <span className="w-10 text-right text-xs text-ink-2">
                  {Math.round(uiScale * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* 语言 */}
          <div>
            <div className="flex items-center justify-between">
              <div className={label}>{t("settings.language")}</div>
              <div className="flex items-center gap-2">
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="h-8 rounded-md border border-line bg-panel-2 px-2 text-xs text-ink outline-none focus:border-accent"
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                  {customLangs.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={uploadLanguageFile}
                  className="rounded-md border border-accent bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent hover:brightness-95"
                >
                  {t("settings.uploadLang")}
                </button>
                <button
                  onClick={openLocaleDir}
                  className="rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-2 hover:bg-panel-2"
                >
                  {t("settings.openLocaleDir")}
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11.5px] leading-5 text-ink-3">
              {t("settings.languageHint")}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(
            [
              ["shortcutSend", shortcuts.send],
              ["shortcutSave", shortcuts.save],
              ["shortcutCloseTab", shortcuts.closeTab],
              ["shortcutNewTab", shortcuts.newTab],
            ] as const
          ).map(([key, binding]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-[13px] text-ink">{t(`settings.${key}`)}</span>
              <kbd className="rounded border border-line bg-panel-2 px-2 py-0.5 text-[11px] text-ink-2">
                {binding}
              </kbd>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
