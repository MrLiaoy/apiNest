import { useTranslation } from "react-i18next";
import { useUiStore } from "../store/ui";
import { useHistoryStore } from "../store/history";

/** ⑤ 状态栏：实时状态（i18n key） + 快捷键提示 */
export default function StatusBar() {
  const { t } = useTranslation();
  const { statusKey, statusParams } = useUiStore();
  const historyCount = useHistoryStore((s) => s.entries.length);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-panel px-3.5 text-[11.5px] text-ink-3">
      <span>{t(statusKey, statusParams)}</span>
      <div className="ml-auto flex gap-4">
        <span>{t("statusbar.shortcutSend")}</span>
        <span>{t("statusbar.shortcutSave")}</span>
        <span>{t("statusbar.historyCount", { count: historyCount })}</span>
      </div>
    </footer>
  );
}
