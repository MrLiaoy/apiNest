import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import KvTable from "./KvTable";
import CodeEditor from "./CodeEditor";
import { useUiStore } from "../../store/ui";
import type { RequestBody, RequestData } from "../../types/collection";

const BODY_TYPES = ["none", "json", "form", "urlencoded", "raw"] as const;

/** Body 编辑器：none / JSON(CodeMirror) / form-data(含文件) / urlencoded / raw */
export default function BodyPane({
  req,
  onChange,
}: {
  req: RequestData;
  onChange: (patch: Partial<RequestBody>) => void;
}) {
  const { t } = useTranslation();
  const setStatus = useUiStore((s) => s.setStatus);
  const body = req.body;

  function setBody(patch: Partial<RequestBody>) {
    onChange({ ...body, ...patch });
  }

  const jsonInvalid =
    body.type === "json" && body.content.trim() !== ""
      ? (() => {
          try {
            JSON.parse(body.content);
            return false;
          } catch {
            return true;
          }
        })()
      : false;

  const pill = (key: (typeof BODY_TYPES)[number]) =>
    `cursor-pointer rounded-full border px-3.5 py-1 text-xs ${
      body.type === key
        ? "border-accent bg-accent-soft font-medium text-accent"
        : "border-line text-ink-2 hover:bg-panel-2"
    }`;

  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        {BODY_TYPES.map((key) => (
          <div key={key} onClick={() => setBody({ type: key })} className={pill(key)}>
            {key === "form" ? "form-data" : key}
          </div>
        ))}
      </div>

      {body.type === "none" && (
        <p className="py-6 text-center text-xs text-ink-3">{t("editor.bodyNone")}</p>
      )}

      {body.type === "json" && (
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <button
              onClick={() => {
                try {
                  setBody({ content: JSON.stringify(JSON.parse(body.content), null, 2) });
                } catch {
                  setStatus("editor.jsonInvalid");
                }
              }}
              className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-2 hover:bg-panel-2"
            >
              {t("editor.format")}
            </button>
            {jsonInvalid && (
              <span className="text-[11.5px] text-[#f53f3f]">
                {t("editor.jsonInvalid")}
              </span>
            )}
          </div>
          <CodeEditor
            value={body.content}
            onChange={(content) => setBody({ content })}
            language="json"
          />
        </div>
      )}

      {body.type === "form" && (
        <div>
          <table className="kv-table max-w-[860px]">
            <thead>
              <tr>
                <th className="cell-chk" />
                <th>KEY</th>
                <th style={{ width: 84 }}>{t("editor.rowType")}</th>
                <th>VALUE</th>
                <th className="cell-x" />
              </tr>
            </thead>
            <tbody>
              {(body.rows ?? []).map((r, i) => (
                <tr key={i} className={r.enabled ? "" : "disabled"}>
                  <td className="cell-chk">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) =>
                        setBody({
                          rows: (body.rows ?? []).map((x, j) =>
                            j === i ? { ...x, enabled: e.target.checked } : x
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.key}
                      placeholder="Key"
                      onChange={(e) =>
                        setBody({
                          rows: (body.rows ?? []).map((x, j) =>
                            j === i ? { ...x, key: e.target.value } : x
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={r.fileType ? "file" : "text"}
                      onChange={(e) =>
                        setBody({
                          rows: (body.rows ?? []).map((x, j) =>
                            j === i
                              ? e.target.value === "file"
                                ? { ...x, fileType: true, path: x.path ?? "", value: "" }
                                : { ...x, fileType: false, path: undefined }
                              : x
                          ),
                        })
                      }
                      className="h-7 rounded border border-line bg-panel px-1.5 text-xs text-ink outline-none"
                    >
                      <option value="text">{t("editor.textType")}</option>
                      <option value="file">{t("editor.fileType")}</option>
                    </select>
                  </td>
                  <td>
                    {r.fileType ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="flex-1 truncate font-mono text-[11px] text-ink-3"
                          title={r.path}
                        >
                          {r.path || t("editor.noFileChosen")}
                        </span>
                        <button
                          onClick={async () => {
                            // 允许多选：同名 key 生成多行，一次上传多个文件
                            const paths = await open({ multiple: true });
                            if (!paths) return;
                            const list = Array.isArray(paths) ? paths : [paths];
                            setBody({
                              rows: (body.rows ?? []).flatMap((x, j) =>
                                j !== i
                                  ? [x]
                                  : [
                                      { ...x, path: list[0] },
                                      ...list
                                        .slice(1)
                                        .map((p) => ({
                                          key: x.key,
                                          value: "",
                                          enabled: true,
                                          fileType: true,
                                          path: p,
                                        })),
                                    ]
                              ),
                            });
                          }}
                          className="shrink-0 rounded border border-line px-2 py-1 text-[11px] text-ink-2 hover:bg-panel-2"
                        >
                          {t("editor.chooseFileShort")}
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={r.value}
                        placeholder="Value"
                        onChange={(e) =>
                          setBody({
                            rows: (body.rows ?? []).map((x, j) =>
                              j === i ? { ...x, value: e.target.value } : x
                            ),
                          })
                        }
                      />
                    )}
                  </td>
                  <td
                    className="cell-x"
                    onClick={() =>
                      setBody({ rows: (body.rows ?? []).filter((_, j) => j !== i) })
                    }
                  >
                    ✕
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            className="add-row"
            onClick={() =>
              setBody({
                rows: [...(body.rows ?? []), { key: "", value: "", enabled: true }],
              })
            }
          >
            {t("editor.addRow")}
          </div>
        </div>
      )}

      {body.type === "urlencoded" && (
        <KvTable
          rows={body.rows ?? []}
          onChange={(rows) => setBody({ rows })}
          addLabel={t("editor.addRow")}
        />
      )}

      {body.type === "raw" && (
        <textarea
          value={body.content}
          onChange={(e) => setBody({ content: e.target.value })}
          className="code-panel h-40 w-full resize-none"
        />
      )}
    </div>
  );
}
