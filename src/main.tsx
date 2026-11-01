import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import i18n, { loadCustomLocales } from "./i18n";
import { useSettingsStore } from "./store/settings";
import { applyTheme } from "./utils/theme";

// 启动：应用语言与主题（读取自 apix.settings），并加载自定义语言包
const settings = useSettingsStore.getState();
i18n.changeLanguage(settings.lang);
applyTheme(settings.theme);
// 界面缩放（字体与按钮等比放大）
document.documentElement.style.zoom = String(settings.uiScale);
loadCustomLocales().then((langs) => {
  if (langs.length > 0) useSettingsStore.getState().setCustomLangs(langs);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
