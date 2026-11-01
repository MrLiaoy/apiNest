import { useTranslation } from "react-i18next";
import { useUiStore } from "../store/ui";

/** 全局 toast：2.5s 自动消失（错误红底，其余深色底） */
export default function Toast() {
  const { t } = useTranslation();
  const toast = useUiStore((s) => s.toast);
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-14 z-[200] -translate-x-1/2">
      <div
        className={`rounded-lg px-4 py-2 text-xs font-medium shadow-xl ${
          toast.kind === "err"
            ? "bg-[#f53f3f] text-white"
            : "bg-[#1d2129]/95 text-white"
        }`}
      >
        {t(toast.textKey, toast.params)}
      </div>
    </div>
  );
}
