import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import RequestBar, { type Method } from "./RequestBar";
import RequestTabs, { type EditorPaneKey } from "./RequestTabs";
import KvTable from "./editor/KvTable";
import BodyPane from "./editor/BodyPane";
import AuthEditor from "./editor/AuthEditor";
import SoapBodyPane from "./editor/SoapBodyPane";
import HistoryPane from "./editor/HistoryPane";
import { findNode, useCollectionStore } from "../store/collection";
import { useTabsStore } from "../store/tabs";
import { useResponseStore } from "../store/response";
import { useUiStore } from "../store/ui";
import { useHistoryStore } from "../store/history";
import { sendActiveRequest } from "../utils/sendActive";
import { buildEnvelope, type WsdlInfo } from "../utils/soap";
import { normalizeUrl } from "../utils/send";
import { joinUrl, splitUrl } from "../utils/url";
import type { KeyValueRow, RequestBody } from "../types/collection";

/** 空态：未打开任何请求时，提供 REST / SOAP 两大创建入口 */
function EmptyChoice() {
  const { t } = useTranslation();
  const openBlankRest = useTabsStore((s) => s.openBlankRest);
  const openBlankSoap = useTabsStore((s) => s.openBlankSoap);

  const card =
    "flex w-56 flex-col items-center gap-2 rounded-xl border-2 border-line bg-panel-2 px-6 py-8 cursor-pointer transition hover:border-accent hover:bg-accent-soft";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 border-t border-line bg-panel">
      <p className="text-[13px] text-ink-3">{t("editor.emptyTitle")}</p>
      <div className="flex gap-6">
        <button onClick={openBlankRest} className={card}>
          <span className="text-3xl">📄</span>
          <span className="text-[14px] font-semibold text-ink">
            {t("editor.emptyRest")}
          </span>
          <span className="text-center text-xs leading-5 text-ink-3">
            {t("editor.emptyRestDesc")}
          </span>
        </button>
        <button onClick={openBlankSoap} className={card}>
          <span className="text-3xl">🔗</span>
          <span className="text-[14px] font-semibold text-ink">
            {t("editor.emptySoap")}
          </span>
          <span className="text-center text-xs leading-5 text-ink-3">
            {t("editor.emptySoapDesc")}
          </span>
        </button>
      </div>
    </div>
  );
}

