import { create } from "zustand";
import i18n from "../i18n";
import { applyTheme, type ThemeMode } from "../utils/theme";

export interface CustomLang {
  code: string;
  name: string;
}

interface SettingsState {
  autoSave: boolean;
  theme: ThemeMode;
  lang: string;
  /** 工作区目录；null = 默认（appDataDir/workspace） */
  workspaceDir: string | null;
  /** 单请求最大历史条数（滚动存储） */
  maxHistoryPerRequest: number;
  /** 界面整体缩放（zoom），0.9~1.3 */
  uiScale: number;
  /** 最后一次打开的集合目录（启动时自动恢复） */
  lastCollectionDir: string | null;
  recents: string[];
  customLangs: CustomLang[];
  shortcuts: { send: string; save: string; closeTab: string; newTab: string };
  setAutoSave: (v: boolean) => void;
  setTheme: (t: ThemeMode) => void;
  setLang: (l: string) => void;
  setWorkspaceDir: (p: string | null) => void;
  setMaxHistoryPerRequest: (n: number) => void;
  setUiScale: (n: number) => void;
  setLastCollectionDir: (p: string | null) => void;
  addRecent: (p: string) => void;
  clearRecents: () => void;
  setCustomLangs: (l: CustomLang[]) => void;
}

const KEY = "apix.settings";
const DEFAULTS = {
  autoSave: true,
  theme: "system" as ThemeMode,
  lang: "zh",
  maxHistoryPerRequest: 100,
  uiScale: 1,
};

/** 读取设置；兼容迁移任务 00/01 的散装键（apix.theme / apix.language） */
function load(): {
  autoSave: boolean;
  theme: ThemeMode;
  lang: string;
  workspaceDir: string | null;
  maxHistoryPerRequest: number;
  uiScale: number;
  lastCollectionDir: string | null;
  recents: string[];
} {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    const legacyLang = localStorage.getItem("apix.language");
    const legacyTheme = localStorage.getItem("apix.theme") as ThemeMode | null;
    return {
      autoSave: raw.autoSave ?? DEFAULTS.autoSave,
      theme: raw.theme ?? legacyTheme ?? DEFAULTS.theme,
      lang: raw.lang ?? legacyLang ?? DEFAULTS.lang,
      workspaceDir: typeof raw.workspaceDir === "string" ? raw.workspaceDir : null,
      maxHistoryPerRequest:
        typeof raw.maxHistoryPerRequest === "number" && raw.maxHistoryPerRequest >= 10
          ? Math.min(Math.floor(raw.maxHistoryPerRequest), 1000)
          : DEFAULTS.maxHistoryPerRequest,
      uiScale:
        typeof raw.uiScale === "number" && raw.uiScale >= 0.9
          ? Math.min(raw.uiScale, 1.3)
          : DEFAULTS.uiScale,
      lastCollectionDir:
        typeof raw.lastCollectionDir === "string" ? raw.lastCollectionDir : null,
      recents: Array.isArray(raw.recents) ? raw.recents : [],
    };
  } catch {
    return {
      ...DEFAULTS,
      workspaceDir: null,
      lastCollectionDir: null,
      recents: [],
    };
  }
}

function persist(patch: Record<string, unknown>) {
  const cur = JSON.parse(localStorage.getItem(KEY) || "{}");
  localStorage.setItem(KEY, JSON.stringify({ ...cur, ...patch }));
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initial = load();
  return {
    ...initial,
    customLangs: [],
    shortcuts: {
      send: "Ctrl+Enter",
      save: "Ctrl+S",
      closeTab: "Ctrl+W",
      newTab: "Ctrl+T",
    },
    setAutoSave: (autoSave) => {
      persist({ autoSave });
      set({ autoSave });
    },
    setTheme: (theme) => {
      persist({ theme });
      set({ theme });
      applyTheme(theme);
    },
    setLang: (lang) => {
      persist({ lang });
      set({ lang });
      i18n.changeLanguage(lang);
    },
    setWorkspaceDir: (workspaceDir) => {
      persist({ workspaceDir });
      set({ workspaceDir });
    },
    setMaxHistoryPerRequest: (maxHistoryPerRequest) => {
      persist({ maxHistoryPerRequest });
      set({ maxHistoryPerRequest });
    },
    setUiScale: (uiScale) => {
      persist({ uiScale });
      set({ uiScale });
      document.documentElement.style.zoom = String(uiScale);
    },
    setLastCollectionDir: (lastCollectionDir) => {
      persist({ lastCollectionDir });
      set({ lastCollectionDir });
    },
    addRecent: (p) => {
      const recents = [p, ...get().recents.filter((x) => x !== p)].slice(0, 10);
      persist({ recents });
      set({ recents });
    },
    clearRecents: () => {
      persist({ recents: [] });
      set({ recents: [] });
    },
    setCustomLangs: (customLangs) => set({ customLangs }),
  };
});
