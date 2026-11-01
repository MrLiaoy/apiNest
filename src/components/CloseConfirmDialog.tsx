import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Modal from "./Modal";
import { useCollectionStore } from "../store/collection";
import { useUiStore } from "../store/ui";

/** 关闭确认：点关闭必弹（保存并关闭 / 直接关闭 / 取消） */
let allowClose = false;

function forceClose() {
  allowClose = true;
  void getCurrentWindow().close();
}

export default function CloseConfirmDialog() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.closeConfirmOpen);
  const setOpen = useUiStore((s) => s.setCloseConfirmOpen);
  const save = useCollectionStore((s) => s.save);
  const dirty = useCollectionStore((s) => s.dirty);
  const [saving, setSaving] = useState(false);
  // 启动缓冲期：1.5s 内不武装关闭拦截（避开启动期幽灵关闭事件）
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // 拦截一切关闭请求（任务栏 / Alt+F4），一律弹确认
  useEffect(() => {
    if (!armed) return;
    const unlisten = getCurrentWindow().onCloseRequested((event) => {
      if (allowClose) return; // 用户已确认，放行
      console.warn("[close] close requested — showing confirm dialog");
      event.preventDefault();
      setOpen(true);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [armed, setOpen]);

  async function saveAndClose() {
    setSaving(true);
    const ok = await save();
    setSaving(false);
    if (ok) forceClose();
  }

  if (!open) return null;

  return (
    <Modal title={t("close.title")} onClose={() => setOpen(false)} width={400}>
      <p className="text-xs leading-5 text-ink-2">
        {dirty ? t("close.text") : t("close.textClean")}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-panel-2"
        >
          {t("close.cancel")}
        </button>
        {dirty && (
          <button
            onClick={forceClose}
            className="rounded-md border border-[#f53f3f] px-3 py-1.5 text-xs text-[#f53f3f] hover:bg-[#ffece8]"
          >
            {t("close.discard")}
          </button>
        )}
        {dirty ? (
          <button
            onClick={() => void saveAndClose()}
            disabled={saving}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "…" : t("close.saveAndClose")}
          </button>
        ) : (
          <button
            onClick={forceClose}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
          >
            {t("close.closeBtn")}
          </button>
        )}
      </div>
    </Modal>
  );
}
