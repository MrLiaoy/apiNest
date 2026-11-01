import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import { useUiStore } from "../store/ui";
import { useCollectionStore } from "../store/collection";
import { useTabsStore } from "../store/tabs";
import { parseCurl } from "../utils/curl";

/** 从 cURL 导入：粘贴命令 → 解析 → 创建请求节点并打开 */
export default function CurlImportDialog() {
  const { t } = useTranslation();
  const setCurlImportOpen = useUiStore((s) => s.setCurlImportOpen);
  const setStatus = useUiStore((s) => s.setStatus);
  const showToast = useUiStore((s) => s.showToast);
  const restoreSnapshot = useCollectionStore((s) => s.restoreSnapshot);
  const openNode = useTabsStore((s) => s.openNode);
  const curlImportFolderId = useUiStore((s) => s.curlImportFolderId);
  const [text, setText] = useState("");

  function onOk() {
    const result = parseCurl(text);
    if (!result.ok) {
      setStatus("statusbar.curlInvalid", { reason: result.error });
      showToast("statusbar.curlInvalid", { reason: result.error }, "err");
      return;
    }
    restoreSnapshot(
      { name: result.name, kind: "rest", request: result.request },
      curlImportFolderId
    );
    const nodeId = useCollectionStore.getState().selectedId;
    if (nodeId) openNode(nodeId);
    setCurlImportOpen(false);
    setStatus("statusbar.curlImported", { name: result.name });
  }

  return (
    <Modal title={t("sidebar.curlImport")} onClose={() => setCurlImportOpen(false)} width={640}>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("editor.curlPlaceholder")}
        className="code-panel h-48 w-full resize-none"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => setCurlImportOpen(false)}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-panel-2"
        >
          {t("about.close")}
        </button>
        <button
          onClick={onOk}
          disabled={!text.trim()}
          className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {t("sidebar.curlImport")}
        </button>
      </div>
    </Modal>
  );
}
