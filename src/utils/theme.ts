import { getCurrentWindow } from "@tauri-apps/api/window";

export type ThemeMode = "light" | "dark" | "system";

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

/** 应用主题到 HTML 与原生标题栏；system 模式交还系统控制 */
export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute("data-theme", resolved);
  getCurrentWindow()
    .setTheme(mode === "system" ? null : resolved)
    .catch(() => {});
}
