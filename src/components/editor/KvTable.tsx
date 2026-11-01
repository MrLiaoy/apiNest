import { useTranslation } from "react-i18next";
import type { KeyValueRow } from "../../types/collection";

/** 通用键值表格：勾选启停 / 编辑 / 删除 / 添加（参数、Headers、form-data 复用） */
export default function KvTable({
  rows,
  onChange,
  showNote = false,
  addLabel,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  showNote?: boolean;
  addLabel: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const { t } = useTranslation();

  // 同名 key 检测（含大小写完全相同才算同名）：发送时会生成多个同名字段，给出提示防止误判
  const keyCounts: Record<string, number> = {};
  rows.forEach((r) => {
    const k = r.key.trim();
    if (k) keyCounts[k] = (keyCounts[k] ?? 0) + 1;
  });

  function update(i: number, patch: Partial<KeyValueRow>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <table className="kv-table">
        <thead>
          <tr>
            <th className="cell-chk" />
            <th>KEY</th>
            <th>VALUE</th>
            {showNote && <th>{t("editor.noteCol")}</th>}
            <th className="cell-x" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.enabled ? "" : "disabled"}>
              <td className="cell-chk">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => update(i, { enabled: e.target.checked })}
                />
              </td>
              <td>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={r.key}
                    placeholder={keyPlaceholder}
                    onChange={(e) => update(i, { key: e.target.value })}
                  />
                  {keyCounts[r.key.trim()] > 1 && (
                    <span
                      className="dup-chip"
                      title={t("editor.dupKeyHint")}
                    >
                      ×{keyCounts[r.key.trim()]}
                    </span>
                  )}
                </div>
              </td>
              <td>
                <input
                  type="text"
                  value={r.value}
                  placeholder={valuePlaceholder}
                  onChange={(e) => update(i, { value: e.target.value })}
                />
              </td>
              {showNote && (
                <td>
                  <input
                    type="text"
                    value={r.note ?? ""}
                    onChange={(e) => update(i, { note: e.target.value })}
                  />
                </td>
              )}
              <td
                className="cell-x"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                ✕
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        className="add-row"
        onClick={() => onChange([...rows, { key: "", value: "", enabled: true }])}
      >
        {addLabel}
      </div>
    </div>
  );
}
