import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useResponseStore } from "../store/response";
import { useTabsStore } from "../store/tabs";
import { useUiStore } from "../store/ui";
import { highlightJson, highlightXml, prettyIfJson } from "../utils/highlight";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** ④ 响应区：状态/耗时/大小 + Pretty(JSON·XML 高亮) / Raw / Headers；响应按节点存储 */
export default function ResponsePanel() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("pretty");
  const responseHeight = useUiStore((s) => s.responseHeight);
  const activeTab = useTabsStore(
    (s) => s.tabs.find((tb) => tb.tabId === s.activeTabId) ?? null
  );
  const nodeState = useResponseStore((s) =>
    activeTab ? s.map[activeTab.nodeId] : undefined
  );
  const loading = nodeState?.loading ?? false;
  const resp = nodeState?.resp ?? null;
  const error = nodeState?.error ?? null;

  const prettyHtml = useMemo(() => {
    if (!resp) return "";
    const body = prettyIfJson(resp.bodyText);
    const trimmed = body.trimStart();
    return trimmed.startsWith("<") ? highlightXml(body) : highlightJson(body);
  }, [resp]);

  const tabCls = (key: string) =>
    `-mb-px cursor-pointer border-b-2 px-3 pb-2 pt-1.5 text-[12.5px] ${
      tab === key
        ? "border-accent font-medium text-accent"
        : "border-transparent text-ink-2 hover:text-ink"
    }`;

  const statusColor = resp
    ? resp.status < 400
      ? "#00b42a"
      : "#f53f3f"
    : undefined;

  return (
    <div
      className="flex shrink-0 flex-col overflow-hidden bg-panel"
      style={{ height: responseHeight }}
    >
      {/* 头部：页签 + 元信息 */}
      <div className="flex items-center gap-4 border-b border-line px-4 pt-2">
        <div className="flex">
          {["pretty", "raw", "headers"].map((key) => (
            <div key={key} onClick={() => setTab(key)} className={tabCls(key)}>
              {t(`response.${key}`)}
              {key === "headers" && resp && (
                <span className="ml-1 rounded-full bg-accent-soft px-1.5 text-[10px] text-accent">
                  {resp.headers.length}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3.5 pb-1.5 text-xs">
          {loading && <span className="text-ink-3">⏳ {t("response.sending")}</span>}
          {!loading && error && (
            <span className="font-semibold text-[#f53f3f]">{t("response.failed")}</span>
          )}
          {!loading && resp && (
            <>
              <span className="font-semibold" style={{ color: statusColor }}>
                {resp.status} {resp.statusText}
              </span>
              <span className="text-ink-3">{resp.durationMs} ms</span>
              <span className="text-ink-3">{formatSize(resp.sizeBytes)}</span>
            </>
          )}
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto p-3">
        {loading && (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-ink-3">
            <span className="spinner" /> {t("response.sending")}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-[#f53f3f]/40 bg-[#ffece8]/40 p-3 text-xs leading-5 text-ink-2">
            <div className="font-semibold text-[#f53f3f]">
              {t(`error.${error.code}`, { detail: error.detail })}
            </div>
            <div
              className="mt-1 break-all font-mono text-[11px] text-ink-3"
              data-selectable
            >
              {error.detail}
            </div>
          </div>
        )}

        {!loading && resp && (
          <>
            {resp.truncated && (
              <div className="mb-2 rounded bg-accent-soft px-2 py-1 text-[11px] text-accent">
                {t("response.truncated")}
              </div>
            )}
            {tab === "pretty" && (
              <pre
                data-selectable
                className="code-panel min-h-0 border-0"
                style={{ background: "transparent" }}
                dangerouslySetInnerHTML={{ __html: prettyHtml }}
              />
            )}
            {tab === "raw" && (
              <pre
                data-selectable
                className="code-panel min-h-0 border-0"
                style={{ background: "transparent", whiteSpace: "pre-wrap" }}
              >
                {resp.bodyText}
              </pre>
            )}
            {tab === "headers" && (
              <table className="kv-table max-w-[720px]" data-selectable>
                <thead>
                  <tr>
                    <th className="text-left">KEY</th>
                    <th className="text-left">VALUE</th>
                  </tr>
                </thead>
                <tbody>
                  {resp.headers.map((h, i) => (
                    <tr key={i}>
                      <td className="break-all font-mono">{h.key}</td>
                      <td
                        className="break-all font-mono"
                        data-selectable={i === 0 ? "" : undefined}
                      >
                        {h.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {!loading && !resp && !error && (
          <div className="flex h-full items-center justify-center text-xs text-ink-3">
            {t("response.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
