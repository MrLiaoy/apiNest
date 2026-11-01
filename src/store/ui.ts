import { create } from "zustand";

const DEFAULT_SIDEBAR_WIDTH = 272;

function loadSidebarWidth(): number {
  const v = Number(localStorage.getItem("apix.sidebarWidth"));
  return Number.isFinite(v) && v >= 200 && v <= 420 ? v : DEFAULT_SIDEBAR_WIDTH;
}

const DEFAULT_RESPONSE_HEIGHT = 288;

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function loadHeight(): number {
  const v = Number(localStorage.getItem("apix.responseHeight"));
  return Number.isFinite(v) && v >= 120 ? v : DEFAULT_RESPONSE_HEIGHT;
}

/**
 * 全局 UI 状态。
 * statusKey 存 i18n key 而非文本——切换语言时状态栏文案自动跟随。
 */
interface UiState {
  statusKey: string;
  statusParams?: Record<string, unknown>;
  setStatus: (key: string, params?: Record<string, unknown>) => void;
  responseHeight: number;
  setResponseHeight: (h: number) => void;
  settingsOpen: boolean;
  aboutOpen: boolean;
  curlImportOpen: boolean;
  /** cURL 导入的目标文件夹（null = 根目录） */
  curlImportFolderId: string | null;
  /** 全局 toast（i18n key，2.5s 自动消失） */
  toast: { textKey: string; params?: Record<string, unknown>; kind: "ok" | "err" } | null;
  sidebarWidth: number;
  closeConfirmOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  setAboutOpen: (v: boolean) => void;
  setCurlImportOpen: (v: boolean, folderId?: string | null) => void;
  showToast: (textKey: string, params?: Record<string, unknown>, kind?: "ok" | "err") => void;
  setSidebarWidth: (w: number) => void;
  setCloseConfirmOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  statusKey: "statusbar.ready",
  statusParams: undefined,
  setStatus: (statusKey, statusParams) => set({ statusKey, statusParams }),
  responseHeight: loadHeight(),
  setResponseHeight: (h) => {
    localStorage.setItem("apix.responseHeight", String(h));
    set({ responseHeight: h });
  },
  settingsOpen: false,
  aboutOpen: false,
  curlImportOpen: false,
  curlImportFolderId: null,
  toast: null,
  sidebarWidth: loadSidebarWidth(),
  closeConfirmOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setCurlImportOpen: (curlImportOpen, folderId = null) =>
    set({ curlImportOpen, curlImportFolderId: folderId }),
  showToast: (textKey, params, kind = "err") => {
    clearTimeout(toastTimer);
    set({ toast: { textKey, params, kind } });
    toastTimer = setTimeout(() => set({ toast: null }), 2500);
  },
  setSidebarWidth: (w) => {
    localStorage.setItem("apix.sidebarWidth", String(w));
    set({ sidebarWidth: w });
  },
  setCloseConfirmOpen: (closeConfirmOpen) => set({ closeConfirmOpen }),
}));