/** 请求编辑区：REST 走参数/Body 编辑，SOAP 走「WSDL → 解析 → 编辑报文 → 发送」流程 */
export default function RequestEditor() {
  const { t } = useTranslation();
  const setStatus = useUiStore((s) => s.setStatus);
  const activeTab = useTabsStore(
    (s) => s.tabs.find((tb) => tb.tabId === s.activeTabId) ?? null
  );
  const items = useCollectionStore((s) => s.items);
  const updateRequest = useCollectionStore((s) => s.updateRequest);
  const nodeState = useResponseStore((s) =>
    activeTab ? s.map[activeTab.nodeId] : undefined
  );
  const historyCount = useHistoryStore((s) => s.entries.length);
  const loadHistory = useHistoryStore((s) => s.load);
  const colPath = useCollectionStore((s) => s.path);

  const [pane, setPane] = useState<EditorPaneKey>("params");
  const [parseLoading, setParseLoading] = useState(false);

  const node = activeTab ? findNode(items, activeTab.nodeId) : null;
  const isRequest = node?.type === "request";
  const req = isRequest ? node.request : null;
  const isSoap = isRequest && node.kind === "soap";
  const loading = nodeState?.loading ?? false;

  // 切换请求时加载该请求自己的历史
  useEffect(() => {
    if (activeTab && colPath) void loadHistory(colPath, activeTab.nodeId);
  }, [activeTab?.nodeId, colPath, loadHistory]);

  // SOAP：参数/Headers 页签不可用，强制落在 Body
  useEffect(() => {
    if (isSoap && (pane === "params" || pane === "headers")) setPane("body");
  }, [isSoap, pane]);

  function onUrlChange(u: string) {
    if (node?.type !== "request") return;
    if (isSoap) {
      updateRequest(node.id, { wsdl: u, url: u });
      return;
    }
    const { rows } = splitUrl(u);
    updateRequest(node.id, { url: u, params: rows });
  }

  function onParamsChange(rows: KeyValueRow[]) {
    if (node?.type !== "request") return;
    const { base } = splitUrl(node.request.url);
    updateRequest(node.id, { url: joinUrl(base, rows), params: rows });
  }

  function onBodyChange(patch: Partial<RequestBody>) {
    if (node?.type !== "request" || !req) return;
    updateRequest(node.id, { body: { ...req.body, ...patch } });
  }

  async function onParse() {
    if (node?.type !== "request") return;
    const wsdlUrl = normalizeUrl((req?.wsdl || req?.url || "").trim());
    if (!wsdlUrl) {
      setStatus("error.url");
      return;
    }
    setParseLoading(true);
    try {
      const info = await invoke<WsdlInfo>("parse_wsdl", { url: wsdlUrl });
      updateRequest(node.id, {
        wsdl: wsdlUrl,
        endpoint: info.endpoint,
        operation: info.operation,
        soapAction: info.soapAction,
        body: {
          type: "soap",
          content: buildEnvelope(info), // 模板填入可编辑报文区，用户可任意改
        },
      });
      setStatus("editor.soapParseOk", { op: info.operation });
    } catch (e) {
      const err = (e ?? {}) as { code?: string; detail?: string };
      const code = err.code ?? "wsdl";
      setStatus(`error.${code}`, { detail: err.detail ?? "" });
    } finally {
      setParseLoading(false);
    }
  }

  function onSend() {
    sendActiveRequest();
  }

  // 空态：没有打开的请求 → REST/SOAP 创建卡片
  if (!activeTab || !isRequest) return <EmptyChoice />;

  const content = () => {
    if (isSoap) {
      switch (pane) {
        case "body":
          return <SoapBodyPane req={req!} onChange={onBodyChange} />;
        case "auth":
          return (
            <AuthEditor
              auth={req!.auth}
              onChange={(auth) => {
                if (node?.type === "request") updateRequest(node.id, { auth });
              }}
            />
          );
        case "history":
          return <HistoryPane />;
        default:
          return null;
      }
    }
    switch (pane) {
      case "params":
        return (
          <KvTable
            rows={req!.params}
            onChange={onParamsChange}
            showNote
            addLabel={t("editor.addParam")}
          />
        );
      case "body":
        return <BodyPane req={req!} onChange={onBodyChange} />;
      case "headers": {
        const autoRows: [string, string][] =
          req!.body.type === "json"
            ? [["Content-Type", "application/json"]]
            : req!.body.type === "form"
              ? [["Content-Type", "multipart/form-data（boundary 自动生成）"]]
              : req!.body.type === "urlencoded"
                ? [["Content-Type", "application/x-www-form-urlencoded"]]
                : [];
        return (
          <div className="flex flex-col gap-5">
            {autoRows.length > 0 && (
              <table className="kv-table max-w-[640px]">
                <tbody>
                  {autoRows.map(([k, v]) => (
                    <tr key={k} className="disabled">
                      <td className="cell-chk">
                        <input type="checkbox" checked disabled />
                      </td>
                      <td>
                        <input type="text" value={k} disabled />
                      </td>
                      <td>
                        <input type="text" value={v} disabled />
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="auto-chip">{t("editor.autoGenerated")}</span>
                      </td>
                      <td className="cell-x" />
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <KvTable
              rows={req!.headers}
              onChange={(headers) =>
                node?.type === "request" && updateRequest(node.id, { headers })
              }
              addLabel={t("editor.addHeader")}
            />
          </div>
        );
      }
      case "auth":
        return (
          <AuthEditor
            auth={req!.auth}
            onChange={(auth) => {
              if (node?.type === "request") updateRequest(node.id, { auth });
            }}
          />
        );
      case "history":
        return <HistoryPane />;
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-line bg-panel">
      <RequestBar
        method={req?.method ?? "GET"}
        url={req?.wsdl ?? req?.url ?? ""}
        locked={isSoap}
        loading={loading}
        showParse={isSoap}
        parseLoading={parseLoading}
        resetKey={activeTab.nodeId}
        onMethodChange={(m: Method) => {
          if (node?.type === "request") updateRequest(node.id, { method: m });
        }}
        onUrlChange={onUrlChange}
        onSend={onSend}
        onParse={() => void onParse()}
      />
      <RequestTabs
        active={pane}
        onSelect={setPane}
        paramCount={req?.params.length ?? 0}
        headerCount={req?.headers.length ?? 0}
        historyCount={historyCount}
        soapMode={isSoap}
      />
      <div className="flex-1 overflow-y-auto p-4">{content()}</div>
    </div>
  );
}
