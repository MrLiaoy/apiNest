import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { appDataDir, join } from "@tauri-apps/api/path";
import { mkdir, readDir, readTextFile } from "@tauri-apps/plugin-fs";

import zh from "./locales/zh.json";
import en from "./locales/en.json";

// 语言来源优先级：apix.settings > 旧键 apix.language > 系统语言
function initialLang(): string {
  try {
    const s = JSON.parse(localStorage.getItem("apix.settings") || "{}");
    if (s.lang) return s.lang;
  } catch {
    /* ignore */
  }
  const legacy = localStorage.getItem("apix.language");
  if (legacy) return legacy;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: initialLang(),
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
  // 缺 key 时控制台告警（任务 10：语言包审计辅助）
  parseMissingKeyHandler: (key) => {
    console.warn(`[i18n] missing key: "${key}"`);
    return key;
  },
});

/**
 * 扫描 appDataDir/locales/*.json，注册为自定义语言。
 * 文件名 = 语言代码（如 ja.json），文件内可选 "__name": "日本語" 作为显示名。
 */
export async function loadCustomLocales(): Promise<
  { code: string; name: string }[]
> {
  const langs: { code: string; name: string }[] = [];
  try {
    const dir = await appDataDir();
    const localesDir = await join(dir, "locales");
    await mkdir(localesDir, { recursive: true }).catch(() => {});
    const entries = await readDir(localesDir);
    for (const e of entries) {
      const name = e.name ?? "";
      if (!e.isFile || !name.endsWith(".json")) continue;
      const code = name.replace(/\.json$/, "");
      if (code === "zh" || code === "en") continue; // 内置语言不重复注册
      const text = await readTextFile(await join(localesDir, name));
      const data = JSON.parse(text);
      i18n.addResourceBundle(code, "translation", data, true, true);
      langs.push({ code, name: typeof data.__name === "string" ? data.__name : code });
    }
  } catch {
    // 非桌面环境或权限不足时静默降级（仅内置语言）
  }
  return langs;
}

export default i18n;
