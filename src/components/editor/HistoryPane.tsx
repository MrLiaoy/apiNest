import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useCollectionStore } from "../../store/collection";
import { useHistoryStore, type HistoryEntry } from "../../store/history";
import { useTabsStore } from "../../store/tabs";
import { useUiStore } from "../../store/ui";
import { prettyIfJson } from "../../utils/highlight";
import { buildSendOptions } from "../../utils/send";
import { toCurl, type CurlFlavor } from "../../utils/curl";
import { soapToSendOptions } from "../../utils/soap";
import FloatingMenu from "../FloatingMenu";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 历史时间显示：按本机时区；今天只显示时间，非今天显示日期+时间 */
function formatHistTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `${hh}:${mm}:${ss}`;
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${Y}-${M}-${D} ${hh}:${mm}`;
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-medium text-ink-3">{label}</div>
      {children}
    </div>
  );
}

function Lines({ pairs }: { pairs: [string, string][] }) {
  if (pairs.length === 0) return <span className="text-ink-3">—</span>;
  return (
    <div className="font-mono text-[11.5px] leading-5">
      {pairs.map(([k, v], i) => (
        <div key={i} className="break-all">
          <span className="text-ink-2">{k}</span>
          <span className="text-ink-3"> = </span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

/** 历史：本文件全部发送记录（换 URL 也不丢）。点击条目展开查看完整请求/响应详情 */
export default function HistoryPane() {
  const { t } = useTranslation();
  const setStatus = useUiStore((s) => s.setStatus);
  const entries = useHistoryStore((s) => s.entries);
  const clear = useHistoryStore((s) => s.clear);
  const restoreSnapshot = useCollectionStore((s) => s.restoreSnapshot);
  const openNode = useTabsStore((s) => s.openNode);

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry: HistoryEntry } | null>(null);
  const colPath = useCollectionStore((s) => s.path);
  const activeNodeId = useTabsStore(
    (s) => s.tabs.find((t) => t.tabId === s.activeTabId)?.nodeId ?? null
  );

  async function copyCurl(e: HistoryEntry, kind: CurlFlavor) {
    const r = e.snapshot.request;
    const opts = e.kind === "soap" ? soapToSendOptions(r) : buildSendOptions(r);
    try {
      await navigator.clipboard.writeText(toCurl(opts, kind));
      setStatus("statusbar.copied");
    } catch {
      setStatus("statusbar.copyFailed");
    }
  }

  function saveAsRequest(e: HistoryEntry) {
    restoreSnapshot(e.snapshot);
    const nodeId = useCollectionStore.getState().selectedId;
    if (nodeId) openNode(nodeId);
    setStatus("statusbar.saved");
  }

  const reversed = [...entries].reverse();

  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="font-mono text-[11.5px] text-ink-3">
          {t("history.count", { count: entries.length })}
        </span>
        <span className="text-[11px] text-ink-3">{t("history.note")}</span>
        {entries.length > 0 && (
          <button
            onClick={() => {
              if (confirmClear) {
                if (colPath && activeNodeId) void clear(colPath, activeNodeId);
                setConfirmClear(false);
              } else {
                setConfirmClear(true);
              }
            }}
            onBlur={() => setConfirmClear(false)}
            className={`ml-auto rounded-md border px-2.5 py-1 text-xs ${
              confirmClear
                ? "border-[#f53f3f] bg-[#f53f3f] font-medium text-white"
                : "border-line text-ink-3 hover:border-[#f53f3f] hover:text-[#f53f3f]"
            }`}
          >
            {confirmClear ? t("history.confirmClearBtn") : t("history.clear")}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-xs leading-5 text-ink-3">
          {t("history.empty")}
        </p>
      ) : (
        reversed.map((e, idx) => {
          const expanded = expandedIdx === idx;
          const r = e.snapshot.request;
          return (
            <div key={`${e.time}-${idx}`} className="mb-1.5">
              <div
                onClick={() => setExpandedIdx(expanded ? null : idx)}
                onContextMenu={(ev) => {
                  ev.preventDefault();
                  setCtxMenu({ x: ev.clientX, y: ev.clientY, entry: e });
                }}
                className="hist-row"
                title={t("history.expandHint")}
              >
                <span className="w-2.5 shrink-0 text-[9px] text-ink-3">
                  {expanded ? "▾" : "▸"}
                </span>
                <span className="h-time">{formatHistTime(e.time)}</span>
                <span
                  className={`method-tag w-auto shrink-0 font-bold ${
                    e.kind === "soap" ? "m-SOAP" : `m-${e.method}`
                  }`}
                >
                  {e.kind === "soap" ? "SOAP" : e.method}
                </span>
                <span className="h-name">{e.name}</span>
                <span className="h-url" title={e.url}>
                  {e.url}
                </span>
                <span
                  className={`status-chip ${e.status === null || e.status >= 400 ? "err" : ""}`}
                >
                  {e.status === null ? t("history.failText") : e.status}
                </span>
                <span className="h-meta">
                  {e.durationMs !== null ? `${e.durationMs} ms · ` : ""}
                  {e.sizeBytes !== null ? formatSize(e.sizeBytes) : ""}
                </span>
              </div>

              {expanded && (
                <div
                  data-selectable
                  className="selectable mb-1.5 ml-6 flex flex-col gap-3 rounded-lg border border-line bg-panel-2 p-3 text-xs"
                >
                  <Section label="URL">
                    <div className="break-all font-mono text-[11.5px]">{e.url}</div>
                  </Section>

                  {r.params.filter((p) => p.key).length > 0 && (
                    <Section label={t("tabs.params")}>
                      <Lines
                        pairs={r.params
                          .filter((p) => p.key)
                          .map((p) => [p.key, p.value])}
                      />
                    </Section>
                  )}

                  {r.headers.filter((h) => h.key).length > 0 && (
                    <Section label={t("tabs.headers")}>
                      <Lines
                        pairs={r.headers
                          .filter((h) => h.key)
                          .map((h) => [h.key, h.value])}
                      />
                    </Section>
                  )}

                  {r.body.type !== "none" && (
                    <Section label={`${t("tabs.body")}（${r.body.type}）`}>
                      {r.body.type === "json" ||
                      r.body.type === "raw" ||
                      r.body.type === "soap" ? (
                        <pre
                          data-selectable
                          className="code-panel max-h-48 overflow-auto"
                        >
                          {prettyIfJson(r.body.content)}
                        </pre>
                      ) : (r.body.rows ?? []).length > 0 ? (
                        <Lines
                          pairs={(r.body.rows ?? [])
                            .filter((x) => x.key)
                            .map((x) => [
                              x.fileType ? `${x.key}（文件）` : x.key,
                              x.fileType ? (x.path ?? "") : x.value,
                            ])}
                        />
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </Section>
                  )}

                  {r.auth.type !== "none" && (
                    <Section label={t("tabs.auth")}>
                      <Lines
                        pairs={
                          r.auth.type === "bearer"
                            ? [["Bearer", r.auth.token ?? ""]]
                            : r.auth.type === "basic"
                              ? [
                                  ["user", r.auth.username ?? ""],
                                  ["pass", r.auth.password ?? ""],
                                ]
                              : [
                                  [r.auth.keyName ?? "key", r.auth.keyValue ?? ""],
                                  ["in", r.auth.location ?? "header"],
                                ]
                        }
                      />
                    </Section>
                  )}

                  <Section label={t("history.resp")}>
                    {e.resp ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`status-chip ${e.resp.status >= 400 ? "err" : ""}`}
                          >
                            {e.resp.status} {e.resp.statusText}
                          </span>
                          <span className="text-ink-3">
                            {e.resp.durationMs} ms · {formatSize(e.resp.sizeBytes)}
                          </span>
                        </div>
                        <pre
                          data-selectable
                          className="code-panel max-h-64 overflow-auto"
                        >
                          {prettyIfJson(e.resp.bodyText)}
                        </pre>
                      </div>
                    ) : (
                      <span className="text-[#f53f3f]">{t("history.failText")}</span>
                    )}
                  </Section>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* 右键：复制为 cURL / 存为请求 */}
      {ctxMenu && (
        <FloatingMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={[
            {
              key: "curl",
              label: t("sidebar.copyCurl"),
              icon: "📋",
              sub: [
                { key: "linux", label: "Linux / macOS" },
                { key: "windows", label: "Windows (cmd)" },
              ],
              onClick: (subKey) =>
                void copyCurl(ctxMenu.entry, (subKey as CurlFlavor) ?? "linux"),
            },
            {
              key: "restore",
              label: t("history.saveAsReq"),
              icon: "📄",
              onClick: () => saveAsRequest(ctxMenu.entry),
            },
          ]}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
